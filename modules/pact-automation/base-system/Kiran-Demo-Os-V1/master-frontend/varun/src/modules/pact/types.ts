/**
 * Strongly typed definitions for PACT Automation integration.
 */

export type PactEntryStatus =
  | 'pending'
  | 'approved'
  | 'saved'
  | 'failed'
  | 'rejected'
  | string;

export interface PactProfileField {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  default?: unknown;
}

export interface PactSettings {
  profile?: string;
  dry_run?: boolean;
  auto_save?: boolean;
  active_profile?: string;
  fields?: PactProfileField[];
  [key: string]: unknown;
}

export interface PactStatus {
  busy: boolean;
  current: number | null;
  worker_alive: boolean;
  settings?: PactSettings;
}

export interface PactVerifierMismatch {
  field?: string;
  expected?: unknown;
  seen?: unknown;
}

export interface PactVerifierResult {
  ok?: boolean;
  mismatches?: PactVerifierMismatch[];
  errors?: string[];
  [key: string]: unknown;
}

export interface PactConfirmation {
  record_id?: string;
  text?: string;
  ok?: boolean | null;
  [key: string]: unknown;
}

export interface PactEntryResult {
  confirmation?: PactConfirmation;
  verifier?: PactVerifierResult;
  [key: string]: unknown;
}

export interface PactEntry {
  id: number;
  record: Record<string, unknown>;
  source?: string;
  status: PactEntryStatus;
  created_at?: string;
  updated_at?: string;
  error?: string;
  result?: PactEntryResult;
  log?: string;
}
