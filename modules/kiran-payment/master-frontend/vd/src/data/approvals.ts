import { ApprovalItem } from '../types';

export const mockApprovals: ApprovalItem[] = [
  {
    id: 'APP-001',
    type: 'Price increase',
    subject: 'Price increase of 8.4% on Quotation QTE-2026-0812 (Motherson Sumi)',
    requesterId: 'EMP-001',
    requesterName: 'Rajesh Kumar',
    department: 'Sales',
    value: 986250,
    createdAt: '2026-08-18T16:00:00+05:30',
    ageHours: 18,
    slaHours: 24,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'Sales Executive', person: 'Priya Nair', status: 'approved', signedAt: '18 Aug 15:30' },
      { role: 'Head of Sales (HOD)', person: 'Rajesh Kumar', status: 'current' },
      { role: 'Managing Director', person: 'K. S. Rao', status: 'pending' }
    ],
    contextSummary: 'Offered price for KU-SLV-0625-B is ₹30.35/m against standard ₹28.00/m due to special UL94 V-0 raw material formulation requested by Motherson.',
    referenceId: 'QTE-2026-0812',
    referenceLink: '/quotations/QTE-2026-0812'
  },
  {
    id: 'APP-002',
    type: 'Stop-dispatch release',
    subject: 'Emergency Dispatch Release for Motherson Sumi (SLD-2026-0812)',
    requesterId: 'EMP-009',
    requesterName: 'Karthik Reddy',
    department: 'Dispatch',
    value: 673611,
    createdAt: '2026-08-19T08:15:00+05:30',
    ageHours: 2,
    slaHours: 8,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'Dispatch Lead', person: 'Karthik Reddy', status: 'approved', signedAt: '19 Aug 08:15' },
      { role: 'Accounts Head (HOD)', person: 'Meera Iyer', status: 'current' }
    ],
    contextSummary: 'Motherson EV line assembly will stop without 25,000m sleeve batch. Sourcing has promised RTGS of ₹8,42,150 overdue balance by 21 Aug.',
    referenceId: 'DSP-2026-0812',
    referenceLink: '/dispatch/DSP-2026-0812'
  },
  {
    id: 'APP-003',
    type: 'Requisition',
    subject: 'Advance Requisition: Raw Fiber Yarn emergency procurement (REQ-2026-0219)',
    requesterId: 'EMP-011',
    requesterName: 'Suresh Pillai',
    department: 'Stores',
    value: 65000,
    createdAt: '2026-08-18T11:20:00+05:30',
    ageHours: 23,
    slaHours: 24,
    status: 'Pending',
    isAcknowledged: true,
    signOffChain: [
      { role: 'Stores Manager', person: 'Suresh Pillai', status: 'approved', signedAt: '18 Aug 11:20' },
      { role: 'Purchase Head', person: 'Farhan Sheikh', status: 'approved', signedAt: '18 Aug 14:00' },
      { role: 'Accounts Head', person: 'Meera Iyer', status: 'current' }
    ],
    contextSummary: 'Emergency purchase of 200kg E-Glass continuous yarn from Saint-Gobain Vetrotex local depot due to delayed container.',
    referenceId: 'REQ-2026-0219',
    referenceLink: '/requisitions'
  },
  {
    id: 'APP-004',
    type: 'Purchase order',
    subject: 'PO Approval: PO-PUR-2026-0914 for Dow Corning Silicone Emulsion',
    requesterId: 'EMP-007',
    requesterName: 'Farhan Sheikh',
    department: 'Purchase',
    value: 480000,
    createdAt: '2026-08-19T07:45:00+05:30',
    ageHours: 3,
    slaHours: 12,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'Purchase Executive', person: 'Farhan Sheikh', status: 'approved', signedAt: '19 Aug 07:45' },
      { role: 'Operations Head', person: 'Vikram Shetty', status: 'current' },
      { role: 'Accounts Head', person: 'Meera Iyer', status: 'pending' }
    ],
    contextSummary: 'Monthly batch procurement of 1,200kg high-viscosity silicone coating resin from authorized distributor.',
    referenceId: 'PO-PUR-2026-0914',
    referenceLink: '/purchase/orders'
  },
  {
    id: 'APP-005',
    type: 'Prompt change',
    subject: 'AI Prompt Update v12: Commercial Terms extraction for German customers',
    requesterId: 'EMP-010',
    requesterName: 'Anjali Menon',
    department: 'Projects',
    createdAt: '2026-08-18T17:30:00+05:30',
    ageHours: 17,
    slaHours: 48,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'AI Operations Lead', person: 'Anjali Menon', status: 'approved', signedAt: '18 Aug 17:30' },
      { role: 'Head of Sales (HOD)', person: 'Rajesh Kumar', status: 'current' }
    ],
    contextSummary: 'Updates regex and few-shot examples for European Incoterms (DAP / DDP) to prevent margin miscalculations in auto-drafting.',
    referenceId: 'PRM-002',
    referenceLink: '/ai/prompts'
  },
  {
    id: 'APP-006',
    type: 'Budget top-up',
    subject: 'Monthly Budget Top-up: Production Consumables +₹1,20,000',
    requesterId: 'EMP-005',
    requesterName: 'Vikram Shetty',
    department: 'Production',
    value: 120000,
    createdAt: '2026-08-17T14:00:00+05:30',
    ageHours: 44,
    slaHours: 48,
    status: 'Pending',
    isAcknowledged: true,
    signOffChain: [
      { role: 'Production Head', person: 'Vikram Shetty', status: 'approved', signedAt: '17 Aug 14:00' },
      { role: 'Accounts Head', person: 'Meera Iyer', status: 'current' }
    ],
    contextSummary: 'Additional cutting blade inserts and thermal thermocouple sensors required for high-volume 16mm braided run.',
    referenceId: 'BUD-2026-08-PROD',
    referenceLink: '/requisitions/budget'
  },
  {
    id: 'APP-007',
    type: 'Sample approval',
    subject: 'Sample Dispatch: 50m KU-SLV-0250-N for BSA Corporation (SMP-2026-0195)',
    requesterId: 'EMP-003',
    requesterName: 'Amit Deshmukh',
    department: 'Sales',
    createdAt: '2026-08-18T15:00:00+05:30',
    ageHours: 19,
    slaHours: 24,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'Sales Executive', person: 'Amit Deshmukh', status: 'approved', signedAt: '18 Aug 15:00' },
      { role: 'Head of Sales (HOD)', person: 'Rajesh Kumar', status: 'current' }
    ],
    contextSummary: 'Free-of-cost qualification sample for 2.8 lakh metre annual requirement.',
    referenceId: 'SMP-2026-0195',
    referenceLink: '/samples'
  },
  {
    id: 'APP-008',
    type: 'Vendor onboarding',
    subject: 'New Vendor Registration: PolyChem Emulsions Pvt Ltd (Surat)',
    requesterId: 'EMP-007',
    requesterName: 'Farhan Sheikh',
    department: 'Purchase',
    createdAt: '2026-08-17T09:30:00+05:30',
    ageHours: 49,
    slaHours: 48,
    status: 'Pending',
    isAcknowledged: false,
    signOffChain: [
      { role: 'Purchase Head', person: 'Farhan Sheikh', status: 'approved', signedAt: '17 Aug 09:30' },
      { role: 'Quality Head', person: 'Divya Agarwal', status: 'approved', signedAt: '17 Aug 16:00' },
      { role: 'Accounts Head', person: 'Meera Iyer', status: 'current' }
    ],
    contextSummary: 'Alternate domestic vendor for PU resin lacquer at 12% lower cost than current European supplier.',
    referenceId: 'VND-2026-044',
    referenceLink: '/purchase'
  }
];
