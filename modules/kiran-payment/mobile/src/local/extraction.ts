/**
 * Receipt understanding, inside the app: a port of backend/app/extraction.py.
 *
 * One forced function call does two jobs at once: it reads the receipt into
 * structured fields, and the fields are checked against the company's category
 * caps. There is no prose to parse and no second round trip.
 *
 * The model's reading is a *proposal*: it pre-fills the claim form, the
 * employee corrects anything wrong, and their submission creates the claim.
 *
 * With no key, or when the call fails, extraction degrades to a filename
 * heuristic rather than failing. A demo should never dead-end on wifi.
 *
 * Only the OpenAI provider is ported: an app build carries OpenAI's key and
 * nothing else, so the Anthropic path has nowhere to run.
 */
import type { LocalFile } from './core';
import { OPENAI_EXTRACTION_MODEL, hasOpenAiKey } from './config';
import { callFunction, filePart, readable, type AnthropicTool } from './openai';

/** One entry of the claims store's `policyCaps` list, as backend/seed.json has it. */
export type PolicyCap = Record<string, unknown>;

export interface ExtractionBackend {
  configured: boolean;
  provider: 'openai';
  model: string | null;
}

type Json = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* Python's number formatting, so messages read exactly as the backend's       */
/* -------------------------------------------------------------------------- */

/**
 * Python's `round(x, digits)`: correctly rounded, with exact ties going to the
 * even neighbour. A double is an exact tie at `digits` places only when it is
 * an odd multiple of 2^-(digits+1); anything else `toFixed` rounds exactly.
 */
export function pyRound(x: number, digits = 0): number {
  const halves = x * 2 ** (digits + 1);
  if (Number.isInteger(halves) && Math.abs(halves % 2) === 1) {
    const scaled = x * 10 ** digits;
    const floor = Math.floor(scaled);
    return (floor % 2 === 0 ? floor : floor + 1) / 10 ** digits;
  }
  return Number(x.toFixed(digits));
}

/** Python's `f"{x:,.0f}"`: rounded half-even, thousands separated by commas. */
export function money(x: number): string {
  const rounded = pyRound(x, 0);
  const digits = Math.abs(rounded).toFixed(0);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (rounded < 0 || Object.is(rounded, -0) ? '-' : '') + grouped;
}

/**
 * Python's `sum()` of floats, which since 3.12 is compensated (Neumaier), so
 * an average of confidences comes out to the same last bit as the backend's.
 */
function pySum(values: number[]): number {
  let total = 0;
  let compensation = 0;
  for (const value of values) {
    const next = total + value;
    if (Math.abs(total) >= Math.abs(value)) compensation += total - next + value;
    else compensation += value - next + total;
    total = next;
  }
  return compensation && Number.isFinite(compensation) ? total + compensation : total;
}

/** Python truthiness for JSON values: empty text, zero, empty lists and objects are false. */
function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Python's `str(value)` for the values a JSON payload can hold. */
function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/**
 * `(raw.get(key) or "").strip()`. The backend crashed on a truthy value that
 * was not text; here it is read as its text instead, so a junk payload still
 * yields a form the employee can correct. That is the one deliberate
 * difference in shaping.
 */
function text(value: unknown): string {
  if (!truthy(value)) return '';
  return (typeof value === 'string' ? value : pyStr(value)).trim();
}

/** Python's `str.title()`: each run of letters starts upper case, the rest lower. */
function pyTitle(value: string): string {
  let out = '';
  let previousCased = false;
  for (const char of value) {
    const cased = char.toLowerCase() !== char.toUpperCase();
    if (cased) out += previousCased ? char.toLowerCase() : char.toUpperCase();
    else out += char;
    previousCased = cased;
  }
  return out;
}

/** The first `count` characters, counted as Python counts them (code points). */
const head = (value: string, count: number) => Array.from(value).slice(0, count).join('');

/** `Path(name).stem`: the last path component without its final suffix. */
function stem(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(0, dot) : base;
}

/** `Path(name).suffix`, lower-cased. */
function suffix(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot).toLowerCase() : '';
}

/* -------------------------------------------------------------------------- */
/* The receipt tool and prompt                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The schema the model must fill. The backend's copy carries `strict: true`
 * for Anthropic; the OpenAI path always dropped it, so it is omitted here.
 */
export const RECEIPT_TOOL: AnthropicTool = {
  name: 'record_receipt',
  description:
    'Record the structured contents of an expense receipt, and flag any ' +
    'company policy caps the amounts exceed.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description:
          'A short claim title an employee would recognise, e.g. ' +
          "'Client visit - Pune, 3 days' or 'Taj Vivanta - 2 nights'. " +
          'Max 60 characters.',
      },
      category: {
        type: 'string',
        enum: ['TRAVEL', 'LODGING', 'MEALS', 'FUEL', 'OTHER'],
        description:
          'TRAVEL for flights/trains/cabs, LODGING for hotels, MEALS ' +
          'for food, FUEL for petrol/diesel, OTHER for anything else.',
      },
      amount: {
        type: 'number',
        description:
          'The total payable on the receipt, in rupees. Use the grand ' +
          'total including taxes, not a subtotal or a per-night rate.',
      },
      vendor: {
        type: 'string',
        description: 'Merchant or supplier name as printed.',
      },
      invoice_number: {
        type: 'string',
        description: 'Invoice, bill or PNR number. Empty string if absent.',
      },
      invoice_date: {
        type: 'string',
        description: 'Date on the receipt as YYYY-MM-DD. Empty string if absent.',
      },
      travel_from: {
        type: 'string',
        description:
          'Start of the stay or trip as YYYY-MM-DD, for hotel check-in ' +
          'or outbound travel. Empty string if not applicable.',
      },
      travel_to: {
        type: 'string',
        description:
          'End of the stay or trip as YYYY-MM-DD, for hotel check-out ' +
          'or return travel. Empty string if not applicable.',
      },
      justification: {
        type: 'string',
        description:
          'One or two sentences an employee could submit as the business ' +
          'justification, written from what the receipt shows. Do not ' +
          'invent a business reason that is not implied by the document.',
      },
      line_items: {
        type: 'array',
        description: 'Individual charges on the receipt. Empty array if not itemised.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            amount: { type: 'number' },
          },
          required: ['description', 'amount'],
          additionalProperties: false,
        },
      },
      nights: {
        type: 'integer',
        description: 'Number of nights for a hotel bill, else 0.',
      },
      days: {
        type: 'integer',
        description: 'Number of days the claim covers, else 0.',
      },
      confidence: {
        type: 'object',
        description: '0 to 1 confidence for each field you filled in.',
        properties: {
          title: { type: 'number' },
          category: { type: 'number' },
          amount: { type: 'number' },
          vendor: { type: 'number' },
          dates: { type: 'number' },
        },
        required: ['title', 'category', 'amount', 'vendor', 'dates'],
        additionalProperties: false,
      },
      readable: {
        type: 'boolean',
        description:
          'False if the document is too blurred, cropped or unrelated ' + 'to read as a receipt.',
      },
      notes: {
        type: 'string',
        description:
          'Anything a reviewer should know: unclear totals, handwriting, ' +
          'a foreign currency, a second passenger. Empty string if none.',
      },
    },
    required: [
      'title',
      'category',
      'amount',
      'vendor',
      'invoice_number',
      'invoice_date',
      'travel_from',
      'travel_to',
      'justification',
      'line_items',
      'nights',
      'days',
      'confidence',
      'readable',
      'notes',
    ],
    additionalProperties: false,
  },
};

const capNumber = (cap: PolicyCap) => number(cap.cap);

function systemPrompt(caps: PolicyCap[]): string {
  const capLines = caps
    .map(
      (c) =>
        `- ${pyStr(c.label)}: Rs ${money(capNumber(c))} ${pyStr(c.unit)} ` +
        `(category ${pyStr(c.category)})`,
    )
    .join('\n');
  return (
    'You read expense receipts for an Indian corporate reimbursement system ' +
    'and return structured data.\n\n' +
    'Rules:\n' +
    '- Amounts are Indian rupees. Strip currency symbols, commas and the word ' +
    'INR. If a total is shown in another currency, record the rupee figure if ' +
    'one is printed, otherwise record the number as-is and say so in notes.\n' +
    '- Record the grand total actually payable, after taxes and discounts.\n' +
    '- Dates are YYYY-MM-DD. Indian receipts are usually DD/MM/YYYY, so ' +
    '03/09/2026 is 2026-09-03, not 9 March.\n' +
    '- Never invent a value. If a field is not on the document, use an empty ' +
    "string, 0, or an empty array, and set that field's confidence low.\n" +
    '- A photo taken on a phone may not show a receipt at all: a room, a ' +
    'person, a blank page, or a bill too blurred to read. Then leave every ' +
    'field empty and the amount 0, set every confidence to 0, and say in ' +
    'notes what the photo shows instead.\n' +
    '- Be honest in `confidence`. A reviewer uses it to decide what to check.\n\n' +
    "The company's expense caps, for context when writing notes:\n" +
    `${capLines}\n\n` +
    'Call record_receipt exactly once.'
  );
}

/** config.py's IMAGE_TYPES and PDF_TYPES: the files the extractor will read. */
const MEDIA_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * The media type the extractor sends a file as, or null to skip it. Decided by
 * the file's extension, as the backend did. A file with no recognised
 * extension but a supported MIME type (a camera capture named "image", say) is
 * also read; the backend never saw such names, since uploads came off a disk.
 */
function mediaType(file: LocalFile): string | null {
  const byName = MEDIA_TYPES[suffix(file.name)];
  if (byName) return byName;
  const type = (file.type || '').toLowerCase();
  return Object.values(MEDIA_TYPES).includes(type) ? type : null;
}

/* -------------------------------------------------------------------------- */
/* Policy checks and shaping                                                   */
/* -------------------------------------------------------------------------- */

interface Finding {
  severity: 'BREACH' | 'INFO' | 'WARN';
  code: string;
  message: string;
  cap: number | null;
  observed: number | null;
}

/**
 * Checks the extracted amounts against the caps. Plain arithmetic, so the
 * compliance panel shows a number a reviewer can verify, not a model opinion.
 */
function policyFindings(
  category: string,
  amount: number,
  nights: number,
  days: number,
  caps: PolicyCap[],
): Finding[] {
  const cap = caps.find((c) => c.category === category);
  if (!cap || !amount) return [];

  const unit = cap.unit;
  const limit = capNumber(cap);
  const label = pyStr(cap.label).toLowerCase();
  const findings: Finding[] = [];

  if (unit === 'per night' && nights > 0) {
    const perNight = amount / nights;
    if (perNight > limit) {
      const over = (perNight - limit) * nights;
      findings.push({
        severity: 'BREACH',
        code: 'LODGING_CAP',
        message:
          `Rs ${money(perNight)} per night over ${nights} night(s) ` +
          `exceeds the Rs ${money(limit)} cap by Rs ${money(over)}.`,
        cap: limit,
        observed: perNight,
      });
    }
  } else if (unit === 'per day' && days > 0) {
    const perDay = amount / days;
    if (perDay > limit) {
      const over = (perDay - limit) * days;
      findings.push({
        severity: 'BREACH',
        code: 'MEALS_CAP',
        message:
          `Rs ${money(perDay)} per day over ${days} day(s) exceeds ` +
          `the Rs ${money(limit)} cap by Rs ${money(over)}.`,
        cap: limit,
        observed: perDay,
      });
    }
  } else if (amount > limit) {
    findings.push({
      severity: 'BREACH',
      code: `${category}_CAP`,
      message:
        `Rs ${money(amount)} exceeds the ${label} of ` +
        `Rs ${money(limit)} ${pyStr(unit)} by Rs ${money(amount - limit)}.`,
      cap: limit,
      observed: amount,
    });
  } else if (amount > limit * 0.9) {
    findings.push({
      severity: 'INFO',
      code: `${category}_NEAR_CAP`,
      message: `Rs ${money(amount)} is within 10% of the Rs ${money(limit)} ${label}.`,
      cap: limit,
      observed: amount,
    });
  }

  return findings;
}

const VALID_CATEGORIES = new Set(['TRAVEL', 'LODGING', 'MEALS', 'FUEL', 'OTHER']);

/**
 * Reads a number from a payload that may not have been schema-validated.
 * Tolerates the formatted strings a model sometimes returns for money —
 * "Rs 12,331.00", "₹12,331" — rather than discarding the amount.
 */
function number(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    // What Python's float() accepts once only digits, dots and minus remain.
    return /^-?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : fallback;
  }
  return fallback;
}

/**
 * Turns a tool payload into the camelCase shape the frontend consumes. Written
 * to tolerate a payload that was not schema-validated: a category the UI has
 * no label for, or a total that arrived as text, would otherwise reach a
 * screen and break it.
 */
function shape(raw: Json, caps: PolicyCap[], source: string, model: string | null): Json {
  const amount = number(raw.amount);
  let category = pyStr(truthy(raw.category) ? raw.category : 'OTHER').toUpperCase();
  if (!VALID_CATEGORIES.has(category)) category = 'OTHER';
  const nights = Math.trunc(number(raw.nights));
  const days = Math.trunc(number(raw.days));

  const travelFrom = text(raw.travel_from);
  const travelTo = text(raw.travel_to);
  const travelDates = travelFrom && travelTo ? { from: travelFrom, to: travelTo } : null;

  const supplied = raw.confidence;
  const confidence: Record<string, number> =
    typeof supplied === 'object' && supplied !== null && !Array.isArray(supplied)
      ? Object.fromEntries(Object.entries(supplied).map(([key, value]) => [key, number(value)]))
      : {};
  const scores = Object.values(confidence);
  const overall = scores.length ? pyRound(pySum(scores) / scores.length, 3) : 0;

  const findings = policyFindings(category, amount, nights, days, caps);
  if (raw.readable === false) {
    findings.unshift({
      severity: 'WARN',
      code: 'UNREADABLE',
      message:
        'The document could not be read confidently. Please check ' +
        'every field before submitting.',
      cap: null,
      observed: null,
    });
  }

  // A truthy non-list (text, an object) iterated to no dicts in the backend: no items.
  const items = Array.isArray(raw.line_items) ? raw.line_items : [];
  return {
    title: head(text(raw.title), 80) || null,
    category,
    amount: amount || null,
    currency: 'INR',
    vendor: text(raw.vendor) || null,
    invoiceNumber: text(raw.invoice_number) || null,
    invoiceDate: text(raw.invoice_date) || null,
    travelDates,
    justification: text(raw.justification) || null,
    lineItems: items
      .filter(
        (item): item is Json => typeof item === 'object' && item !== null && !Array.isArray(item),
      )
      .map((item) => ({
        description: pyStr('description' in item ? item.description : ''),
        amount: number(item.amount),
      })),
    confidence,
    overallConfidence: overall,
    policyFindings: findings,
    notes: text(raw.notes) || null,
    source,
    model,
    receiptIds: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Offline fallback                                                            */
/* -------------------------------------------------------------------------- */

const FILENAME_CATEGORY: [RegExp, string][] = [
  [/hotel|taj|vivanta|oyo|marriott|lemon|inn|stay|lodg/, 'LODGING'],
  [/fuel|petrol|diesel|hpcl|iocl|bpcl|shell/, 'FUEL'],
  [/meal|food|restaurant|cafe|swiggy|zomato|dine/, 'MEALS'],
  [/flight|indigo|vistara|airline|boarding|irctc|rail|train|ola|uber|cab|taxi|travel/, 'TRAVEL'],
];

/**
 * The pre-extracted sample. Reached when the network dies, or explicitly via
 * `useSample`, so the flow can always be demonstrated end to end.
 */
const SAMPLE_EXTRACTION: Json = {
  title: 'Taj Vivanta, Pune - 2 nights',
  category: 'LODGING',
  amount: 11800.0,
  vendor: 'Taj Vivanta Pune',
  invoice_number: 'TV-2026-44817',
  invoice_date: '2026-09-04',
  travel_from: '2026-09-02',
  travel_to: '2026-09-04',
  justification:
    'Two-night stay in Pune for the on-site client visit with the ' + 'procurement team.',
  line_items: [
    { description: 'Room charges (2 nights)', amount: 10000.0 },
    { description: 'GST @ 18%', amount: 1800.0 },
  ],
  nights: 2,
  days: 3,
  confidence: {
    title: 0.94,
    category: 0.98,
    amount: 0.99,
    vendor: 0.97,
    dates: 0.92,
  },
  readable: true,
  notes: 'Room rate is Rs 5,000 per night before tax.',
};

/**
 * Last resort: infer what we can from the filename alone. Confidence is
 * deliberately near zero — a starting point for the employee to correct, and
 * it must not read as a confident machine reading.
 */
function heuristic(fileNames: string[], caps: PolicyCap[]): Json {
  const joined = fileNames.join(' ').toLowerCase();
  let category = 'OTHER';
  for (const [pattern, value] of FILENAME_CATEGORY) {
    if (pattern.test(joined)) {
      category = value;
      break;
    }
  }

  const base = fileNames.length ? stem(fileNames[0]!) : 'receipt';
  const title = head(pyTitle(base.replace(/[-_]+/g, ' ').trim()), 60);

  return shape(
    {
      title,
      category,
      amount: 0,
      vendor: '',
      invoice_number: '',
      invoice_date: '',
      travel_from: '',
      travel_to: '',
      justification: '',
      line_items: [],
      nights: 0,
      days: 0,
      confidence: { title: 0.2, category: 0.3, amount: 0.0, vendor: 0.0, dates: 0.0 },
      readable: false,
      notes:
        'Automatic reading was unavailable, so only the file name could ' +
        'be used. Please fill in the amount and details.',
    },
    caps,
    'heuristic',
    null,
  );
}

export function sampleExtraction(caps: PolicyCap[]): Record<string, unknown> {
  return shape(SAMPLE_EXTRACTION, caps, 'sample', null);
}

/* -------------------------------------------------------------------------- */
/* The real call                                                               */
/* -------------------------------------------------------------------------- */

function instruction(count: number): string {
  let value = 'Read the attached receipt' + (count > 1 ? 's' : '') + ' and record the claim.';
  if (count > 1) {
    value +=
      ' They belong to one trip, so combine them into a single claim: ' +
      'sum the totals, and pick the category of the largest charge.';
  }
  return value;
}

/**
 * Reads one or more receipt files into a single claim proposal. Multiple files
 * go in one message, so a boarding pass plus a hotel bill for the same trip
 * produce one coherent claim rather than two fragments.
 *
 * `names` carries the filenames the employee chose, for the heuristic's title.
 */
export async function extract(
  files: LocalFile[],
  caps: PolicyCap[],
  names?: string[],
): Promise<Record<string, unknown>> {
  const fileNames = names && names.length ? names : files.map((file) => file.name);

  if (!hasOpenAiKey()) {
    const result = heuristic(fileNames, caps);
    result.notes =
      'No OPENAI_API_KEY is configured, so the receipt was not read. ' +
      'Add a key to backend/.env to enable extraction.';
    return result;
  }

  const readableFiles = files
    .map((file) => ({ file, type: mediaType(file) }))
    .filter((entry): entry is { file: LocalFile; type: string } => entry.type !== null);
  if (!readableFiles.length) return heuristic(fileNames, caps);

  const parts: Json[] = readableFiles.map(({ file, type }) =>
    filePart(type, file.base64, file.name),
  );
  parts.push({ type: 'text', text: instruction(readableFiles.length) });

  let raw: Json | null;
  try {
    raw = await callFunction(OPENAI_EXTRACTION_MODEL, systemPrompt(caps), parts, RECEIPT_TOOL);
  } catch (error) {
    // The demo must not die on a bad call.
    const result = heuristic(fileNames, caps);
    result.notes = `${readable(error)} Please enter the details manually.`;
    return result;
  }
  if (!raw || !Object.keys(raw).length) return heuristic(fileNames, caps);
  return shape(raw, caps, 'openai', OPENAI_EXTRACTION_MODEL);
}

/** Whether extraction is live, so the UI can say so honestly. */
export function describeBackend(): ExtractionBackend {
  const configured = hasOpenAiKey();
  return { configured, provider: 'openai', model: configured ? OPENAI_EXTRACTION_MODEL : null };
}
