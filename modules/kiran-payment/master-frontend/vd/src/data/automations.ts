import { AutomationRecord } from '../types';

export const mockAutomations: AutomationRecord[] = [
  {
    id: 'AUT-001',
    name: 'Pending Sales Orders Daily Digest to Production',
    department: 'Production',
    triggerText: 'Schedule: Daily at 08:00 AM IST',
    conditionsText: 'Balance Qty > 0 and Next Delivery Date <= 7 days',
    actionsText: 'Resolve recipient by product line (Extrusion / Braiding / Varnish) → Generate summary email → Send to Vikram Shetty',
    readableSentence: 'Every morning at 08:00 AM, identify all sales orders with active balance due in the next 7 days, group them by machine bay, and dispatch the prioritized schedule to Vikram Shetty (Production Head).',
    runsThisMonth: 19,
    successRatePct: 100,
    owner: 'Neha Joshi',
    isEnabled: true,
    runHistory: [
      { id: 'AH-1', timestamp: '19 Aug 2026, 08:00 AM', status: 'Success', summary: 'Sent pending SO breakdown (7 lines, 1.75 lakh metres) to Vikram Shetty.' },
      { id: 'AH-2', timestamp: '18 Aug 2026, 08:00 AM', status: 'Success', summary: 'Sent pending SO breakdown (8 lines) to Vikram Shetty.' }
    ]
  },
  {
    id: 'AUT-002',
    name: 'Pre-Dispatch Plan & ASN Auto-Notification',
    department: 'Dispatch',
    triggerText: 'Status Change: When SLD is generated',
    conditionsText: 'Customer stop-dispatch flag is False and vehicle number allocated',
    actionsText: 'Identify customer dispatch contact → Send pre-dispatch plan email → Wait 48 hours → If not acknowledged, send reminder → Escalate to Karthik Reddy after 72 hours',
    readableSentence: 'When an SLD is generated and credit is clear, identify the customer logistics contact, dispatch the pre-shipment ASN schedule, wait 48 hours for acknowledgment, and escalate to Karthik Reddy if unacknowledged after 72 hours.',
    runsThisMonth: 42,
    successRatePct: 97.6,
    owner: 'Karthik Reddy',
    isEnabled: true,
    runHistory: [
      { id: 'AH-3', timestamp: '17 Aug 2026, 04:35 PM', status: 'Success', summary: 'Pre-dispatch notification sent to Alstom Transport (Anil Sengupta) for AP 03 TC 1182.' }
    ]
  },
  {
    id: 'AUT-003',
    name: 'POD / GRN Proof-of-Delivery Auto-Chase',
    department: 'Dispatch',
    triggerText: 'Threshold: 3 days post carrier delivery scan',
    conditionsText: 'POD status is Pending and Invoice is not closed',
    actionsText: 'Send gentle reminder to customer procurement → Log reminder count → Schedule next follow-up in 4 days',
    readableSentence: 'When a shipment is marked delivered by the carrier but no signed POD or GRN is logged within 3 days, send an automated receipt confirmation request to the customer procurement desk.',
    runsThisMonth: 28,
    successRatePct: 100,
    owner: 'Karthik Reddy',
    isEnabled: true,
    runHistory: [
      { id: 'AH-4', timestamp: '19 Aug 2026, 09:15 AM', status: 'Success', summary: 'Follow-up #3 sent to Suzlon Energy (Mahesh Patil) for Jaisalmer consignment.' }
    ]
  },
  {
    id: 'AUT-004',
    name: 'Overdue Receivables & Stop-Dispatch Enforcement',
    department: 'Accounts',
    triggerText: 'Schedule: Daily at 09:00 AM IST',
    conditionsText: 'Customer overdue balance > 0 beyond credit days',
    actionsText: 'Group invoices by aging bucket (30/45/60/90) → Auto-email statement of account → If >60 days, apply Stop-Dispatch lock and notify Meera Iyer',
    readableSentence: 'Every morning at 09:00 AM, scan customer ledgers for overdue bills. If any overdue balance exceeds 60 days, automatically engage the Stop-Dispatch hold in the ERP and notify Meera Iyer (Accounts Head).',
    runsThisMonth: 19,
    successRatePct: 100,
    owner: 'Meera Iyer',
    isEnabled: true,
    runHistory: [
      { id: 'AH-5', timestamp: '19 Aug 2026, 09:00 AM', status: 'Success', summary: 'Stop-dispatch hold maintained on Motherson Sumi (₹8.42L overdue 62 days).' }
    ]
  },
  {
    id: 'AUT-005',
    name: 'Vendor UTR Remittance Advice Auto-Mail',
    department: 'Accounts',
    triggerText: 'Event: Bank payment run batch executed',
    conditionsText: 'Valid NEFT/RTGS UTR number generated',
    actionsText: 'Extract vendor email from master → Generate payment advice PDF with line invoice breakup → Send UTR confirmation email',
    readableSentence: 'As soon as bank payment reconciliation assigns a UTR reference to a vendor disbursement, generate a stamped remittance advice PDF and email it directly to the vendor accounts department.',
    runsThisMonth: 64,
    successRatePct: 100,
    owner: 'Meera Iyer',
    isEnabled: true,
    runHistory: [
      { id: 'AH-6', timestamp: '18 Aug 2026, 04:12 PM', status: 'Success', summary: 'Dispatched UTR HDFC26081799120 advice to PolyChem Emulsions Pvt Ltd.' }
    ]
  },
  {
    id: 'AUT-006',
    name: '40-Day Vendor Credit Due Window Alert',
    department: 'Purchase',
    triggerText: 'Schedule: Every Tuesday and Thursday at 10:00 AM',
    conditionsText: 'Vendor bills reaching 40 days on 45-day credit cycle',
    actionsText: 'Compile payment proposal batch → Flag 5-day expiry window → Submit to Meera Iyer for Thursday payment run approval',
    readableSentence: 'Every Tuesday and Thursday, identify all vendor invoices reaching 40 days of age on 45-day credit terms, and auto-populate them into the bi-weekly payment proposal queue to prevent MSME interest penalties.',
    runsThisMonth: 6,
    successRatePct: 100,
    owner: 'Farhan Sheikh',
    isEnabled: true,
    runHistory: [
      { id: 'AH-7', timestamp: '18 Aug 2026, 10:00 AM', status: 'Success', summary: '3 vendors flagged for 40-day payment run (Saint-Gobain, Dow, Reliance).' }
    ]
  },
  {
    id: 'AUT-007',
    name: 'Thursday Project Task Compliance Reminder',
    department: 'Projects',
    triggerText: 'Schedule: Every Thursday at 10:00 AM IST',
    conditionsText: 'Any active task not updated since last Friday',
    actionsText: 'Send warning notification banner: "Update your tasks before Friday 12:00 PM — the week closes automatically"',
    readableSentence: 'Every Thursday morning, check all project workstreams and issue an automated compliance banner to assignees whose task status has remained stale throughout the week.',
    runsThisMonth: 2,
    successRatePct: 100,
    owner: 'Anjali Menon',
    isEnabled: true,
    runHistory: [
      { id: 'AH-8', timestamp: '14 Aug 2026, 10:00 AM', status: 'Success', summary: 'Reminded 5 project leads across SAP ERP and Line 4 braiding initiatives.' }
    ]
  },
  {
    id: 'AUT-008',
    name: 'Friday Weekly Auto-Close & Scoreboard Computation',
    department: 'Projects',
    triggerText: 'Schedule: Every Friday at 12:00 PM IST',
    conditionsText: 'Work week close threshold reached',
    actionsText: 'Lock week tasks → Compute compliance standings → Assign negative points for unlogged time → Generate weekly MIS report',
    readableSentence: 'Every Friday at 12:00 PM sharp, automatically lock project task sheets, calculate department compliance standings, and archive the weekly progress summary.',
    runsThisMonth: 2,
    successRatePct: 100,
    owner: 'Anjali Menon',
    isEnabled: true,
    runHistory: [
      { id: 'AH-9', timestamp: '15 Aug 2026, 12:00 PM', status: 'Success', summary: 'Week 33 closed successfully. Standings published.' }
    ]
  }
];
