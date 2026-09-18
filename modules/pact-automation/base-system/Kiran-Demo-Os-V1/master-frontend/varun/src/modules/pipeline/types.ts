/**
 * The PO pipeline's wire contract.
 *
 * Mirrors `backend/app/write_service/po_pipeline.pipeline_view` and
 * `backend/app/routers/pipeline.py`. As everywhere else in this console, the server has
 * already resolved the label and the tone, so a status chip and the button beside it can
 * never disagree about what state a job is in.
 *
 * Note what is deliberately absent from `Confirmation`: `tokenHash`. The server strips it
 * before the record leaves the machine — nothing on this side needs it, and a hash in a
 * JSON response is an offline-guessing target for no benefit.
 */

// Mirrors the step names in `write_service/po_pipeline.py`, in pipeline order.
export type PipelineStepName =
  // intake, ungated
  | 'receipt'
  | 'internal_notification'
  // after the admin approves
  | 'acknowledgement'
  | 'team_tasks'
  // after Accounts release it
  | 'pact_push'
  | 'proforma'
  | 'dispatch_notice'
  | 'close_tasks';

export type StepStatus = 'done' | 'paused' | 'failed';

export type Tone = 'grey' | 'blue' | 'amber' | 'red' | 'green';

export interface PipelineStep {
  step: PipelineStepName;
  status: StepStatus;
  detail: string;
  skipped: boolean;
  at: string;
}

/** One line of the order's own table. Every one becomes a row in the PACT grid. */
export interface LineItem {
  sr: number;
  productCode: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  value: number;
}

export interface Proposal {
  poNumber: string;
  customer: string;
  quantityMetres: number;
  orderValue: number;
  deliveryDate: string;
  lineItems: LineItem[];
}

/** One unit of work an approved order created, for one team. */
export interface TeamTask {
  id: string;
  ingestJobId: string;
  team: 'SALES' | 'ACCOUNTS' | 'MANUFACTURING';
  title: string;
  body: string;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  updatedAt: string;
}

export interface PactPush {
  id: string;
  ingestJobId: string;
  attempt: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'PAUSED' | 'FAILED';
  profile: string;
  documentNo?: string | null;
  dryRun?: boolean;
  entryId?: number | null;
  priceNotes?: string[];
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Proforma {
  id: string;
  ingestJobId: string;
  documentNo: string;
  pactDocumentNo: string;
  isDemo: boolean;
  html: string;
  totals: { currency: string; quantityMetres: number; rate: number | null; subtotal: number };
  createdAt: string;
}

export interface OutboundRow {
  id: string;
  kind: string;
  to: string;
  subject: string;
  sent: boolean;
  reason: string | null;
  at: string;
}

export interface TimelineEntry {
  at: string;
  status: string;
  action: string;
  actor: string;
  note: string;
}

export interface PipelineView {
  jobId: string;
  status: string;
  statusLabel: string;
  tone: Tone;
  holdReason: string | null;
  customer: string;
  poNumber: string;
  fromAddress: string;
  proposal: Proposal;
  /** False when PACT's master does not contain this customer — the demo's hard stop. */
  inPactMaster: boolean;
  kpacProfile: string;
  /** True when the admin's approval releases the order into PACT by itself (PACT_AUTO_RELEASE). */
  pactAutoRelease?: boolean;
  steps: PipelineStep[];
  lineItems: LineItem[];
  tasks: TeamTask[];
  pactPushes: PactPush[];
  proforma: Proforma | null;
  outbound: OutboundRow[];
  timeline: TimelineEntry[];
}

export interface PipelineBoardRow {
  jobId: string;
  status: string;
  statusLabel: string;
  tone: Tone;
  customer: string | null;
  poNumber: string | null;
  orderValue: number | null;
  lineCount: number;
  documentNo: string | null;
  pactStatus: string | null;
  openTasks: number;
  updatedAt: string;
}

export interface RunResult {
  ok: boolean;
  paused: boolean;
  steps: PipelineStep[];
}

/** KPAC's own state, folded into the summary so "the robot is offline" is never a surprise. */
export interface KpacStatus {
  reachable: boolean;
  detail: string;
  workerAlive?: boolean;
  busy?: boolean;
  profile?: string;
  dryRun?: boolean;
  mode?: string;
  /** False when KPAC has a different PACT screen loaded than this deployment expects. */
  profileMatches?: boolean;
}

export interface DemoCustomer {
  name: string;
  email: string;
  city: string;
}

export interface PipelineSummary {
  awaitingAdmin: number;
  awaitingAccounts: number;
  completed: number;
  discarded: number;
  tasksOpen: number;
  tasksDone: number;
  pactDrafts: number;
  pactPaused: number;
  pactFailed: number;
  proformas: number;
  kpacProfile: string;
  pactAutoRelease?: boolean;
  demoCustomers: DemoCustomer[];
  mailRedirect: string | null;
  internalRecipients: string[];
  kpac: KpacStatus;
}
