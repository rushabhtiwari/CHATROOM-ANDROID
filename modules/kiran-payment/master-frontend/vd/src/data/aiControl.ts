import { AIModelRecord, AIRunLogRecord, AIGuardrailRecord, AIPromptRecord } from '../types';

export const mockAIRoutingMap = [
  { feature: 'Email Intake', model: 'claude-sonnet-4-6', taskType: 'Extraction', monthlySpendINR: 4210, runsMonth: 342, avgConfidence: 96 },
  { feature: 'Email classify', model: 'claude-haiku-4-5', taskType: 'Routing', monthlySpendINR: 680, runsMonth: 1240, avgConfidence: 98 },
  { feature: 'Quotation drafting', model: 'claude-sonnet-4-6', taskType: 'Generation', monthlySpendINR: 2940, runsMonth: 188, avgConfidence: 94 },
  { feature: 'Commitment detect', model: 'claude-haiku-4-5', taskType: 'Classification', monthlySpendINR: 410, runsMonth: 950, avgConfidence: 95 },
  { feature: 'Escalation logic', model: 'claude-opus-5', taskType: 'Reasoning', monthlySpendINR: 3180, runsMonth: 78, avgConfidence: 97 },
  { feature: '3-way match review', model: 'claude-opus-5', taskType: 'Reasoning', monthlySpendINR: 1760, runsMonth: 64, avgConfidence: 96 },
  { feature: 'Report narration', model: 'claude-sonnet-4-6', taskType: 'Generation', monthlySpendINR: 1120, runsMonth: 42, avgConfidence: 95 },
  { feature: 'Ask Kiran', model: 'claude-opus-5', taskType: 'Q&A', monthlySpendINR: 4120, runsMonth: 410, avgConfidence: 99 }
];

export const mockAIModels: AIModelRecord[] = [
  {
    id: 'MOD-001',
    name: 'claude-sonnet-4-6',
    provider: 'Anthropic',
    assignedFeatures: ['Email Intake', 'Quotation drafting', 'Report narration'],
    contextWindow: '200,000 tokens',
    inputRateUSD: 3.00,
    outputRateUSD: 15.00,
    monthlySpendINR: 8270,
    avgLatencySec: 1.4,
    successRatePct: 99.2,
    fallbackModel: 'claude-haiku-4-5',
    status: 'Active',
    config: {
      temperature: 0.1,
      maxTokens: 4096,
      timeoutSec: 15,
      retryPolicy: 'Exponential backoff (3 attempts)',
      rateLimit: '50 req/min'
    }
  },
  {
    id: 'MOD-002',
    name: 'claude-haiku-4-5',
    provider: 'Anthropic',
    assignedFeatures: ['Email classify', 'Commitment detect'],
    contextWindow: '200,000 tokens',
    inputRateUSD: 0.80,
    outputRateUSD: 4.00,
    monthlySpendINR: 1090,
    avgLatencySec: 0.4,
    successRatePct: 99.8,
    fallbackModel: 'None',
    status: 'Active',
    config: {
      temperature: 0.0,
      maxTokens: 1024,
      timeoutSec: 5,
      retryPolicy: 'Immediate retry (2 attempts)',
      rateLimit: '200 req/min'
    }
  },
  {
    id: 'MOD-003',
    name: 'claude-opus-5',
    provider: 'Anthropic',
    assignedFeatures: ['Escalation logic', '3-way match review', 'Ask Kiran'],
    contextWindow: '200,000 tokens',
    inputRateUSD: 15.00,
    outputRateUSD: 75.00,
    monthlySpendINR: 9060,
    avgLatencySec: 3.2,
    successRatePct: 98.9,
    fallbackModel: 'claude-sonnet-4-6',
    status: 'Active',
    config: {
      temperature: 0.2,
      maxTokens: 8192,
      timeoutSec: 30,
      retryPolicy: 'Exponential backoff (2 attempts)',
      rateLimit: '20 req/min'
    }
  },
  {
    id: 'MOD-004',
    name: 'text-embedding-3-large',
    provider: 'OpenAI',
    assignedFeatures: ['Vector Search & Catalog RAG'],
    contextWindow: '8,191 tokens',
    inputRateUSD: 0.13,
    outputRateUSD: 0.00,
    monthlySpendINR: 420,
    avgLatencySec: 0.1,
    successRatePct: 99.9,
    fallbackModel: 'None',
    status: 'Active',
    config: {
      temperature: 0.0,
      maxTokens: 1536,
      timeoutSec: 5,
      retryPolicy: 'Immediate retry',
      rateLimit: '500 req/min'
    }
  }
];

export const mockCostTrend90Days = [
  { day: '01 Jun', sonnet: 240, haiku: 32, opus: 210, total: 482 },
  { day: '15 Jun', sonnet: 260, haiku: 35, opus: 280, total: 575 },
  { day: '01 Jul', sonnet: 290, haiku: 38, opus: 310, total: 638 },
  { day: '15 Jul', sonnet: 310, haiku: 42, opus: 340, total: 692 },
  { day: '01 Aug', sonnet: 280, haiku: 39, opus: 305, total: 624 },
  { day: '05 Aug', sonnet: 295, haiku: 41, opus: 320, total: 656 },
  { day: '10 Aug', sonnet: 310, haiku: 43, opus: 350, total: 703 },
  { day: '15 Aug', sonnet: 340, haiku: 46, opus: 390, total: 776 },
  { day: '19 Aug', sonnet: 325, haiku: 44, opus: 370, total: 739 },
];

export const mockAIRuns: AIRunLogRecord[] = [
  {
    id: 'RUN-101',
    runId: 'RUN-2026-0819-012',
    feature: 'Email Intake',
    trigger: 'Email received',
    model: 'claude-sonnet-4-6',
    status: 'Success',
    durationSec: 1.42,
    tokensUsed: 3840,
    costINR: 4.85,
    confidencePct: 96,
    humanReview: 'Approved',
    timestamp: '19 Aug 2026, 06:14:12 IST',
    systemPromptVersion: 'v11.4-email-extract',
    guardrailsChecked: [
      { name: 'PII Scrubbing', passed: true },
      { name: 'Customer Credit Verification', passed: true },
      { name: 'Direct Price Quotation Gate', passed: true }
    ],
    toolsCalled: [
      { tool: 'customer_lookup', args: { domain: 'motherson.com' }, result: { customerId: 'CUST-001', code: 'MOTHERSON' } },
      { tool: 'product_match', args: { query: 'Silicone Coated 6mm Black' }, result: { partNumber: 'KU-SLV-0625-B' } }
    ],
    output: 'Successfully extracted 11 fields for RFQ-2026-0418. Matched customer CUST-001 (Motherson Sumi Systems Ltd).',
    traceSteps: [
      { name: '1. Email Ingestion & Header Parser', durationMs: 45, status: 'success', payload: { from: 'vivek.s@motherson.com', subject: 'RFQ: Silicone Coated Fiberglass Sleeve 6mm' } },
      { name: '2. Customer RAG Lookup & Credit Check', durationMs: 120, status: 'success', payload: { customerId: 'CUST-001', overdue: 842150, stopDispatch: true } },
      { name: '3. Model Inference (claude-sonnet-4-6)', durationMs: 1140, tokens: 3840, status: 'success', payload: { tokensIn: 3120, tokensOut: 720 } },
      { name: '4. Guardrail Policy Evaluation', durationMs: 85, status: 'success', payload: { gatesPassed: 3, blocked: 0 } },
      { name: '5. Draft RFQ Creation in Database', durationMs: 30, status: 'success', payload: { rfqId: 'RFQ-2026-0418' } }
    ]
  },
  {
    id: 'RUN-102',
    runId: 'RUN-2026-0819-011',
    feature: '3-way match review',
    trigger: 'Webhook',
    model: 'claude-opus-5',
    status: 'Success',
    durationSec: 3.10,
    tokensUsed: 5200,
    costINR: 12.40,
    confidencePct: 96,
    humanReview: 'Approved',
    timestamp: '19 Aug 2026, 05:40:02 IST',
    systemPromptVersion: 'v4.1-3way-match',
    guardrailsChecked: [
      { name: 'Tolerance Threshold Check', passed: true }
    ],
    toolsCalled: [
      { tool: 'pact_fetch_po', args: { poNumber: 'PO-PUR-2026-0892' }, result: { lineItems: 1, qty: 4000 } }
    ],
    output: 'Detected 200kg short delivery on Saint-Gobain GRN-2026-0419. Calculated Debit Note amount of ₹33,000.',
    traceSteps: []
  },
  {
    id: 'RUN-103',
    runId: 'RUN-2026-0818-099',
    feature: 'Quotation drafting',
    trigger: 'User action',
    model: 'claude-sonnet-4-6',
    status: 'Blocked by guardrail',
    durationSec: 1.15,
    tokensUsed: 2900,
    costINR: 3.65,
    confidencePct: 88,
    humanReview: 'Not required',
    timestamp: '18 Aug 2026, 17:42:10 IST',
    systemPromptVersion: 'v12.0-quote-terms',
    guardrailsChecked: [
      { name: 'Outbound Quotation Gate', passed: false, reason: 'AI attempted direct quote email transmission without HOD signature.' }
    ],
    toolsCalled: [],
    output: 'Blocked action: Direct quote dispatch blocked by Guardrail G-01 (Approval Gates). Sent draft to HOD inbox instead.',
    traceSteps: []
  }
];

export const mockAIRunLogs = mockAIRuns;
export const mockAICostTrend = mockCostTrend90Days;
export const mockAIDepartmentSpend = [
  { dept: 'Revenue', spend: 8250 },
  { dept: 'Operations', spend: 4960 },
  { dept: 'Finance', spend: 3210 },
  { dept: 'Projects', spend: 2000 }
];
export const mockAIOverviewKPI = { totalSpendINR: 18420 };
export const mockAIBlockedActions = [
  {
    id: 'BLK-001',
    timestamp: '18 Aug 2026, 17:42 IST',
    feature: 'Quotation drafting',
    reason: 'Outbound Quotation Gate',
    interceptedPayload: 'Direct quote email transmission without HOD signature',
    actionTaken: 'Routed to HOD approval queue'
  }
];

export const mockAIGuardrails: AIGuardrailRecord[] = [
  {
    id: 'GRD-001',
    name: 'Mandatory HOD Sign-off on Outbound Quotations',
    category: 'Approval gates',
    description: 'The AI model may generate quotation drafts and commercial terms, but is strictly prohibited from emailing quotations to clients without human HOD approval.',
    appliesTo: 'Quotation drafting, Email reply',
    requiredApprover: 'Rajesh Kumar (Head of Sales)',
    isEnabled: true,
    triggeredCountMonth: 48
  },
  {
    id: 'GRD-002',
    name: 'Stop-Dispatch Release Lockdown',
    category: 'Approval gates',
    description: 'AI may never clear a stop-dispatch flag or generate SLD paperwork for accounts with overdue debt >60 days.',
    appliesTo: 'Dispatch, SLD Generation',
    requiredApprover: 'Meera Iyer (Accounts Head)',
    isEnabled: true,
    triggeredCountMonth: 14
  },
  {
    id: 'GRD-003',
    name: 'Information Sharing Department-Wide Embargo',
    category: 'Approval gates',
    description: 'Customer schedule revisions and engineering changes cannot be broadcasted department-wide before HOD reviews impact.',
    appliesTo: 'Comms, Email Intake',
    requiredApprover: 'Rajesh Kumar (Sales HOD)',
    isEnabled: true,
    triggeredCountMonth: 31
  },
  {
    id: 'GRD-004',
    name: 'Email Extraction Confidence Floor',
    category: 'Confidence thresholds',
    description: 'If extraction confidence on part number or quantity is below 85%, route to human intake queue rather than auto-creating RFQ.',
    appliesTo: 'Email Intake',
    thresholdPct: 85,
    isEnabled: true,
    triggeredCountMonth: 23
  },
  {
    id: 'GRD-005',
    name: 'Confidential Margin & Costing Redaction',
    category: 'Data protection',
    description: 'Internal gross margins, raw material purchase rates, and supplier identities must never be leaked into client emails or outbound PDF drafts.',
    appliesTo: 'All Models',
    isEnabled: true,
    triggeredCountMonth: 11
  },
  {
    id: 'GRD-006',
    name: 'Monthly Total Token Budget Cap',
    category: 'Spend limits',
    description: 'Monthly spend hard limit of ₹30,000 across all Anthropic & OpenAI API endpoints with automatic throttle at 90%.',
    appliesTo: 'Global AI Control Plane',
    monthlyCapINR: 30000,
    currentBurnINR: 18420,
    isEnabled: true,
    triggeredCountMonth: 0
  }
];

export const mockAIPrompts: AIPromptRecord[] = [
  {
    id: 'PRM-001',
    name: 'Email RFQ & Schedule Extraction',
    feature: 'Email Intake',
    currentVersion: 'v11.4',
    lastEditedBy: 'Anjali Menon',
    lastEditedAt: '12 Aug 2026',
    status: 'Production',
    promptText: `You are the lead technical estimator for Kiran Cable Protection Products Pvt. Ltd.
Analyze the incoming client email text and extract structured RFQ specifications.
Identify: Customer name, contact, product part numbers (KU-SLV, KU-BRD, KU-HST, KU-VAR), quantity, UOM, delivery dates, target prices, and payment terms.
Return confidence scores for each extracted field.`
  },
  {
    id: 'PRM-002',
    name: 'Quotation Commercial Terms & Letterhead Narration',
    feature: 'Quotation drafting',
    currentVersion: 'v12.0',
    lastEditedBy: 'Anjali Menon',
    lastEditedAt: '18 Aug 2026',
    status: 'Pending Approval',
    pendingApprover: 'Rajesh Kumar (HOD Sales)',
    promptText: `Draft official commercial quotation terms on Kiran letterhead according to Indian GST standards and customer payment history.
Include Ex-Works vs FOR terms, delivery schedule, payment credit period, and standard 15-day validity.`,
    previousVersionText: `Draft commercial terms with standard 30 day credit and Ex-Works Secunderabad.`
  }
];
