import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from './core';
import { rtsReload, rtsRoutes, rtsSnapshot, rtsStreams } from './rts';

/** Receipt reading is another module's job; here it only has to be called right. */
const extraction = vi.hoisted(() => ({
  describeBackend: vi.fn(() => ({ configured: false, provider: 'openai', model: null })),
  sampleExtraction: vi.fn(() => ({ source: 'sample', amount: 1850, receiptIds: [] })),
  extract: vi.fn(async () => ({ source: 'openai', amount: 2400, receiptIds: [] })),
}));
vi.mock('./extraction', () => extraction);

const PY_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/;

async function call(method: string, url: string, body?: unknown) {
  const response = await dispatch(rtsRoutes, method, url, body);
  return { status: response.status, body: await response.json() };
}

const newClaim = (overrides: Record<string, unknown> = {}) => ({
  employeeId: 'EMP-02',
  title: 'Client visit, Pune',
  category: 'TRAVEL',
  amount: 12345,
  justification: 'Quarterly review with the Pune distributor.',
  files: [{ fileName: 'ticket.pdf', sizeKb: 84 }],
  status: 'SUBMITTED',
  actor: 'Rohan Deshmukh',
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  rtsReload();
  vi.clearAllMocks();
});

describe('GET /api/state', () => {
  it('answers with the seeded world and its analytics', async () => {
    const { status, body } = await call('GET', '/api/state');
    expect(status).toBe(200);
    expect(body.version).toBe(1);
    expect(body.currentEmployeeId).toBe('EMP-02');
    expect(body.requests).toHaveLength(24);
    expect(body.payouts).toHaveLength(8);
    expect(Object.keys(body.analytics)).toEqual([
      'monthlySpend',
      'departmentUtilisation',
      'policyCaps',
      'categorySpend',
    ]);
    expect(body.analytics.categorySpend.map((c: { category: string }) => c.category)).toEqual([
      'TRAVEL',
      'LODGING',
      'MEALS',
      'FUEL',
      'OTHER',
    ]);
  });
});

describe('claims', () => {
  it('files a claim with 201 and shows it in state', async () => {
    const { status, body } = await call('POST', '/api/requests', newClaim());
    expect(status).toBe(201);
    expect(body).toMatchObject({
      id: 'REQ-2026-9001',
      status: 'SUBMITTED',
      currentStage: 'HR',
      currency: 'INR',
      travelDates: null,
      duplicateOf: null,
      extraction: null,
      extractedAmount: null,
      receipts: [{ id: 'RCP-REQ-2026-9001-1', fileName: 'ticket.pdf', sizeKb: 84 }],
    });
    expect(body.submittedOn).toMatch(PY_TIME);
    expect(body.slaDueOn).toMatch(PY_TIME);
    expect(body.timeline[0]).toMatchObject({
      id: 'EVT-REQ-2026-9001-0',
      role: 'EMPLOYEE',
      action: 'Submitted for approval',
    });

    const state = rtsSnapshot();
    expect(state.version).toBe(2);
    expect(state.requests[0]!.id).toBe('REQ-2026-9001');
    expect(state.notifications[0]).toMatchObject({
      id: 'NTF-RUN-1',
      toRole: 'HR',
      body: 'Rohan Deshmukh raised REQ-2026-9001 for Client visit, Pune. Amount Rs 12,345.',
    });

    // Persisted, as data/state.json was: a fresh load sees the same thing.
    rtsReload();
    expect(rtsSnapshot().requests[0]!.id).toBe('REQ-2026-9001');
    expect(rtsSnapshot().version).toBe(2);
  });

  it('refuses a malformed claim with 422', async () => {
    const missing = await call('POST', '/api/requests', newClaim({ title: undefined }));
    expect(missing).toEqual({ status: 422, body: { detail: 'Field required' } });

    const status = await call('POST', '/api/requests', newClaim({ status: 'PAID' }));
    expect(status).toEqual({
      status: 422,
      body: { detail: "Input should be 'DRAFT' or 'SUBMITTED'" },
    });
    expect(rtsSnapshot().version).toBe(1);
  });

  it('moves a claim along the chain, and refuses an out-of-order step', async () => {
    const approved = await call('POST', '/api/requests/REQ-2026-0103/transition', {
      status: 'HR_APPROVED',
      actor: 'Meera Nair',
      role: 'HR',
      comment: 'Looks fine.',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('HR_APPROVED');
    expect(approved.body.currentStage).toBe('ACCOUNTS');
    expect(approved.body.timeline.at(-1)).toMatchObject({
      actor: 'Meera Nair',
      role: 'HR',
      action: 'Approved by HR',
      comment: 'Looks fine.',
    });
    const [employee, accounts] = rtsSnapshot().notifications;
    expect(accounts).toMatchObject({ toRole: 'ACCOUNTS', title: 'REQ-2026-0103 cleared by HR' });
    expect(employee).toMatchObject({
      toRole: 'EMPLOYEE',
      toEmployeeId: 'EMP-01',
      body: 'Your claim has moved to the Accounts queue. Note: Looks fine.',
    });

    const early = await call('POST', '/api/requests/REQ-2026-0104/transition', {
      status: 'ACC_APPROVED',
      actor: 'Arjun',
      role: 'ACCOUNTS',
    });
    expect(early).toEqual({
      status: 409,
      body: { detail: 'Awaiting HR approval. Accounts cannot act until HR clears it.' },
    });

    const missing = await call('POST', '/api/requests/REQ-9/transition', {
      status: 'HR_APPROVED',
      actor: 'x',
      role: 'HR',
    });
    expect(missing).toEqual({ status: 404, body: { detail: "No request matches 'REQ-9'." } });
  });

  it('queues a payout when Accounts approves', async () => {
    await call('POST', '/api/requests/REQ-2026-0110/transition', {
      status: 'ACC_APPROVED',
      actor: 'Arjun',
      role: 'ACCOUNTS',
    });
    expect(rtsSnapshot().payouts[0]).toMatchObject({
      id: 'PAY-RUN-0001',
      requestId: 'REQ-2026-0110',
      status: 'QUEUED',
      method: 'NEFT',
      utr: null,
    });
  });
});

describe('payouts', () => {
  it('disburses every payable claim under one UTR', async () => {
    const payees = await call('GET', '/api/payees');
    expect(payees.body.map((p: { employee: { id: string } }) => p.employee.id)).toContain('EMP-02');

    const { status, body } = await call('POST', '/api/disburse', {
      employeeId: 'EMP-02',
      method: 'IMPS',
    });
    expect(status).toBe(200);
    expect(body.utr).toMatch(/^UTR\d{14}$/);
    expect(body).toMatchObject({
      method: 'IMPS',
      employeeId: 'EMP-02',
      total: 16700,
      requestIds: ['REQ-2026-0117'],
      payoutId: `PAY-${body.utr.slice(-6)}`,
    });

    const state = rtsSnapshot();
    const claim = state.requests.find((r) => r.id === 'REQ-2026-0117')!;
    expect(claim.status).toBe('CREDITED');
    expect(claim.timeline.slice(-2).map((e) => e.actor)).toEqual(['Kavya Reddy', 'Kavya Reddy']);
    expect(state.payouts.find((p) => p.id === 'PAY-2026-0081')).toMatchObject({
      status: 'PAID',
      method: 'IMPS',
      utr: body.utr,
    });
    expect(state.notifications[1]!.title).toBe('Payment successful — Rs 16,700 received');

    const context = await call('GET', `/api/receipt-context/${body.utr}`);
    expect(context.body).toMatchObject({ utr: body.utr, total: 16700, method: 'IMPS' });
    expect(context.body.employee.id).toBe('EMP-02');

    const again = await call('POST', '/api/disburse', { employeeId: 'EMP-02', method: 'IMPS' });
    expect(again).toEqual({
      status: 409,
      body: { detail: 'There is nothing payable for this employee.' },
    });
  });
});

describe('notifications', () => {
  it('marks one, then all, as read', async () => {
    expect(await call('POST', '/api/notifications/NTF-01/read')).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(rtsSnapshot().notifications.find((n) => n.id === 'NTF-01')!.read).toBe(true);

    await call('POST', '/api/notifications/read-all');
    expect(rtsSnapshot().notifications.every((n) => n.read)).toBe(true);
    expect(rtsSnapshot().version).toBe(3);
  });
});

describe('POST /api/demo/reset', () => {
  it('puts the seed back', async () => {
    await call('POST', '/api/requests', newClaim());
    const { body } = await call('POST', '/api/demo/reset');
    expect(body.version).toBe(1);
    expect(body.requests).toHaveLength(24);
    rtsReload();
    expect(rtsSnapshot().requests).toHaveLength(24);
  });
});

describe('receipts', () => {
  it('keeps an upload as a data URL and files it with the claim', async () => {
    const form = new FormData();
    form.append('files', new File(['fake image bytes'], 'bus ticket.png', { type: 'image/png' }));
    const { status, body } = await call('POST', '/api/receipts/extract', form);

    expect(status).toBe(200);
    const [receipt] = body.receipts;
    expect(receipt).toMatchObject({
      id: 'RCP-UP-1',
      fileName: 'bus-ticket.png',
      sizeKb: 1,
      mimeType: 'image/png',
    });
    expect(receipt.url).toMatch(/^data:image\/png;base64,/);
    expect(receipt.uploadedOn).toMatch(PY_TIME);
    expect(receipt.storedName).toMatch(/^[0-9a-f]{12}-bus-ticket\.png$/);
    expect(body.extraction).toMatchObject({ source: 'openai', receiptIds: ['RCP-UP-1'] });
    expect(extraction.extract).toHaveBeenCalledWith(
      [expect.objectContaining({ name: 'bus ticket.png' })],
      expect.any(Array),
      ['bus-ticket.png'],
    );
    // Stored, but not a visible change until a claim files it.
    expect(rtsSnapshot().version).toBe(1);

    const filed = await call('POST', '/api/requests', newClaim({ receiptIds: ['RCP-UP-1'] }));
    expect(filed.body.receipts).toEqual([
      {
        id: 'RCP-REQ-2026-9001-1',
        fileName: 'bus-ticket.png',
        sizeKb: 1,
        uploadedOn: receipt.uploadedOn,
        url: receipt.url,
        mimeType: 'image/png',
      },
    ]);
  });

  it('answers the sample with no upload, and 400 with neither', async () => {
    const form = new FormData();
    form.append('use_sample', 'true');
    const sample = await call('POST', '/api/receipts/extract', form);
    expect(sample.body).toEqual({
      receipts: [],
      extraction: { source: 'sample', amount: 1850, receiptIds: [] },
    });

    const empty = await call('POST', '/api/receipts/extract', new FormData());
    expect(empty).toEqual({ status: 400, body: { detail: 'No files were uploaded.' } });
  });
});

describe('/api/events', () => {
  it('sends the state on open and again after every mutation', async () => {
    const frames: Array<{ event: string; version: number }> = [];
    const close = rtsStreams['/api/events']!((event, data) =>
      frames.push({ event, version: (data as { version: number }).version }),
    );
    expect(frames).toEqual([{ event: 'state', version: 1 }]);
    expect((await call('GET', '/api/health')).body.listeners).toBe(1);

    await call('POST', '/api/notifications/read-all');
    expect(frames).toEqual([
      { event: 'state', version: 1 },
      { event: 'state', version: 2 },
    ]);

    close();
    await call('POST', '/api/notifications/read-all');
    expect(frames).toHaveLength(2);
    expect((await call('GET', '/api/health')).body.listeners).toBe(0);
  });
});
