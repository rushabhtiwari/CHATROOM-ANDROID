/**
 * The Mailing Hub's wire contract.
 *
 * These mirror the projections in `backend/app/routers/mailing.py`. The backend
 * already resolves labels, tones and available actions, so the client never
 * re-derives a lifecycle decision the server has made — a status chip and the
 * button that acts on it can never disagree.
 */

// Mirrors `app/mailing_workflow.STATUS_LABEL`. Two human gates, both internal:
// AWAITING_ADMIN_APPROVAL, then AWAITING_ACCOUNTS_APPROVAL in front of PACT.
export type MailStatus =
  | 'RECEIVED'
  | 'CLASSIFIED'
  | 'EXTRACTING'
  | 'VALIDATED'
  | 'AWAITING_ADMIN_APPROVAL'
  | 'COMMITTED'
  | 'ACKNOWLEDGED'
  | 'AWAITING_ACCOUNTS_APPROVAL'
  | 'PUSHED_TO_PACT'
  | 'COMPLETED'
  | 'NOT_AN_ORDER'
  | 'EXCEPTION'
  | 'DISCARDED';

export type HoldReason =
  | 'INTAKE_FILTERED'
  | 'EXCEPTION'
  | 'AWAITING_ADMIN'
  | 'AWAITING_ACCOUNTS';

export type TriageAction =
  | 'COMMIT_EDITED'
  | 'ACCOUNTS_APPROVE'
  | 'REJECT'
  | 'RETRY_EXTRACTION'
  | 'WHITELIST';

export type Tone = 'grey' | 'blue' | 'amber' | 'red' | 'green';

export interface MailRow {
  id: string;
  messageId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  source: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  domain: string;
  subject: string | null;
  receivedAt: string;
  attachmentCount: number;
  status: MailStatus;
  statusLabel: string;
  tone: Tone;
  holdReason: HoldReason | null;
  cause: string | null;
  causeLabel: string;
  confidence: number | null;
  ingestJobId: string | null;
  orderId: string | null;
  poNumber: string | null;
  acknowledged: boolean;
}

export interface MailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  ocrStatus: string;
  pages: number;
  url: string;
}

export interface MailHeaders {
  messageId?: string;
  returnPath?: string;
  spf?: string;
  dkim?: string;
  dmarc?: string;
}

export interface MailDetailEmail extends MailRow {
  bodyText: string;
  headers: MailHeaders;
  attachments: MailAttachment[];
}

/** One extracted fact and the evidence behind it (WORKING.md §1.4). */
export interface ExtractedField {
  value: string | number | null;
  confidence: number;
  page: number;
  bbox: number[];
  snippet: string;
  source: 'MODEL' | 'HUMAN';
  supersededValue?: string | number | null;
  supersededConfidence?: number;
}

export interface Extraction {
  fields: Record<string, ExtractedField>;
  modelConfidence: number;
  correctedBy?: string;
  correctedAt?: string;
}

export interface TimelineEntry {
  at: string;
  status: MailStatus;
  action: string;
  actor: string;
  note: string;
}

export interface JobRow {
  id: string;
  emailLogId: string;
  status: MailStatus;
  statusLabel: string;
  tone: Tone;
  holdReason: HoldReason | null;
  holdReasonLabel: string;
  cause: string | null;
  causeLabel: string;
  confidence: number | null;
  extraction: Extraction;
  correctedJson: Record<string, unknown> | null;
  suspectFields: string[];
  touchedByHuman: boolean;
  decisionNote?: string;
  retryCount: number;
  orderId: string | null;
  poNumber: string | null;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
  acknowledgedAt: string | null;
  timeline: TimelineEntry[];
  subject: string | null;
  fromAddress: string | null;
  domain: string;
  receivedAt: string;
  attachments: MailAttachment[];
  availableActions: TriageAction[];
}

export interface OrderVersion {
  id: string;
  orderId: string;
  versionNo: number;
  reason: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MailDetail {
  email: MailDetailEmail;
  job: JobRow | null;
  order: (Record<string, unknown> & { id: string; versions: OrderVersion[] }) | null;
  thread: MailRow[];
}

export interface Monitor {
  connection: string;
  connected?: boolean;
  folder?: string;
  messageCount?: number | null;
  consecutiveFailures?: number;
  lastSeenUid?: number;
  uidValidity?: string;
  host: string;
  mailbox: string;
  state: string;
  paused: boolean;
  intervalSeconds: number;
  lastCheckedAt: string;
  lastMessageAt: string;
  lastError: string | null;
  pollCount: number;
}

/** The connected mailbox, as the server is willing to describe it. */
export interface Mailbox {
  address: string;
  host: string;
  port: number;
  secure: boolean;
  mailbox: string;
  connectedAt: string | null;
  autoStart: boolean;
  /** Credentials entered in the console, or read from the env file. */
  source: 'connected' | 'env';
}

export interface MailingSummary {
  version: number;
  totalMails: number;
  inboundCount: number;
  outboundCount: number;
  onHoldCount: number;
  onHoldByReason: Record<HoldReason, number>;
  committedCount: number;
  stpRate: number;
  monitor: Monitor;
}

export interface CompanyDomain {
  id: string;
  domain: string;
  companyName: string;
  companyCode: string;
  addedAt: string;
  addedBy: string;
}

export interface MailsPage {
  items: MailRow[];
  total: number;
  page: number;
  pageSize: number;
  statuses: { value: MailStatus; label: string; tone: Tone }[];
}

export interface OnHoldPage {
  items: JobRow[];
  total: number;
  groups: { reason: HoldReason; label: string; count: number }[];
  domains: CompanyDomain[];
}

export interface Analytics {
  generatedAt: string;
  windowDays: number;
  intake: { totalEmails: number; totalJobs: number; orders: number; notOrders: number; exceptions: number };
  stp: { rate: number; straightThrough: number; touched: number; decided: number };
  timeseries: { date: string; orders: number; notOrders: number; exceptions: number }[];
  errorBreakdown: { cause: string; label: string; count: number; share: number; cumulativeShare: number }[];
  domainStats: { domain: string; total: number; held: number; committed: number; known: boolean; errorRate: number }[];
  latency: { p50: number | null; p90: number | null; p99: number | null; sampleSize: number };
  sla: { targetMinutes: number; withinTarget: number; breached: number; compliance: number };
}

export interface DirectSendResult {
  emailLogId: string;
  ingestJobId: string;
  status: MailStatus | null;
  deduplicated: boolean;
  reason: string | null;
}

export interface ResolveResult {
  success: boolean;
  orderId?: string | null;
  acknowledgementId?: string;
  status?: MailStatus;
  companyDomainId?: string;
  reprocessedCount?: number;
  // ACCOUNTS_APPROVE only: what the PACT push did.
  paused?: boolean;
  documentNo?: string | null;
  steps?: Array<{ step: string; status: 'done' | 'paused' | 'failed'; detail: string }>;
}
