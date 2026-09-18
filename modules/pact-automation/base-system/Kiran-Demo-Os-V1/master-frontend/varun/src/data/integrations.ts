import { IntegrationRecord } from '../types';

export const mockIntegrations: IntegrationRecord[] = [
  {
    id: 'INT-001',
    name: 'PACT ERP (Production Primary)',
    category: 'ERP & Core Operations',
    status: 'Connected',
    lastSyncTime: '4 min ago',
    recordsIn: 842,
    recordsOut: 640,
    errorCount: 0,
    description: 'Current production ERP system managing General Ledger, Inventory Batches, Machine Work Orders, and Invoicing.',
    syncLagNotice: 'Sync is operational. Note: Advance requisition posting to PACT GL can take 3 to 7 business days due to legacy batch queue.'
  },
  {
    id: 'INT-002',
    name: 'SAP S/4HANA Cloud (Migration Target)',
    category: 'Enterprise ERP',
    status: 'Migration planned',
    lastSyncTime: 'Staging sync 2 hours ago',
    recordsIn: 120,
    recordsOut: 45,
    errorCount: 1,
    description: 'Target enterprise ERP migrating in Q4 2026. Complete API connectors and field translation tables are 68% complete.',
    sapChecklist: [
      { item: 'Customer Master & GSTIN Multi-Tax Table', isReady: true },
      { item: 'Material Master & 40+ Product BOM Configurations', isReady: true },
      { item: 'Vendor Master & MSME Classifications', isReady: false },
      { item: 'Financial Chart of Accounts & Cost Centers', isReady: true },
      { item: 'Real-time Webhook Dispatch & ASN Trigger', isReady: false }
    ]
  },
  {
    id: 'INT-003',
    name: 'Google Workspace (Gmail & Drive)',
    category: 'Communication & Documents',
    status: 'Connected',
    lastSyncTime: 'Real-time Webhook (1 min ago)',
    recordsIn: 3420,
    recordsOut: 1120,
    errorCount: 0,
    description: 'Ingests inbound emails from sales@, dispatch@, and accounts@ into AI intake pipeline, and stores signed drawings in Google Drive.'
  },
  {
    id: 'INT-004',
    name: 'HDFC Corporate Bank Statement Feed',
    category: 'Banking & Treasury',
    status: 'Connected',
    lastSyncTime: 'Today 06:00 AM IST',
    recordsIn: 18,
    recordsOut: 0,
    errorCount: 0,
    description: 'Automated Host-to-Host MT940 statement feed for daily bank reconciliation and automated NEFT/RTGS UTR logging.'
  },
  {
    id: 'INT-005',
    name: 'ClickUp Operations Workspace',
    category: 'Task Management',
    status: 'Connected',
    lastSyncTime: '15 min ago',
    recordsIn: 140,
    recordsOut: 85,
    errorCount: 0,
    description: 'Legacy task management connector transitioning into KiranOS native project & task boards.'
  },
  {
    id: 'INT-006',
    name: 'ERPNext Open Source Framework',
    category: 'Base Architecture',
    status: 'Connected',
    lastSyncTime: 'Active System Service',
    recordsIn: 4120,
    recordsOut: 4120,
    errorCount: 0,
    description: 'Underlying data schema layer providing standard doctypes for Item, Customer, Purchase Order, and Delivery Note.'
  },
  {
    id: 'INT-007',
    name: 'WhatsApp Business API (Gupshup)',
    category: 'Customer Messaging',
    status: 'Available',
    lastSyncTime: 'Not configured',
    recordsIn: 0,
    recordsOut: 0,
    errorCount: 0,
    description: 'Optional messaging gateway for sending automated ASN tracking links and invoice PDFs to client logistics coordinators.'
  }
];

export const mockPactFieldMappings = [
  { kiranField: 'rfq.customer_code', remoteField: 'CUST_MST.CUST_CD', direction: 'Inbound', lastError: undefined },
  { kiranField: 'rfq.part_number', remoteField: 'ITM_MST.PART_NO', direction: 'Inbound', lastError: undefined },
  { kiranField: 'quotation.offered_rate', remoteField: 'QTN_DET.RATE_PER_UOM', direction: 'Outbound', lastError: undefined },
  { kiranField: 'sales_order.po_number', remoteField: 'SO_HDR.CUST_PO_NO', direction: 'Bidirectional', lastError: undefined },
  { kiranField: 'sales_order.cut_length', remoteField: 'WO_DET.CUT_LEN_MM', direction: 'Outbound', lastError: undefined },
  { kiranField: 'dispatch.vehicle_number', remoteField: 'DC_HDR.VEHICLE_NO', direction: 'Outbound', lastError: undefined },
  { kiranField: 'accounts.utr_number', remoteField: 'BNK_TRX.UTR_REF_NO', direction: 'Inbound', lastError: undefined },
  { kiranField: 'requisition.amount', remoteField: 'GL_VOUCHER.DEBIT_AMT', direction: 'Outbound', lastError: '7-day lag in PACT batch queue' }
];

export const mockSapChecklist = [
  { module: 'Customer & GSTIN Master', passed: true, status: 'Ready' },
  { module: 'Material Master & BOM', passed: true, status: 'Ready' },
  { module: 'Vendor Master & MSME', passed: false, status: 'Mapping required' },
  { module: 'Chart of Accounts', passed: true, status: 'Ready' },
  { module: 'Dispatch & ASN Webhooks', passed: false, status: 'Testing required' }
];
