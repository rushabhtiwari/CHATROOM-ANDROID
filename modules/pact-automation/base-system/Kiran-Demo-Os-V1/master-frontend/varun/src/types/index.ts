export type Department = 
  | 'Sales' 
  | 'CRM' 
  | 'Production' 
  | 'Planning' 
  | 'Stores' 
  | 'Purchase' 
  | 'Quality' 
  | 'Dispatch' 
  | 'Accounts' 
  | 'Projects' 
  | 'HR';

export type StatusVariant = 
  | 'On track' 
  | 'At risk' 
  | 'Overdue' 
  | 'Blocked' 
  | 'Awaiting approval' 
  | 'Closed'
  | 'Draft'
  | 'Won'
  | 'Lost';

export interface Customer {
  id: string;
  name: string;
  code: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  region: 'West' | 'South' | 'North' | 'East';
  city: string;
  state: string;
  creditLimit: number;
  availableBalance: number;
  outstanding: number;
  overdueAmount: number;
  stopDispatch: boolean;
  stopDispatchReason?: string;
  lastOrders: {
    poNumber: string;
    date: string;
    amount: number;
    status: string;
  }[];
}

export interface Product {
  id: string;
  partNumber: string;
  name: string;
  description: string;
  category: 'Fiberglass' | 'Silicone' | 'Acrylic' | 'Braided' | 'Heat-shrink' | 'Varnished' | 'PU' | 'Tubing';
  standardPrice: number;
  hsnCode: string;
  gstRate: number;
  uom: string;
  defaultCutLength: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  department: Department;
  region?: string;
  email: string;
  avatar: string;
  isHOD: boolean;
  standingScore: number;
  negativePoints: number;
  warningsCount: number;
}

export interface TimelineEvent {
  id: string;
  actorType: 'person' | 'ai';
  actorName: string;
  avatar?: string;
  action: string;
  detail?: string;
  timestamp: string;
  confidence?: number;
  modelUsed?: string;
}

export interface EmailExtraction {
  customer: string;
  contact: string;
  partNumber: string;
  description: string;
  quantity: string;
  uom: string;
  targetPrice: string;
  specification: string;
  sopDate: string;
  deliveryLocation: string;
  paymentTerms: string;
  fieldConfidences: Record<string, number>;
  fieldOrigins: Record<string, string>; // Source phrases in email
}

export interface EmailIntakeItem {
  id: string;
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  subject: string;
  preview: string;
  body: string;
  receivedAt: string;
  intent: 'RFQ' | 'Schedule' | 'PO' | 'Payment query' | 'Complaint';
  confidence: number;
  status: 'Needs review' | 'Auto-created' | 'Unknown customer' | 'Duplicates merged' | 'Not an RFQ' | 'Failed extraction';
  mailbox: 'sales@kiranudyog.com' | 'dispatch@kiranudyog.com' | 'accounts@kiranudyog.com';
  attachments: { name: string; size: string; type: string }[];
  isAIProcessed: boolean;
  extractedData: EmailExtraction;
  matchedCustomerId?: string;
  linkedRfqId?: string;
  replyDraft?: {
    subject: string;
    body: string;
    model: string;
    needsHODApproval: boolean;
  };
}

export interface RFQItem {
  id: string;
  rfqNumber: string;
  customerId: string;
  customerName: string;
  partNumber: string;
  description: string;
  quantity: number;
  uom: string;
  targetPrice?: number;
  sopDate: string;
  region: string;
  ownerId: string;
  ownerName: string;
  stage: 'New' | 'Under review' | 'Costing' | 'Quoted' | 'Negotiation' | 'Won' | 'Lost';
  status: 'On track' | 'At risk' | 'Overdue' | 'Blocked' | 'Awaiting approval' | 'Closed';
  daysInStage: number;
  slaLimitDays: number;
  estimatedValue: number;
  source: 'Email' | 'Manual' | 'Portal';
  isAICreated: boolean;
  createdDate: string;
  deadlineDate: string;
  missingMandatoryFields: string[];
  costing?: {
    material: string;
    cutLength: string;
    rate: number;
    marginPct: number;
    laborCost: number;
    packagingCost: number;
  };
  quotations: {
    quoteNumber: string;
    version: string;
    value: number;
    status: string;
    date: string;
  }[];
  samples: {
    sampleNumber: string;
    date: string;
    status: string;
  }[];
  documents: {
    name: string;
    size: string;
    type: string;
    uploadedAt: string;
  }[];
  routingHops: {
    department: Department;
    owner: string;
    deadline: string;
    isCurrent: boolean;
    status: 'completed' | 'current' | 'pending';
  }[];
  timeline: TimelineEvent[];
}

export interface QuotationLineItem {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  uom: string;
  standardPrice: number;
  offeredPrice: number;
  discountPct: number;
  marginPct: number;
  hsnCode: string;
  gstRate: number;
  deliveryWeeks: number;
  isPriceAboveStandard: boolean;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  rfqId: string;
  rfqNumber: string;
  customerId: string;
  customerName: string;
  contactPerson: string;
  contactEmail: string;
  items: QuotationLineItem[];
  totalValue: number;
  totalGst: number;
  grandTotal: number;
  marginPct: number;
  status: 'Draft' | 'Awaiting HOD' | 'Sent' | 'Under negotiation' | 'Accepted' | 'Lost' | 'Expired';
  sentAt?: string;
  validTill: string;
  followUpsSent: number;
  isExpiringSoon: boolean; // <5 days
  hasPriceIncrease: boolean;
  priceIncreasePct: number;
  approvalRequiredBy?: string;
  commercialTerms: string;
  paymentTerms: string;
  freightTerms: string;
  createdAt: string;
}

export interface SampleRequest {
  id: string;
  sampleNumber: string;
  rfqId: string;
  rfqNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  customerId: string;
  customerName: string;
  partNumber: string;
  quantity: number;
  uom: string;
  requestedById: string;
  requestedByName: string;
  status: 'Requested' | 'Approved' | 'In production' | 'Dispatched' | 'Feedback awaited' | 'Approved by customer' | 'Rejected';
  daysPending: number;
  courierTracking?: string;
  remarks: string;
  createdAt: string;
}

export interface SalesOrder {
  id: string;
  poNumber: string;
  customerId: string;
  customerName: string;
  linkedRfqId: string;
  linkedRfqNumber: string;
  product: string;
  partNumber: string;
  poQty: number;
  executedQty: number;
  balanceQty: number;
  poValue: number;
  executedValue: number;
  balanceValue: number;
  scheduleType: 'Monthly schedule' | 'Single PU';
  nextDeliveryDate: string;
  status: 'Active' | 'Partially Executed' | 'Completed' | 'Pending Production';
  orderDate: string;
  weeklyBuckets: {
    week: string;
    qty: number;
    status: 'Scheduled' | 'In Production' | 'Dispatched' | 'Delivered';
  }[];
  workOrders: {
    id: string;
    cutLength: string;
    quantity: number;
    status: 'Queued' | 'Running' | 'Completed';
    machine: string;
  }[];
  dispatches: {
    invoiceNo: string;
    date: string;
    qty: number;
    amount: number;
  }[];
}

export interface DispatchItem {
  id: string;
  dispatchNumber: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  product: string;
  partNumber: string;
  quantity: number;
  uom: string;
  value: number;
  vehicleNumber: string;
  stage: 'SLD generated' | 'Invoice raised' | 'ASN linked' | 'Dispatched' | 'POD/GRN pending' | 'Closed';
  acknowledgementStatus: 'Sent' | 'Delivered' | 'Acknowledged' | 'No response - 3 days';
  sldDate: string;
  invoiceDate?: string;
  asnNumber?: string;
  asnConfidence?: number;
  podStatus: 'Pending' | 'Uploaded' | 'Verified';
  remindersSent: number;
  nextReminderDate?: string;
  stopDispatchBlocked: boolean;
  overdueAmountCustomer: number;
  carrier: string;
  destination: string;
}

export interface ApprovalItem {
  id: string;
  type: 'Price increase' | 'Purchase order' | 'Requisition' | 'Budget top-up' | 'Stop-dispatch release' | 'Sample approval' | 'Vendor onboarding' | 'Prompt change';
  subject: string;
  requesterId: string;
  requesterName: string;
  department: Department;
  value?: number;
  createdAt: string;
  ageHours: number;
  slaHours: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  isAcknowledged: boolean; // "Seen"
  signOffChain: {
    role: string;
    person: string;
    status: 'approved' | 'current' | 'pending';
    signedAt?: string;
  }[];
  contextSummary: string;
  referenceId: string;
  referenceLink: string;
}

export interface ReportItem {
  id: string;
  name: string;
  description: string;
  category: 'Sales' | 'Purchase' | 'Accounts' | 'Projects';
  schedule: string;
  lastRunAt: string;
  recipients: string[];
  aiSummary: {
    points: string[];
    generatedByModel: string;
    generatedAt: string;
  };
}

export interface BankStatementLine {
  id: string;
  date: string;
  description: string;
  referenceNo: string;
  debit?: number;
  credit?: number;
  balance: number;
  matchedBookEntryId?: string;
  isMatched: boolean;
  aiSuggestedReason?: string;
}

export interface BookEntry {
  id: string;
  date: string;
  voucherNo: string;
  particulars: string;
  account: string;
  debit?: number;
  credit?: number;
  isMatched: boolean;
}

export interface ReceivableCustomer {
  customerId: string;
  customerName: string;
  region: string;
  totalReceivable: number;
  buckets: {
    b0_30: number;
    b31_45: number;
    b46_60: number;
    b61_90: number;
    b90_plus: number;
  };
  overdueAmount: number;
  lastReminderSent: string;
  remindersCount: number;
  nextScheduled: string;
  reminderFrequencyDays: number;
  collectionStatus: 'On track' | 'At risk' | 'Overdue';
}

export interface PayableVendor {
  vendorId: string;
  vendorName: string;
  billsCount: number;
  totalOutstanding: number;
  dueThisWeek: number;
  overdueAmount: number;
  creditDays: number;
  daysOldestBill: number;
  is40DayAlert: boolean;
  proposedForPayment: boolean;
  paymentRunDate: string;
  utrStatus: 'UTR sent to vendor' | 'Queued' | 'Processing';
  utrNumber?: string;
  utrMailSentAt?: string;
}

export interface AdvanceRequisition {
  id: string;
  reqNumber: string;
  raisedById: string;
  raisedByName: string;
  department: Department;
  purpose: string;
  amount: number;
  attachmentsCount: number;
  hasMissingBill: boolean;
  missingBillNotice?: string;
  approvalLevel: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Posted to PACT';
  pactSyncStatus: 'Posted to PACT' | 'Awaiting PACT sync (day 3 of 7)';
  ageDays: number;
  priorUnsettledAmount?: number;
  priorUnsettledReqNo?: string;
}

export interface DepartmentBudget {
  department: Department;
  allocated: number;
  spent: number;
  remaining: number;
  isLocked: boolean;
  pendingBillsCount: number;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  item: string;
  partNumber: string;
  quantity: number;
  uom: string;
  department: Department;
  costCenter: string;
  suggestedVendor: string;
  estimatedValue: number;
  isAutoPopulatedMRP: boolean;
  approvalRoute: string;
  status: 'Pending HOD' | 'Approved' | 'RFQ Sent' | 'PO Created';
  createdAt: string;
}

export interface VendorComparison {
  rfqId: string;
  rfqNumber: string;
  materialName: string;
  quantity: number;
  uom: string;
  vendors: {
    vendorName: string;
    price: number;
    deliveryWeeks: number;
    discountPct: number;
    paymentTerms: string;
    isBestPrice?: boolean;
    isBestDelivery?: boolean;
  }[];
  recommendedVendor: string;
  aiRecommendationReason: string;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  item: string;
  quantity: number;
  uom: string;
  value: number;
  deliveryDate: string;
  grnStatus: 'Pending' | 'Partially Received' | 'Received' | '3-Way Match Verified';
  sentToVendorAt: string;
  status: 'Open' | 'In Transit' | 'Completed' | 'Delayed';
}

export interface ThreeWayMatchRecord {
  id: string;
  grnNumber: string;
  poNumber: string;
  invoiceNumber: string;
  vendorName: string;
  item: string;
  poQty: number;
  grnQty: number;
  deliveredQty?: number;
  invoiceQty: number;
  poRate: number;
  invoiceRate: number;
  totalValue: number;
  status: 'Matched' | 'Exception';
  exceptions: {
    type: 'Quantity Mismatch' | 'Rate Mismatch' | 'Tax Discrepancy';
    deltaText: string;
    aiExplanation: string;
  }[];
}

export interface CommsMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  timestamp: string;
  content: string;
  referencedRecord?: {
    type: 'RFQ' | 'Customer' | 'Order' | 'PO';
    id: string;
    title: string;
    subtitle: string;
  };
  detectedCommitment?: {
    person: string;
    promise: string;
    dueDate: string;
    isReminderSet: boolean;
  };
}

export interface CommsChannel {
  id: string;
  name: string;
  type: 'department' | 'customer' | 'order';
  badgeCount?: number;
  referenceRecord?: {
    type: string;
    id: string;
    title: string;
    status: string;
    amount?: number;
    owner?: string;
  };
  messages: CommsMessage[];
}

export interface TrackedCommitment {
  id: string;
  personName: string;
  department: Department;
  description: string;
  promisedByDate: string;
  sourceMessage: string;
  sourceChannel: string;
  status: 'Pending' | 'Reminded' | 'Completed' | 'Missed';
  remindersSent: number;
  lastReminderSentAt?: string;
}

export interface EscalationRecord {
  id: string;
  severity: 'Critical' | 'High' | 'Medium';
  triggerReason: 'Deadline missed' | 'Task not completed' | 'Customer waiting' | 'Production cannot meet date' | 'Approval pending';
  recordType: 'RFQ' | 'Sales Order' | 'Dispatch' | 'Requisition' | 'Purchase Order';
  recordId: string;
  recordTitle: string;
  currentLevel: 'L1' | 'L2' | 'L3' | 'L4';
  currentRole: string;
  timeAtLevel: string;
  nextAutoEscalateAt: string;
  history: {
    level: string;
    role: string;
    escalatedAt: string;
    reason: string;
  }[];
}

export interface AIModelRecord {
  id: string;
  name: string;
  provider: string;
  assignedFeatures: string[];
  contextWindow: string;
  inputRateUSD: number;
  outputRateUSD: number;
  monthlySpendINR: number;
  avgLatencySec: number;
  successRatePct: number;
  fallbackModel: string;
  status: 'Active' | 'Standby';
  config: {
    temperature: number;
    maxTokens: number;
    timeoutSec: number;
    retryPolicy: string;
    rateLimit: string;
  };
}

export interface AIRunTraceStep {
  name: string;
  durationMs: number;
  tokens?: number;
  payload: any;
  status: 'success' | 'warning' | 'error';
}

export interface AIRunLogRecord {
  id: string;
  runId: string;
  feature: string;
  trigger: 'Email received' | 'Schedule' | 'User action' | 'Webhook';
  model: string;
  status: 'Success' | 'Failed' | 'Retried' | 'Blocked by guardrail';
  durationSec: number;
  tokensUsed: number;
  costINR: number;
  confidencePct: number;
  humanReview: 'Approved' | 'Corrected' | 'Rejected' | 'Not required';
  timestamp: string;
  systemPromptVersion: string;
  guardrailsChecked: { name: string; passed: boolean; reason?: string }[];
  toolsCalled: { tool: string; args: any; result: any }[];
  output: string;
  humanCorrection?: string;
  traceSteps: AIRunTraceStep[];
}

export interface AIGuardrailRecord {
  id: string;
  name: string;
  category: 'Approval gates' | 'Confidence thresholds' | 'Data protection' | 'Spend limits';
  description: string;
  appliesTo: string;
  requiredApprover?: string;
  isEnabled: boolean;
  triggeredCountMonth: number;
  thresholdPct?: number;
  monthlyCapINR?: number;
  currentBurnINR?: number;
  scope?: string;
  threshold?: string;
  action?: string;
}

export interface AIPromptRecord {
  id: string;
  name: string;
  feature: string;
  currentVersion: string;
  lastEditedBy: string;
  lastEditedAt: string;
  status: 'Production' | 'Pending Approval' | 'Draft';
  pendingApprover?: string;
  promptText: string;
  previousVersionText?: string;
}

export interface AutomationRecord {
  id: string;
  name: string;
  department: Department;
  triggerText: string;
  conditionsText: string;
  actionsText: string;
  readableSentence: string;
  runsThisMonth: number;
  successRatePct: number;
  owner: string;
  isEnabled: boolean;
  runHistory: {
    id: string;
    timestamp: string;
    status: 'Success' | 'Failed';
    summary: string;
  }[];
}

export interface IntegrationRecord {
  id: string;
  name: string;
  category: string;
  status: 'Connected' | 'Warning' | 'Migration planned' | 'Available';
  lastSyncTime: string;
  recordsIn: number;
  recordsOut: number;
  errorCount: number;
  description: string;
  syncLagNotice?: string;
  sapChecklist?: { item: string; isReady: boolean }[];
  fieldMappings?: {
    kiranField: string;
    remoteField: string;
    direction: 'Bidirectional' | 'Inbound' | 'Outbound';
    lastError?: string;
  }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: Department;
  region?: string;
  isHOD: boolean;
  lastActive: string;
  status: 'Active' | 'Inactive';
  avatar?: string;
  accessTier?: string;
  spendingAuthorityLimit?: number;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actorType: 'person' | 'agent';
  actorName: string;
  action: string;
  recordType: string;
  recordId: string;
  beforeValue?: string;
  afterValue?: string;
  ipAddress: string;
}

export type AIModelRegistryItem = AIModelRecord;
export type AIRunLog = AIRunLogRecord;
export type AIPromptVersion = AIPromptRecord;
export type AIGuardrailPolicy = AIGuardrailRecord;
export type AutomationRule = AutomationRecord;
export type AuditLogEntry = AuditLogRecord;

export interface AIBlockedAction {
  id: string;
  timestamp: string;
  feature: string;
  reason: string;
  interceptedPayload: string;
  actionTaken: string;
}

export interface EscalationMatrixItem {
  triggerType: string;
  department: string;
  l1: { role: string; timeBeforeEscalate: string };
  l2: { role: string; timeBeforeEscalate: string };
  l3: { role: string; timeBeforeEscalate: string };
  l4: { role: string; timeBeforeEscalate: string };
}
