import { BankStatementLine, BookEntry, ReceivableCustomer, PayableVendor } from '../types';

export const mockAccountsKPI = {
  cashPosition: 48200000, // ₹4.82 Cr
  totalReceivable: 68420000, // ₹6.84 Cr
  totalPayable: 34210000, // ₹3.42 Cr
  overdueReceivable: 1362150, // ₹13.62 L
  unreconciledCount: 11,
  unreconciledAmount: 214380, // ₹2,14,380
  collectionEfficiencyPct: 94.2
};

export const mockCashTrend = [
  { month: 'Mar 2026', billed: 48000000, collected: 45200000 },
  { month: 'Apr 2026', billed: 52000000, collected: 49800000 },
  { month: 'May 2026', billed: 56500000, collected: 54100000 },
  { month: 'Jun 2026', billed: 61000000, collected: 58900000 },
  { month: 'Jul 2026', billed: 64500000, collected: 62000000 },
  { month: 'Aug 2026 (MTD)', billed: 42000000, collected: 39500000 },
];

export const mockBankStatementLines: BankStatementLine[] = [
  {
    id: 'BSL-101',
    date: '19 Aug 2026',
    description: 'NEFT CR-CMS26081899124-CUMMINS INDIA LTD',
    referenceNo: 'CMS26081899124',
    credit: 1480000,
    balance: 48240000,
    isMatched: true,
    matchedBookEntryId: 'VCH-901'
  },
  {
    id: 'BSL-102',
    date: '19 Aug 2026',
    description: 'RTGS CR-ALSTOM TRANSPORT INDIA-SRICITY',
    referenceNo: 'UTIBR520260819001',
    credit: 2273333,
    balance: 46760000,
    isMatched: true,
    matchedBookEntryId: 'VCH-902'
  },
  {
    id: 'BSL-103',
    date: '18 Aug 2026',
    description: 'UPI/423190823901/DIRECT CR/UNRESOLVED',
    referenceNo: 'UPI-423190823901',
    credit: 42500,
    balance: 44486667,
    isMatched: false,
    aiSuggestedReason: 'Customer payment unidentified'
  },
  {
    id: 'BSL-104',
    date: '18 Aug 2026',
    description: 'CHQ CLG 004819 - CROMPTON GREAVES',
    referenceNo: 'CHQ-004819',
    credit: 792000,
    balance: 44444167,
    isMatched: true,
    matchedBookEntryId: 'VCH-904'
  },
  {
    id: 'BSL-105',
    date: '18 Aug 2026',
    description: 'DEBIT - FOREX OUTWARD REMITTANCE CHARGE',
    referenceNo: 'BNK-CHG-9901',
    debit: 14880,
    balance: 43652167,
    isMatched: false,
    aiSuggestedReason: 'Foreign bank charges not booked'
  },
  {
    id: 'BSL-106',
    date: '17 Aug 2026',
    description: 'NEFT DR-POLYCHEM EMULSIONS-RAW MAT',
    referenceNo: 'NEFT-881290311',
    debit: 340000,
    balance: 43667047,
    isMatched: true,
    matchedBookEntryId: 'VCH-906'
  },
  {
    id: 'BSL-107',
    date: '17 Aug 2026',
    description: 'PG SETTLEMENT-RAZORPAY-EXPORT ADV',
    referenceNo: 'RZP-ST-99120',
    credit: 157000,
    balance: 44007047,
    isMatched: false,
    aiSuggestedReason: 'Online payment not yet cleared'
  }
];

export const mockBookEntries: BookEntry[] = [
  {
    id: 'VCH-901',
    date: '19 Aug 2026',
    voucherNo: 'RCT-2026-0814',
    particulars: 'Cummins India Ltd (Against INV-0741 & 0755)',
    account: 'HDFC Bank Oper A/c',
    credit: 1480000,
    isMatched: true
  },
  {
    id: 'VCH-902',
    date: '19 Aug 2026',
    voucherNo: 'RCT-2026-0815',
    particulars: 'Alstom Transport India (Against INV-0730)',
    account: 'HDFC Bank Oper A/c',
    credit: 2273333,
    isMatched: true
  },
  {
    id: 'VCH-904',
    date: '18 Aug 2026',
    voucherNo: 'RCT-2026-0810',
    particulars: 'Crompton Greaves (Against INV-0704)',
    account: 'HDFC Bank Oper A/c',
    credit: 792000,
    isMatched: true
  },
  {
    id: 'VCH-906',
    date: '17 Aug 2026',
    voucherNo: 'PMT-2026-0612',
    particulars: 'PolyChem Emulsions Pvt Ltd (PO-914)',
    account: 'HDFC Bank Oper A/c',
    debit: 340000,
    isMatched: true
  },
  {
    id: 'VCH-908',
    date: '18 Aug 2026',
    voucherNo: 'RCT-2026-0812',
    particulars: 'Bharat Bijlee (Chq 88129 Deposited)',
    account: 'HDFC Bank Oper A/c',
    credit: 850000,
    isMatched: false
  }
];

export const mockReceivables: ReceivableCustomer[] = [
  {
    customerId: 'CUST-001',
    customerName: 'Motherson Sumi Systems Ltd',
    region: 'North',
    totalReceivable: 16460000,
    buckets: {
      b0_30: 9800000,
      b31_45: 4200000,
      b46_60: 1617850,
      b61_90: 842150,
      b90_plus: 0
    },
    overdueAmount: 842150,
    lastReminderSent: '17 Aug 2026',
    remindersCount: 4,
    nextScheduled: '21 Aug 2026',
    reminderFrequencyDays: 7,
    collectionStatus: 'Overdue'
  },
  {
    customerId: 'CUST-002',
    customerName: 'Alstom Transport India Ltd',
    region: 'South',
    totalReceivable: 11550000,
    buckets: {
      b0_30: 8200000,
      b31_45: 3350000,
      b46_60: 0,
      b61_90: 0,
      b90_plus: 0
    },
    overdueAmount: 0,
    lastReminderSent: '10 Aug 2026',
    remindersCount: 1,
    nextScheduled: '25 Aug 2026',
    reminderFrequencyDays: 14,
    collectionStatus: 'On track'
  },
  {
    customerId: 'CUST-003',
    customerName: 'GE Power India Ltd',
    region: 'West',
    totalReceivable: 7900000,
    buckets: {
      b0_30: 5100000,
      b31_45: 2800000,
      b46_60: 0,
      b61_90: 0,
      b90_plus: 0
    },
    overdueAmount: 0,
    lastReminderSent: '12 Aug 2026',
    remindersCount: 1,
    nextScheduled: '26 Aug 2026',
    reminderFrequencyDays: 14,
    collectionStatus: 'On track'
  },
  {
    customerId: 'CUST-004',
    customerName: 'Suzlon Energy Ltd',
    region: 'West',
    totalReceivable: 8800000,
    buckets: {
      b0_30: 4800000,
      b31_45: 2600000,
      b46_60: 1060000,
      b61_90: 340000,
      b90_plus: 0
    },
    overdueAmount: 340000,
    lastReminderSent: '16 Aug 2026',
    remindersCount: 2,
    nextScheduled: '23 Aug 2026',
    reminderFrequencyDays: 7,
    collectionStatus: 'At risk'
  },
  {
    customerId: 'CUST-007',
    customerName: 'Raychem RPG Pvt Ltd',
    region: 'West',
    totalReceivable: 5900000,
    buckets: {
      b0_30: 3800000,
      b31_45: 1400000,
      b46_60: 520000,
      b61_90: 180000,
      b90_plus: 0
    },
    overdueAmount: 180000,
    lastReminderSent: '15 Aug 2026',
    remindersCount: 2,
    nextScheduled: '22 Aug 2026',
    reminderFrequencyDays: 7,
    collectionStatus: 'At risk'
  }
];

export const mockPayables: PayableVendor[] = [
  {
    vendorId: 'VND-001',
    vendorName: 'Saint-Gobain Vetrotex India',
    billsCount: 4,
    totalOutstanding: 6840000,
    dueThisWeek: 2150000,
    overdueAmount: 0,
    creditDays: 45,
    daysOldestBill: 41,
    is40DayAlert: true,
    proposedForPayment: true,
    paymentRunDate: '20 Aug 2026 (Thursday Run)',
    utrStatus: 'Queued'
  },
  {
    vendorId: 'VND-002',
    vendorName: 'Dow Chemical International Pvt Ltd',
    billsCount: 3,
    totalOutstanding: 5420000,
    dueThisWeek: 1800000,
    overdueAmount: 0,
    creditDays: 45,
    daysOldestBill: 42,
    is40DayAlert: true,
    proposedForPayment: true,
    paymentRunDate: '20 Aug 2026 (Thursday Run)',
    utrStatus: 'Queued'
  },
  {
    vendorId: 'VND-003',
    vendorName: 'Wacker Metroark Chemicals',
    billsCount: 2,
    totalOutstanding: 3200000,
    dueThisWeek: 950000,
    overdueAmount: 0,
    creditDays: 30,
    daysOldestBill: 28,
    is40DayAlert: false,
    proposedForPayment: false,
    paymentRunDate: '25 Aug 2026 (Tuesday Run)',
    utrStatus: 'Processing'
  },
  {
    vendorId: 'VND-004',
    vendorName: 'PolyChem Emulsions Pvt Ltd',
    billsCount: 1,
    totalOutstanding: 340000,
    dueThisWeek: 0,
    overdueAmount: 0,
    creditDays: 30,
    daysOldestBill: 14,
    is40DayAlert: false,
    proposedForPayment: false,
    paymentRunDate: '25 Aug 2026',
    utrStatus: 'UTR sent to vendor',
    utrNumber: 'HDFC26081799120',
    utrMailSentAt: '18 Aug 2026, 04:12 PM'
  },
  {
    vendorId: 'VND-005',
    vendorName: 'Reliance Industries (PET Polymers)',
    billsCount: 5,
    totalOutstanding: 8900000,
    dueThisWeek: 3400000,
    overdueAmount: 0,
    creditDays: 45,
    daysOldestBill: 43,
    is40DayAlert: true,
    proposedForPayment: true,
    paymentRunDate: '20 Aug 2026 (Thursday Run)',
    utrStatus: 'Queued'
  }
];
