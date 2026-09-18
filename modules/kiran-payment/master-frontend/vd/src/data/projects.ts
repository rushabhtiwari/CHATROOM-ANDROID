import { ProjectRecord } from '../types';

export const mockProjects: ProjectRecord[] = [
  {
    id: 'PRJ-2026-001',
    name: 'SAP S/4HANA ERP Migration & Master Data Cutover',
    code: 'PRJ-SAP-2026',
    departmentChips: ['Projects', 'Accounts', 'Sales', 'Purchase', 'Production'],
    ownerId: 'EMP-010',
    ownerName: 'Anjali Menon',
    progressPct: 68,
    hoursAllocated: 1200,
    hoursSpent: 840,
    costToDate: 1850000,
    budget: 2500000,
    tasksOverdue: 2,
    lastUpdatedAt: '18 Aug 2026',
    isFresh: true,
    description: 'Transition from legacy PACT ERP to SAP S/4HANA Cloud with custom KiranOS connector interfaces and clean chart-of-accounts mapping.',
    tasks: [
      { id: 'TSK-101', title: 'Legacy PACT customer ledger reconciliation & opening balances', department: 'Accounts', assignee: 'Meera Iyer', dueDate: '22 Aug 2026', status: 'In Progress', hoursAllocated: 60, hoursActual: 45 },
      { id: 'TSK-102', title: 'Product master HSN & BOM routing validation (40+ product lines)', department: 'Production', assignee: 'Vikram Shetty', dueDate: '16 Aug 2026', status: 'Overdue', hoursAllocated: 80, hoursActual: 70 },
      { id: 'TSK-103', title: 'Vendor master GSTIN & MSME classification scrub', department: 'Purchase', assignee: 'Farhan Sheikh', dueDate: '15 Aug 2026', status: 'Overdue', hoursAllocated: 40, hoursActual: 30 },
      { id: 'TSK-104', title: 'API Gateway staging environment test with mock PO creation', department: 'Projects', assignee: 'Anjali Menon', dueDate: '25 Aug 2026', status: 'In Progress', hoursAllocated: 100, hoursActual: 65 },
      { id: 'TSK-105', title: 'Sales pricing master & customer discount matrices upload', department: 'Sales', assignee: 'Rajesh Kumar', dueDate: '10 Aug 2026', status: 'Completed', hoursAllocated: 50, hoursActual: 48 }
    ],
    members: [
      { id: 'EMP-010', name: 'Anjali Menon', department: 'Projects', complianceScore: 98, negativePoints: 0, warningsIssued: 0 },
      { id: 'EMP-008', name: 'Meera Iyer', department: 'Accounts', complianceScore: 99, negativePoints: 0, warningsIssued: 0 },
      { id: 'EMP-001', name: 'Rajesh Kumar', department: 'Sales', complianceScore: 98, negativePoints: 0, warningsIssued: 0 },
      { id: 'EMP-005', name: 'Vikram Shetty', department: 'Production', complianceScore: 94, negativePoints: 1, warningsIssued: 1 },
      { id: 'EMP-007', name: 'Farhan Sheikh', department: 'Purchase', complianceScore: 89, negativePoints: 4, warningsIssued: 2 }
    ],
    weeklyReports: [
      { week: 'Week 33 (11-15 Aug 2026)', generatedAt: '15 Aug 2026, 06:00 PM', url: '#' },
      { week: 'Week 32 (04-08 Aug 2026)', generatedAt: '08 Aug 2026, 06:00 PM', url: '#' },
      { week: 'Week 31 (28 Jul - 01 Aug 2026)', generatedAt: '01 Aug 2026, 06:00 PM', url: '#' }
    ]
  },
  {
    id: 'PRJ-2026-002',
    name: 'UL94 V-0 & Class H Sleeving Qualification for Global EV Programs',
    code: 'PRJ-UL-EV',
    departmentChips: ['Quality', 'Production', 'Sales'],
    ownerId: 'EMP-012',
    ownerName: 'Divya Agarwal',
    progressPct: 82,
    hoursAllocated: 600,
    hoursSpent: 510,
    costToDate: 720000,
    budget: 900000,
    tasksOverdue: 0,
    lastUpdatedAt: '19 Aug 2026',
    isFresh: true,
    description: 'Underwriters Laboratories (UL) thermal aging and flame retardancy certification for silicone coated sleeving series KU-SLV-0625 and KU-SLV-0800.',
    tasks: [
      { id: 'TSK-201', title: 'Third-party flame retardancy testing at CPRI Bangalore', department: 'Quality', assignee: 'Divya Agarwal', dueDate: '12 Aug 2026', status: 'Completed', hoursAllocated: 40, hoursActual: 38 },
      { id: 'TSK-202', title: 'Batch test reports consolidation for Motherson & Alstom audits', department: 'Quality', assignee: 'Divya Agarwal', dueDate: '24 Aug 2026', status: 'In Progress', hoursAllocated: 30, hoursActual: 15 }
    ],
    members: [
      { id: 'EMP-012', name: 'Divya Agarwal', department: 'Quality', complianceScore: 97, negativePoints: 0, warningsIssued: 0 },
      { id: 'EMP-005', name: 'Vikram Shetty', department: 'Production', complianceScore: 94, negativePoints: 1, warningsIssued: 1 }
    ],
    weeklyReports: [
      { week: 'Week 33 (11-15 Aug 2026)', generatedAt: '15 Aug 2026, 06:00 PM', url: '#' }
    ]
  },
  {
    id: 'PRJ-2026-003',
    name: 'Line 4 Braiding Capacity Expansion (40M Metres Target)',
    code: 'PRJ-CAP-L4',
    departmentChips: ['Production', 'Stores', 'Projects'],
    ownerId: 'EMP-005',
    ownerName: 'Vikram Shetty',
    progressPct: 45,
    hoursAllocated: 950,
    hoursSpent: 410,
    costToDate: 4200000,
    budget: 8500000,
    tasksOverdue: 1,
    lastUpdatedAt: '11 Aug 2026', // Not updated since Friday! (isFresh = false)
    isFresh: false,
    description: 'Installation and commissioning of 8 high-speed 32-carrier braiding machines to ramp annual capacity by 10 million metres.',
    tasks: [
      { id: 'TSK-301', title: 'Foundation and power distribution wiring in Bay 4', department: 'Production', assignee: 'Vikram Shetty', dueDate: '14 Aug 2026', status: 'Overdue', hoursAllocated: 120, hoursActual: 110 }
    ],
    members: [
      { id: 'EMP-005', name: 'Vikram Shetty', department: 'Production', complianceScore: 94, negativePoints: 1, warningsIssued: 1 },
      { id: 'EMP-011', name: 'Suresh Pillai', department: 'Stores', complianceScore: 92, negativePoints: 3, warningsIssued: 1 }
    ],
    weeklyReports: [
      { week: 'Week 32 (04-08 Aug 2026)', generatedAt: '08 Aug 2026, 06:00 PM', url: '#' }
    ]
  }
];
