import { RFQItem } from '../types';

export const mockRFQs: RFQItem[] = [
  {
    id: 'RFQ-2026-0418',
    rfqNumber: 'RFQ-2026-0418',
    customerId: 'CUST-001',
    customerName: 'Motherson Sumi Systems Ltd',
    partNumber: 'KU-SLV-0625-B',
    description: 'Silicone Coated Fiberglass Sleeve 6.0mm Black (EV Line)',
    quantity: 25000,
    uom: 'Metres',
    targetPrice: 26.50,
    sopDate: '2026-09-15',
    region: 'North',
    ownerId: 'EMP-001',
    ownerName: 'Rajesh Kumar',
    stage: 'Costing',
    status: 'At risk',
    daysInStage: 3,
    slaLimitDays: 4,
    estimatedValue: 662500,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-16',
    deadlineDate: '2026-08-22',
    missingMandatoryFields: [],
    costing: {
      material: 'E-Glass Braid + High Grade Silicone Emulsion',
      cutLength: '50m Spools',
      rate: 27.20,
      marginPct: 18.5,
      laborCost: 3.40,
      packagingCost: 1.20
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0812',
        version: 'v1.0',
        value: 680000,
        status: 'Awaiting HOD Approval',
        date: '2026-08-18'
      }
    ],
    samples: [
      {
        sampleNumber: 'SMP-2026-0199',
        date: '2026-08-17',
        status: 'In Production'
      }
    ],
    documents: [
      { name: 'Motherson_Sept_Schedule.xlsx', size: '1.4 MB', type: 'spreadsheet', uploadedAt: '2026-08-16' },
      { name: 'Drawing_KU-SLV-0625.pdf', size: '840 KB', type: 'pdf', uploadedAt: '2026-08-16' }
    ],
    routingHops: [
      { department: 'Sales', owner: 'Rajesh Kumar', deadline: '16 Aug 2026', isCurrent: false, status: 'completed' },
      { department: 'Production', owner: 'Vikram Shetty', deadline: '19 Aug 2026', isCurrent: false, status: 'completed' },
      { department: 'Planning', owner: 'Neha Joshi', deadline: '22 Aug 2026', isCurrent: true, status: 'current' },
      { department: 'Sales', owner: 'Rajesh Kumar', deadline: '24 Aug 2026', isCurrent: false, status: 'pending' }
    ],
    timeline: [
      {
        id: 'TL-1',
        actorType: 'ai',
        actorName: 'claude-sonnet-4-6',
        action: 'Extracted email and created RFQ draft',
        detail: 'Extracted 25,000m of KU-SLV-0625-B with 96% overall confidence from sales inbox email.',
        timestamp: '2026-08-16T06:14:00+05:30',
        confidence: 96,
        modelUsed: 'claude-sonnet-4-6'
      },
      {
        id: 'TL-2',
        actorType: 'person',
        actorName: 'Rajesh Kumar',
        action: 'Verified RFQ & assigned to Planning for line costing',
        detail: 'Confirmed part number and assigned SLA target for EV line dispatch.',
        timestamp: '2026-08-16T10:30:00+05:30'
      },
      {
        id: 'TL-3',
        actorType: 'person',
        actorName: 'Vikram Shetty',
        action: 'Completed Production feasibility & set cut length to 50m coils',
        detail: 'Line 3 extrusion slot confirmed for 02 Sep 2026.',
        timestamp: '2026-08-18T14:15:00+05:30'
      },
      {
        id: 'TL-4',
        actorType: 'ai',
        actorName: 'claude-haiku-4-5',
        action: 'Stage transition: Responsibility changed to Planning',
        detail: 'Deadline reset to 22 Aug 2026 as per standard operations matrix.',
        timestamp: '2026-08-18T14:16:00+05:30'
      }
    ]
  },
  {
    id: 'RFQ-2026-0419',
    rfqNumber: 'RFQ-2026-0419',
    customerId: 'CUST-003',
    customerName: 'GE Power India Ltd',
    partNumber: 'KU-BRD-1600-N',
    description: 'Braided Expandable Sleeving 16mm Black (Flame Retardant)',
    quantity: 18000,
    uom: 'Metres',
    targetPrice: 21.80,
    sopDate: '2026-09-10',
    region: 'West',
    ownerId: 'EMP-003',
    ownerName: 'Amit Deshmukh',
    stage: 'Quoted',
    status: 'On track',
    daysInStage: 1,
    slaLimitDays: 3,
    estimatedValue: 392400,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-18',
    deadlineDate: '2026-08-25',
    missingMandatoryFields: [],
    costing: {
      material: 'Flame Retardant PET Monofilament 0.25mm',
      cutLength: '100m Spools',
      rate: 22.00,
      marginPct: 22.0,
      laborCost: 2.10,
      packagingCost: 0.90
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0814',
        version: 'v1.0',
        value: 396000,
        status: 'Sent to Customer',
        date: '2026-08-18'
      }
    ],
    samples: [],
    documents: [
      { name: 'GE_Specification_ControlPanels_2026.pdf', size: '2.1 MB', type: 'pdf', uploadedAt: '2026-08-18' }
    ],
    routingHops: [
      { department: 'Sales', owner: 'Amit Deshmukh', deadline: '18 Aug 2026', isCurrent: false, status: 'completed' },
      { department: 'Sales', owner: 'Amit Deshmukh', deadline: '25 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: [
      {
        id: 'TL-201',
        actorType: 'ai',
        actorName: 'claude-sonnet-4-6',
        action: 'Auto-created RFQ from GE Power sourcing inquiry',
        timestamp: '2026-08-18T04:20:00+05:30',
        confidence: 97
      },
      {
        id: 'TL-202',
        actorType: 'person',
        actorName: 'Amit Deshmukh',
        action: 'Issued formal quotation QTE-2026-0814 at ₹22.00/m',
        timestamp: '2026-08-18T11:45:00+05:30'
      }
    ]
  },
  {
    id: 'RFQ-2026-0412',
    rfqNumber: 'RFQ-2026-0412',
    customerId: 'CUST-002',
    customerName: 'Alstom Transport India Ltd',
    partNumber: 'KU-VAR-0400-H',
    description: 'Class H Varnished Sleeving 4mm Amber (Metro Bogie Line)',
    quantity: 12000,
    uom: 'Metres',
    targetPrice: 19.50,
    sopDate: '2026-08-28',
    region: 'South',
    ownerId: 'EMP-002',
    ownerName: 'Priya Nair',
    stage: 'Won',
    status: 'Closed',
    daysInStage: 4,
    slaLimitDays: 5,
    estimatedValue: 237600,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-04',
    deadlineDate: '2026-08-10',
    missingMandatoryFields: [],
    costing: {
      material: 'Braided Glass Yarn + Class H Resin',
      cutLength: '100m Coils',
      rate: 19.80,
      marginPct: 24.0,
      laborCost: 2.20,
      packagingCost: 0.80
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0792',
        version: 'v1.0',
        value: 237600,
        status: 'Accepted',
        date: '2026-08-05'
      }
    ],
    samples: [
      {
        sampleNumber: 'SMP-2026-0182',
        date: '2026-08-06',
        status: 'Approved by customer'
      }
    ],
    documents: [
      { name: 'Alstom_Metro_ClassH_Drawing.pdf', size: '1.8 MB', type: 'pdf', uploadedAt: '2026-08-04' }
    ],
    routingHops: [
      { department: 'Sales', owner: 'Priya Nair', deadline: '05 Aug 2026', isCurrent: false, status: 'completed' },
      { department: 'Planning', owner: 'Neha Joshi', deadline: '08 Aug 2026', isCurrent: false, status: 'completed' }
    ],
    timeline: [
      {
        id: 'TL-301',
        actorType: 'person',
        actorName: 'Priya Nair',
        action: 'Marked as Won - PO received PO-ALST-2026-904',
        timestamp: '2026-08-08T16:00:00+05:30'
      }
    ]
  },
  {
    id: 'RFQ-2026-0420',
    rfqNumber: 'RFQ-2026-0420',
    customerId: 'CUST-004',
    customerName: 'Suzlon Energy Ltd',
    partNumber: 'KU-SLV-0800-B',
    description: 'Silicone Coated Fiberglass Sleeve 8mm Black (Nacelle Assembly)',
    quantity: 9500,
    uom: 'Metres',
    targetPrice: 37.50,
    sopDate: '2026-09-05',
    region: 'West',
    ownerId: 'EMP-004',
    ownerName: 'Sunita Rao',
    stage: 'Under review',
    status: 'On track',
    daysInStage: 1,
    slaLimitDays: 2,
    estimatedValue: 356250,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-18',
    deadlineDate: '2026-08-21',
    missingMandatoryFields: [],
    costing: {
      material: 'Heavy Duty Glass Braid + Dow Corning Silicone',
      cutLength: '50m Coils',
      rate: 38.00,
      marginPct: 20.5,
      laborCost: 4.50,
      packagingCost: 1.50
    },
    quotations: [],
    samples: [],
    documents: [],
    routingHops: [
      { department: 'CRM', owner: 'Sunita Rao', deadline: '19 Aug 2026', isCurrent: true, status: 'current' },
      { department: 'Production', owner: 'Vikram Shetty', deadline: '21 Aug 2026', isCurrent: false, status: 'pending' }
    ],
    timeline: [
      {
        id: 'TL-401',
        actorType: 'ai',
        actorName: 'claude-sonnet-4-6',
        action: 'Created RFQ from Suzlon PO Amendment mail',
        timestamp: '2026-08-18T18:40:00+05:30',
        confidence: 95
      }
    ]
  },
  {
    id: 'RFQ-2026-0421',
    rfqNumber: 'RFQ-2026-0421',
    customerId: 'CUST-005',
    customerName: 'Cummins India Ltd',
    partNumber: 'KU-HST-0800-R',
    description: 'Heat-shrink Sleeve 8mm Red (Dual Wall Adhesive)',
    quantity: 15000,
    uom: 'Metres',
    targetPrice: 40.00,
    sopDate: '2026-09-22',
    region: 'West',
    ownerId: 'EMP-003',
    ownerName: 'Amit Deshmukh',
    stage: 'New',
    status: 'Awaiting approval',
    daysInStage: 2,
    slaLimitDays: 2,
    estimatedValue: 630000,
    source: 'Manual',
    isAICreated: false,
    createdDate: '2026-08-17',
    deadlineDate: '2026-08-20',
    missingMandatoryFields: ['Specification Doc', 'Target Price Confirmation'],
    quotations: [],
    samples: [],
    documents: [],
    routingHops: [
      { department: 'Sales', owner: 'Amit Deshmukh', deadline: '20 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: [
      {
        id: 'TL-501',
        actorType: 'person',
        actorName: 'Amit Deshmukh',
        action: 'Created manual RFQ following client meeting in Pune',
        timestamp: '2026-08-17T15:20:00+05:30'
      }
    ]
  },
  {
    id: 'RFQ-2026-0422',
    rfqNumber: 'RFQ-2026-0422',
    customerId: 'CUST-007',
    customerName: 'Raychem RPG Pvt Ltd',
    partNumber: 'KU-PUC-0400-C',
    description: 'PU Coated Sleeve 4mm Clear (Class F)',
    quantity: 30000,
    uom: 'Metres',
    targetPrice: 23.50,
    sopDate: '2026-09-08',
    region: 'West',
    ownerId: 'EMP-003',
    ownerName: 'Amit Deshmukh',
    stage: 'Negotiation',
    status: 'Overdue',
    daysInStage: 6,
    slaLimitDays: 4,
    estimatedValue: 735000,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-10',
    deadlineDate: '2026-08-16',
    missingMandatoryFields: [],
    costing: {
      material: 'E-Glass Braid + PU Lacquer',
      cutLength: '100m Coils',
      rate: 24.50,
      marginPct: 19.0,
      laborCost: 2.80,
      packagingCost: 0.90
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0801',
        version: 'v2.0',
        value: 735000,
        status: 'Under negotiation',
        date: '2026-08-12'
      }
    ],
    samples: [
      {
        sampleNumber: 'SMP-2026-0189',
        date: '2026-08-11',
        status: 'Dispatched'
      }
    ],
    documents: [],
    routingHops: [
      { department: 'Sales', owner: 'Amit Deshmukh', deadline: '16 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: [
      {
        id: 'TL-601',
        actorType: 'ai',
        actorName: 'claude-haiku-4-5',
        action: 'Triggered Overdue SLA escalation (2 days past deadline)',
        detail: 'Escalated to Rajesh Kumar (HOD Sales) per Escalation Matrix L2.',
        timestamp: '2026-08-18T09:00:00+05:30'
      }
    ]
  },
  {
    id: 'RFQ-2026-0423',
    rfqNumber: 'RFQ-2026-0423',
    customerId: 'CUST-010',
    customerName: 'BSA Corporation Ltd',
    partNumber: 'KU-SLV-0250-N',
    description: 'Fiberglass Sleeving 2.5mm Natural (100m Coils)',
    quantity: 50000,
    uom: 'Metres',
    targetPrice: 12.00,
    sopDate: '2026-09-30',
    region: 'West',
    ownerId: 'EMP-003',
    ownerName: 'Amit Deshmukh',
    stage: 'Costing',
    status: 'On track',
    daysInStage: 2,
    slaLimitDays: 3,
    estimatedValue: 625000,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-17',
    deadlineDate: '2026-08-23',
    missingMandatoryFields: [],
    costing: {
      material: 'Heat Treated E-Glass',
      cutLength: '100m Coils',
      rate: 12.50,
      marginPct: 21.0,
      laborCost: 1.40,
      packagingCost: 0.60
    },
    quotations: [],
    samples: [],
    documents: [],
    routingHops: [
      { department: 'Planning', owner: 'Neha Joshi', deadline: '23 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: []
  },
  {
    id: 'RFQ-2026-0424',
    rfqNumber: 'RFQ-2026-0424',
    customerId: 'CUST-013',
    customerName: 'TVS Motor Company Ltd',
    partNumber: 'KU-TUB-1200-W',
    description: 'Silicone Rubber Tubing 12mm White (Peroxide Cured)',
    quantity: 8000,
    uom: 'Metres',
    targetPrice: 56.00,
    sopDate: '2026-10-05',
    region: 'South',
    ownerId: 'EMP-002',
    ownerName: 'Priya Nair',
    stage: 'New',
    status: 'On track',
    daysInStage: 1,
    slaLimitDays: 3,
    estimatedValue: 464000,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-18',
    deadlineDate: '2026-08-24',
    missingMandatoryFields: [],
    quotations: [],
    samples: [],
    documents: [],
    routingHops: [
      { department: 'Sales', owner: 'Priya Nair', deadline: '24 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: []
  },
  {
    id: 'RFQ-2026-0425',
    rfqNumber: 'RFQ-2026-0425',
    customerId: 'CUST-009',
    customerName: 'Regal Beloit India Pvt Ltd',
    partNumber: 'KU-SLV-1000-Y',
    description: 'Acrylic Coated Sleeve 10mm Yellow (Motor Leads)',
    quantity: 14000,
    uom: 'Metres',
    targetPrice: 33.00,
    sopDate: '2026-09-18',
    region: 'South',
    ownerId: 'EMP-002',
    ownerName: 'Priya Nair',
    stage: 'Quoted',
    status: 'On track',
    daysInStage: 2,
    slaLimitDays: 4,
    estimatedValue: 483000,
    source: 'Portal',
    isAICreated: false,
    createdDate: '2026-08-15',
    deadlineDate: '2026-08-22',
    missingMandatoryFields: [],
    costing: {
      material: 'Acrylic Copolymer + E-Glass',
      cutLength: '50m Coils',
      rate: 34.50,
      marginPct: 23.5,
      laborCost: 3.80,
      packagingCost: 1.10
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0809',
        version: 'v1.0',
        value: 483000,
        status: 'Sent',
        date: '2026-08-16'
      }
    ],
    samples: [],
    documents: [],
    routingHops: [
      { department: 'Sales', owner: 'Priya Nair', deadline: '22 Aug 2026', isCurrent: true, status: 'current' }
    ],
    timeline: []
  },
  {
    id: 'RFQ-2026-0426',
    rfqNumber: 'RFQ-2026-0426',
    customerId: 'CUST-006',
    customerName: 'Crompton Greaves Consumer Electricals',
    partNumber: 'KU-VAR-0400-H',
    description: 'Varnished Sleeving Class H 4mm (Fan Stator Leads)',
    quantity: 40000,
    uom: 'Metres',
    targetPrice: 19.00,
    sopDate: '2026-09-25',
    region: 'West',
    ownerId: 'EMP-003',
    ownerName: 'Amit Deshmukh',
    stage: 'Won',
    status: 'Closed',
    daysInStage: 5,
    slaLimitDays: 5,
    estimatedValue: 792000,
    source: 'Email',
    isAICreated: true,
    createdDate: '2026-08-08',
    deadlineDate: '2026-08-14',
    missingMandatoryFields: [],
    costing: {
      material: 'Glass Braid + Alkyd Varnish',
      cutLength: '100m Coils',
      rate: 19.80,
      marginPct: 22.0,
      laborCost: 2.10,
      packagingCost: 0.80
    },
    quotations: [
      {
        quoteNumber: 'QTE-2026-0798',
        version: 'v1.0',
        value: 792000,
        status: 'Accepted',
        date: '2026-08-10'
      }
    ],
    samples: [],
    documents: [],
    routingHops: [],
    timeline: []
  }
];
