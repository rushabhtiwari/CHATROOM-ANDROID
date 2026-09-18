import { AdvanceRequisition, DepartmentBudget } from '../types';

export const mockRequisitions: AdvanceRequisition[] = [
  {
    id: 'REQ-2026-0219',
    reqNumber: 'REQ-2026-0219',
    raisedById: 'EMP-011',
    raisedByName: 'Suresh Pillai',
    department: 'Stores',
    purpose: 'Emergency local yarn purchase from Saint-Gobain depot',
    amount: 65000,
    attachmentsCount: 2,
    hasMissingBill: false,
    approvalLevel: 2,
    status: 'Submitted',
    pactSyncStatus: 'Awaiting PACT sync (day 3 of 7)',
    ageDays: 1
  },
  {
    id: 'REQ-2026-0214',
    reqNumber: 'REQ-2026-0214',
    raisedById: 'EMP-002',
    raisedByName: 'Priya Nair',
    department: 'Sales',
    purpose: 'Customer technical audit visit to Alstom Sri City plant',
    amount: 32000,
    attachmentsCount: 0,
    hasMissingBill: true,
    missingBillNotice: 'Auto-email requesting hotel & taxi tax invoice copies sent to Priya Nair on 17 Aug. No response.',
    approvalLevel: 1,
    status: 'Submitted',
    pactSyncStatus: 'Awaiting PACT sync (day 3 of 7)',
    ageDays: 3
  },
  {
    id: 'REQ-2026-0208',
    reqNumber: 'REQ-2026-0208',
    raisedById: 'EMP-005',
    raisedByName: 'Vikram Shetty',
    department: 'Production',
    purpose: 'Spares overhaul for Braiding Machine 4 hydraulic tensioner',
    amount: 88000,
    attachmentsCount: 3,
    hasMissingBill: false,
    approvalLevel: 3,
    status: 'Approved',
    pactSyncStatus: 'Posted to PACT',
    ageDays: 5
  },
  {
    id: 'REQ-2026-0188',
    reqNumber: 'REQ-2026-0188',
    raisedById: 'EMP-003',
    raisedByName: 'Amit Deshmukh',
    department: 'Sales',
    purpose: 'West Zone auto-cluster client roadshow (Pune & Sanand)',
    amount: 24000,
    attachmentsCount: 1,
    hasMissingBill: true,
    missingBillNotice: 'Fuel vouchers and hotel GST invoice pending submission since 28 July.',
    approvalLevel: 1,
    status: 'Approved',
    pactSyncStatus: 'Posted to PACT',
    ageDays: 22,
    priorUnsettledAmount: 24000,
    priorUnsettledReqNo: 'REQ-2026-0188'
  }
];

export const mockDepartmentBudgets: DepartmentBudget[] = [
  {
    department: 'Sales',
    allocated: 450000,
    spent: 312000,
    remaining: 138000,
    isLocked: false,
    pendingBillsCount: 2
  },
  {
    department: 'Production',
    allocated: 1200000,
    spent: 1040000,
    remaining: 160000,
    isLocked: false,
    pendingBillsCount: 1
  },
  {
    department: 'Stores',
    allocated: 300000,
    spent: 245000,
    remaining: 55000,
    isLocked: false,
    pendingBillsCount: 0
  },
  {
    department: 'Purchase',
    allocated: 250000,
    spent: 180000,
    remaining: 70000,
    isLocked: false,
    pendingBillsCount: 0
  },
  {
    department: 'Quality',
    allocated: 180000,
    spent: 110000,
    remaining: 70000,
    isLocked: false,
    pendingBillsCount: 0
  },
  {
    department: 'Projects',
    allocated: 350000,
    spent: 290000,
    remaining: 60000,
    isLocked: false,
    pendingBillsCount: 0
  }
];
