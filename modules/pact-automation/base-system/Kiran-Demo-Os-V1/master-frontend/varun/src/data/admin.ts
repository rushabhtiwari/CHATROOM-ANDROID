import { AdminUser, AuditLogRecord } from '../types';

export const mockAdminUsers: AdminUser[] = [
  { id: 'USR-001', name: 'Rajesh Kumar', email: 'rajesh.kumar@kiranudyog.com', role: 'Head of Sales', department: 'Sales', region: 'National', isHOD: true, lastActive: '2 min ago', status: 'Active' },
  { id: 'USR-002', name: 'Priya Nair', email: 'priya.nair@kiranudyog.com', role: 'Sales Executive (South)', department: 'Sales', region: 'South', isHOD: false, lastActive: '14 min ago', status: 'Active' },
  { id: 'USR-003', name: 'Amit Deshmukh', email: 'amit.deshmukh@kiranudyog.com', role: 'Sales Executive (West)', department: 'Sales', region: 'West', isHOD: false, lastActive: '1 hour ago', status: 'Active' },
  { id: 'USR-004', name: 'Sunita Rao', email: 'sunita.rao@kiranudyog.com', role: 'CRM & Lead Manager', department: 'CRM', region: 'National', isHOD: false, lastActive: '30 min ago', status: 'Active' },
  { id: 'USR-005', name: 'Vikram Shetty', email: 'vikram.shetty@kiranudyog.com', role: 'Production Head', department: 'Production', isHOD: true, lastActive: '5 min ago', status: 'Active' },
  { id: 'USR-006', name: 'Neha Joshi', email: 'neha.joshi@kiranudyog.com', role: 'Planning Lead', department: 'Planning', isHOD: false, lastActive: '22 min ago', status: 'Active' },
  { id: 'USR-007', name: 'Farhan Sheikh', email: 'farhan.sheikh@kiranudyog.com', role: 'Purchase Head', department: 'Purchase', isHOD: true, lastActive: '45 min ago', status: 'Active' },
  { id: 'USR-008', name: 'Meera Iyer', email: 'meera.iyer@kiranudyog.com', role: 'Accounts Head', department: 'Accounts', isHOD: true, lastActive: '10 min ago', status: 'Active' },
  { id: 'USR-009', name: 'Karthik Reddy', email: 'karthik.reddy@kiranudyog.com', role: 'Dispatch Lead', department: 'Dispatch', isHOD: true, lastActive: '8 min ago', status: 'Active' },
  { id: 'USR-010', name: 'Anjali Menon', email: 'anjali.menon@kiranudyog.com', role: 'Projects & ERP Lead', department: 'Projects', isHOD: false, lastActive: 'Just now', status: 'Active' }
];

export const mockRoleMatrix = [
  { module: 'Email Intake', sales: 'View & Edit', operations: 'View', finance: 'View', admin: 'Full Admin' },
  { module: 'RFQs & Costing', sales: 'Create & Edit', operations: 'Costing Edit', finance: 'View', admin: 'Full Admin' },
  { module: 'Quotations', sales: 'Draft & Send (HOD)', operations: 'View', finance: 'View', admin: 'Full Admin' },
  { module: 'Sales Orders', sales: 'Create & View', operations: 'View & Schedule', finance: 'View', admin: 'Full Admin' },
  { module: 'Dispatch & SLD', sales: 'View', operations: 'Create SLD', finance: 'Release Lock', admin: 'Full Admin' },
  { module: 'Accounts & Rec', sales: 'View Overdue', operations: 'No Access', finance: 'Full Manage', admin: 'Full Admin' },
  { module: 'Purchase & GRN', sales: 'View', operations: 'Full Manage', finance: 'Pass Invoice', admin: 'Full Admin' },
  { module: 'AI Control Plane', sales: 'View Prompts', operations: 'View Runs', finance: 'View Costs', admin: 'Full Admin' }
];

export const mockRegionalRules = [
  { region: 'West Zone (Maharashtra, Gujarat, Goa)', primaryOwner: 'Amit Deshmukh (Sales Executive)', fallback: 'Rajesh Kumar' },
  { region: 'South Zone (Telangana, Karnataka, Tamil Nadu, AP, Kerala)', primaryOwner: 'Priya Nair (Sales Executive)', fallback: 'Rajesh Kumar' },
  { region: 'North & East Zone (Delhi NCR, UP, Haryana, Punjab, West Bengal)', primaryOwner: 'Rajesh Kumar (Head of Sales)', fallback: 'Sunita Rao' },
  { region: 'Unmatched / New Customer Domain', primaryOwner: 'Sunita Rao (CRM & Lead Manager)', fallback: 'Rajesh Kumar' }
];

export const mockEscalationMatrixGrid = [
  {
    trigger: 'Quotation Deadline Breached (No quote in 48h)',
    l1: 'Sales Executive (0 - 24h)',
    l2: 'Head of Sales (24 - 48h)',
    l3: 'Managing Director (> 48h)',
    l4: 'Board Review'
  },
  {
    trigger: 'Stop-Dispatch Customer Shipment Hold',
    l1: 'Dispatch Lead (0 - 4h)',
    l2: 'Head of Sales (4 - 8h)',
    l3: 'Accounts Head (8 - 24h)',
    l4: 'Managing Director (> 24h)'
  },
  {
    trigger: '3-Way Match GRN Discrepancy (>₹25,000)',
    l1: 'Purchase Executive (0 - 24h)',
    l2: 'Purchase Head (24 - 48h)',
    l3: 'Accounts Head (48 - 72h)',
    l4: 'Managing Director (> 72h)'
  },
  {
    trigger: 'Advance Requisition Missing Bill (>15 days)',
    l1: 'Requester (0 - 7 days)',
    l2: 'Department HOD (7 - 14 days)',
    l3: 'Accounts Head (15 - 21 days)',
    l4: 'ERP Account Lockout (> 21 days)'
  }
];

export const mockEscalationMatrix = mockEscalationMatrixGrid.map((row, index) => ({
  triggerType: row.trigger,
  department: ['Sales', 'Dispatch', 'Purchase', 'Accounts'][index],
  l1: { role: row.l1.split(' (')[0], timeBeforeEscalate: row.l1.match(/\(([^)]+)\)/)?.[1] || '' },
  l2: { role: row.l2.split(' (')[0], timeBeforeEscalate: row.l2.match(/\(([^)]+)\)/)?.[1] || '' },
  l3: { role: row.l3.split(' (')[0], timeBeforeEscalate: row.l3.match(/\(([^)]+)\)/)?.[1] || '' },
  l4: { role: row.l4.split(' (')[0], timeBeforeEscalate: row.l4.match(/\(([^)]+)\)/)?.[1] || '' }
}));

export const mockAuditLogs: AuditLogRecord[] = [
  {
    id: 'AUD-901',
    timestamp: '19 Aug 2026, 06:14:15 IST',
    actorType: 'agent',
    actorName: 'claude-sonnet-4-6 (AI)',
    action: 'Auto-created RFQ-2026-0418 from inbound email',
    recordType: 'RFQ',
    recordId: 'RFQ-2026-0418',
    beforeValue: 'None',
    afterValue: 'Status: Under review, Customer: Motherson Sumi',
    ipAddress: '10.0.4.12 (Internal AI Pipeline)'
  },
  {
    id: 'AUD-902',
    timestamp: '18 Aug 2026, 17:30:10 IST',
    actorType: 'person',
    actorName: 'Anjali Menon',
    action: 'Updated Prompt Version for Quotation Drafting',
    recordType: 'AIPrompt',
    recordId: 'PRM-002',
    beforeValue: 'Version: v11.4',
    afterValue: 'Version: v12.0 (Pending HOD Approval)',
    ipAddress: '192.168.1.45'
  },
  {
    id: 'AUD-903',
    timestamp: '18 Aug 2026, 15:40:22 IST',
    actorType: 'person',
    actorName: 'Meera Iyer',
    action: 'Applied Stop-Dispatch hold on Customer CUST-001',
    recordType: 'Customer',
    recordId: 'CUST-001',
    beforeValue: 'stopDispatch: false',
    afterValue: 'stopDispatch: true (Overdue: ₹8,42,150 beyond 60d)',
    ipAddress: '192.168.1.18'
  },
  {
    id: 'AUD-904',
    timestamp: '18 Aug 2026, 14:15:00 IST',
    actorType: 'agent',
    actorName: 'claude-haiku-4-5 (AI)',
    action: 'Reset SLA Deadline for RFQ-2026-0418 to 22 Aug',
    recordType: 'RFQ',
    recordId: 'RFQ-2026-0418',
    beforeValue: 'Deadline: 19 Aug 2026 (Production)',
    afterValue: 'Deadline: 22 Aug 2026 (Planning)',
    ipAddress: '10.0.4.12'
  },
  {
    id: 'AUD-905',
    timestamp: '18 Aug 2026, 11:45:12 IST',
    actorType: 'person',
    actorName: 'Rajesh Kumar',
    action: 'Approved Price Increase of 8.4% on QTE-2026-0812',
    recordType: 'Quotation',
    recordId: 'QTE-2026-0812',
    beforeValue: 'status: Awaiting HOD',
    afterValue: 'status: Sent to Customer',
    ipAddress: '192.168.1.10'
  }
];
