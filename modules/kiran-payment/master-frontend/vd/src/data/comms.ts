import { CommsChannel, TrackedCommitment, EscalationRecord } from '../types';

export const mockChannels: CommsChannel[] = [
  {
    id: 'CHN-001',
    name: 'Motherson Sumi EV Project',
    type: 'customer',
    badgeCount: 2,
    referenceRecord: {
      type: 'Customer & RFQ',
      id: 'RFQ-2026-0418',
      title: 'Motherson Sumi Systems Ltd',
      status: 'At risk (Costing stage)',
      amount: 662500,
      owner: 'Rajesh Kumar'
    },
    messages: [
      {
        id: 'MSG-101',
        senderName: 'Rajesh Kumar',
        senderAvatar: 'RK',
        timestamp: '18 Aug 2026, 11:20 AM',
        content: 'Team, Vivek from Motherson needs confirmation on 25,000m batch delivery date before tomorrow 3 PM.',
        referencedRecord: {
          type: 'RFQ',
          id: 'RFQ-2026-0418',
          title: 'RFQ-2026-0418',
          subtitle: 'Silicone Coated Sleeving 6mm'
        }
      },
      {
        id: 'MSG-102',
        senderName: 'Vikram Shetty',
        senderAvatar: 'VS',
        timestamp: '18 Aug 2026, 11:45 AM',
        content: 'I will complete the extrusion line scheduling and drawing approval by 20 Aug afternoon. We can commit dispatch by 15 Sept.',
        detectedCommitment: {
          person: 'Vikram Shetty',
          promise: 'Complete extrusion line scheduling & drawing approval',
          dueDate: '20 Aug 2026',
          isReminderSet: true
        }
      },
      {
        id: 'MSG-103',
        senderName: 'Meera Iyer',
        senderAvatar: 'MI',
        timestamp: '18 Aug 2026, 02:15 PM',
        content: 'Please ensure we flag the overdue ₹8,42,150 balance to Vivek. Accounts cannot issue SLD clearance without at least 50% RTGS receipt.',
        referencedRecord: {
          type: 'Customer',
          id: 'CUST-001',
          title: 'Motherson Sumi Systems',
          subtitle: 'Overdue: ₹8,42,150'
        }
      },
      {
        id: 'MSG-104',
        senderName: 'Neha Joshi',
        senderAvatar: 'NJ',
        timestamp: '19 Aug 2026, 09:30 AM',
        content: 'BOM lines are locked in PACT. Ready for quotation sign-off.',
        detectedCommitment: {
          person: 'Neha Joshi',
          promise: 'BOM verification in PACT',
          dueDate: '19 Aug 2026',
          isReminderSet: true
        }
      }
    ]
  },
  {
    id: 'CHN-002',
    name: 'Alstom Metro Bogie Schedule',
    type: 'customer',
    referenceRecord: {
      type: 'Sales Order',
      id: 'SO-2026-0742',
      title: 'Alstom Transport India Ltd',
      status: 'Active (Dispatch Stage)',
      amount: 6200000,
      owner: 'Priya Nair'
    },
    messages: [
      {
        id: 'MSG-201',
        senderName: 'Priya Nair',
        senderAvatar: 'PN',
        timestamp: '17 Aug 2026, 04:10 PM',
        content: 'Karthik, did the 60,000m batch for Sri City leave today? Anil is following up on vehicle tracking.',
        referencedRecord: {
          type: 'Order',
          id: 'SO-2026-0742',
          title: 'PO-ALST-2026-904',
          subtitle: 'Class H Sleeving 4mm'
        }
      },
      {
        id: 'MSG-202',
        senderName: 'Karthik Reddy',
        senderAvatar: 'KR',
        timestamp: '17 Aug 2026, 04:30 PM',
        content: 'Yes, vehicle AP 03 TC 1182 dispatched with ASN-ALST-2026-0881. Estimated arrival at Sri City is 21 Aug morning.',
        detectedCommitment: {
          person: 'Karthik Reddy',
          promise: 'Share POD receipt with Alstom sourcing',
          dueDate: '22 Aug 2026',
          isReminderSet: true
        }
      }
    ]
  },
  {
    id: 'CHN-003',
    name: 'Sales HOD & Dispatch Alignment',
    type: 'department',
    badgeCount: 1,
    messages: [
      {
        id: 'MSG-301',
        senderName: 'Rajesh Kumar',
        senderAvatar: 'RK',
        timestamp: '19 Aug 2026, 08:45 AM',
        content: 'Weekly dispatches are tracking ₹1.24 Cr against target of ₹1.40 Cr. Let us review the stop-dispatch hold list before noon.'
      }
    ]
  }
];

export const mockCommitments: TrackedCommitment[] = [
  {
    id: 'CMT-001',
    personName: 'Vikram Shetty',
    department: 'Production',
    description: 'Extrusion line scheduling & drawing approval for Motherson KU-SLV-0625',
    promisedByDate: '20 Aug 2026',
    sourceMessage: 'I will complete the extrusion line scheduling and drawing approval by 20 Aug afternoon.',
    sourceChannel: 'Motherson Sumi EV Project',
    status: 'Pending',
    remindersSent: 1,
    lastReminderSentAt: '19 Aug 2026, 09:00 AM'
  },
  {
    id: 'CMT-002',
    personName: 'Karthik Reddy',
    department: 'Dispatch',
    description: 'Share POD receipt with Alstom sourcing for AP 03 TC 1182 consignment',
    promisedByDate: '22 Aug 2026',
    sourceMessage: 'Estimated arrival at Sri City is 21 Aug morning. Will collect POD.',
    sourceChannel: 'Alstom Metro Bogie Schedule',
    status: 'Pending',
    remindersSent: 0
  },
  {
    id: 'CMT-003',
    personName: 'Farhan Sheikh',
    department: 'Purchase',
    description: 'Issue PO for Saint-Gobain 68 Tex yarn batch',
    promisedByDate: '18 Aug 2026',
    sourceMessage: 'Will release PO-PUR-2026-0908 before Tuesday close.',
    sourceChannel: 'Raw Material Planning',
    status: 'Completed',
    remindersSent: 1,
    lastReminderSentAt: '18 Aug 2026, 04:00 PM'
  },
  {
    id: 'CMT-004',
    personName: 'Amit Deshmukh',
    department: 'Sales',
    description: 'Submit revised quotation for Raychem RPG KU-PUC-0400',
    promisedByDate: '16 Aug 2026',
    sourceMessage: 'Will send revised quote with 2% volume rebate by Friday.',
    sourceChannel: 'Raychem Commercials',
    status: 'Missed',
    remindersSent: 3,
    lastReminderSentAt: '18 Aug 2026, 09:30 AM'
  }
];

export const mockEscalations: EscalationRecord[] = [
  {
    id: 'ESC-001',
    severity: 'Critical',
    triggerReason: 'Customer waiting',
    recordType: 'Sales Order',
    recordId: 'SO-2026-0741',
    recordTitle: 'Motherson Sumi — Stop Dispatch Hold on ₹6.73L Shipment',
    currentLevel: 'L3',
    currentRole: 'Accounts Head (Meera Iyer)',
    timeAtLevel: '4 hours',
    nextAutoEscalateAt: '19 Aug 2026, 02:00 PM IST (to Managing Director)',
    history: [
      { level: 'L1', role: 'Dispatch Executive', escalatedAt: '18 Aug 16:00', reason: 'Customer on credit stop' },
      { level: 'L2', role: 'Head of Sales', escalatedAt: '18 Aug 18:30', reason: 'Customer requested critical line clearance' },
      { level: 'L3', role: 'Accounts Head', escalatedAt: '19 Aug 08:00', reason: 'Formal waiver review required' }
    ]
  },
  {
    id: 'ESC-002',
    severity: 'High',
    triggerReason: 'Deadline missed',
    recordType: 'RFQ',
    recordId: 'RFQ-2026-0422',
    recordTitle: 'Raychem RPG — Quotation SLA breached by 2 days',
    currentLevel: 'L2',
    currentRole: 'Head of Sales (Rajesh Kumar)',
    timeAtLevel: '24 hours',
    nextAutoEscalateAt: '20 Aug 2026, 10:00 AM IST (to Commercial Director)',
    history: [
      { level: 'L1', role: 'Sales Executive (Amit Deshmukh)', escalatedAt: '16 Aug 18:00', reason: 'SLA timer expired' },
      { level: 'L2', role: 'Head of Sales', escalatedAt: '18 Aug 09:00', reason: 'No quote issued after 48h' }
    ]
  },
  {
    id: 'ESC-003',
    severity: 'Medium',
    triggerReason: 'Task not completed',
    recordType: 'Purchase Order',
    recordId: 'PO-PUR-2026-0892',
    recordTitle: 'Saint-Gobain — 3-Way Match Quantity Discrepancy (200kg Short)',
    currentLevel: 'L1',
    currentRole: 'Purchase Head (Farhan Sheikh)',
    timeAtLevel: '18 hours',
    nextAutoEscalateAt: '20 Aug 2026, 04:00 PM IST (to Accounts Head)',
    history: [
      { level: 'L1', role: 'Purchase Head', escalatedAt: '18 Aug 16:30', reason: 'Debit note generation pending' }
    ]
  }
];
