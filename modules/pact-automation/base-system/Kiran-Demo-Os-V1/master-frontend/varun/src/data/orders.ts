import { SalesOrder } from '../types';

export const mockSalesOrders: SalesOrder[] = [
  {
    id: 'SO-2026-0741',
    poNumber: 'PO-MOTH-2026-881',
    customerId: 'CUST-001',
    customerName: 'Motherson Sumi Systems Ltd',
    linkedRfqId: 'RFQ-2026-0418',
    linkedRfqNumber: 'RFQ-2026-0418',
    product: 'Silicone Coated Fiberglass Sleeve 6mm Black',
    partNumber: 'KU-SLV-0625-B',
    poQty: 180000,
    executedQty: 75000,
    balanceQty: 105000,
    poValue: 4850000,
    executedValue: 2020833,
    balanceValue: 2829167,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-25',
    status: 'Active',
    orderDate: '2026-07-28',
    weeklyBuckets: [
      { week: 'W1 (01-07 Aug)', qty: 25000, status: 'Delivered' },
      { week: 'W2 (08-14 Aug)', qty: 25000, status: 'Delivered' },
      { week: 'W3 (15-21 Aug)', qty: 25000, status: 'Delivered' },
      { week: 'W4 (22-28 Aug)', qty: 25000, status: 'In Production' },
      { week: 'W5 (29-31 Aug)', qty: 15000, status: 'Scheduled' },
      { week: 'W6 (01-07 Sep)', qty: 25000, status: 'Scheduled' },
      { week: 'W7 (08-14 Sep)', qty: 20000, status: 'Scheduled' },
      { week: 'W8 (15-21 Sep)', qty: 20000, status: 'Scheduled' }
    ],
    workOrders: [
      { id: 'WO-881-A', cutLength: '50m Spools', quantity: 25000, status: 'Running', machine: 'Extrusion Line 3' },
      { id: 'WO-881-B', cutLength: '50m Spools', quantity: 25000, status: 'Queued', machine: 'Extrusion Line 3' }
    ],
    dispatches: [
      { invoiceNo: 'INV-2026-0711', date: '2026-08-05', qty: 25000, amount: 673611 },
      { invoiceNo: 'INV-2026-0744', date: '2026-08-12', qty: 25000, amount: 673611 },
      { invoiceNo: 'INV-2026-0782', date: '2026-08-18', qty: 25000, amount: 673611 }
    ]
  },
  {
    id: 'SO-2026-0742',
    poNumber: 'PO-ALST-2026-904',
    customerId: 'CUST-002',
    customerName: 'Alstom Transport India Ltd',
    linkedRfqId: 'RFQ-2026-0412',
    linkedRfqNumber: 'RFQ-2026-0412',
    product: 'Class H Varnished Sleeving 4mm Amber',
    partNumber: 'KU-VAR-0400-H',
    poQty: 300000,
    executedQty: 110000,
    balanceQty: 190000,
    poValue: 6200000,
    executedValue: 2273333,
    balanceValue: 3926667,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-28',
    status: 'Active',
    orderDate: '2026-08-04',
    weeklyBuckets: [
      { week: 'W2 (08-14 Aug)', qty: 50000, status: 'Delivered' },
      { week: 'W3 (15-21 Aug)', qty: 60000, status: 'Dispatched' },
      { week: 'W4 (22-28 Aug)', qty: 60000, status: 'In Production' },
      { week: 'W5 (29-31 Aug)', qty: 60000, status: 'Scheduled' },
      { week: 'W6 (01-07 Sep)', qty: 70000, status: 'Scheduled' }
    ],
    workOrders: [
      { id: 'WO-904-A', cutLength: '100m Coils', quantity: 60000, status: 'Running', machine: 'Varnish Treater 2' }
    ],
    dispatches: [
      { invoiceNo: 'INV-2026-0730', date: '2026-08-11', qty: 50000, amount: 1033333 },
      { invoiceNo: 'INV-2026-0775', date: '2026-08-17', qty: 60000, amount: 1240000 }
    ]
  },
  {
    id: 'SO-2026-0743',
    poNumber: 'PO-GE-2026-412',
    customerId: 'CUST-003',
    customerName: 'GE Power India Ltd',
    linkedRfqId: 'RFQ-2026-0419',
    linkedRfqNumber: 'RFQ-2026-0419',
    product: 'Braided Expandable Sleeving 16mm Black',
    partNumber: 'KU-BRD-1600-N',
    poQty: 175000,
    executedQty: 90000,
    balanceQty: 85000,
    poValue: 3900000,
    executedValue: 2005714,
    balanceValue: 1894286,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-24',
    status: 'Active',
    orderDate: '2026-07-14',
    weeklyBuckets: [
      { week: 'W1 (01-07 Aug)', qty: 45000, status: 'Delivered' },
      { week: 'W3 (15-21 Aug)', qty: 45000, status: 'Delivered' },
      { week: 'W4 (22-28 Aug)', qty: 45000, status: 'In Production' },
      { week: 'W5 (29-31 Aug)', qty: 40000, status: 'Scheduled' }
    ],
    workOrders: [
      { id: 'WO-412-1', cutLength: '100m Spools', quantity: 45000, status: 'Running', machine: 'Braiding Bay 4' }
    ],
    dispatches: [
      { invoiceNo: 'INV-2026-0718', date: '2026-08-06', qty: 45000, amount: 1002857 },
      { invoiceNo: 'INV-2026-0762', date: '2026-08-16', qty: 45000, amount: 1002857 }
    ]
  },
  {
    id: 'SO-2026-0744',
    poNumber: 'PO-SUZ-2026-118',
    customerId: 'CUST-004',
    customerName: 'Suzlon Energy Ltd',
    linkedRfqId: 'RFQ-2026-0420',
    linkedRfqNumber: 'RFQ-2026-0420',
    product: 'Silicone Coated Fiberglass Sleeve 8mm Black',
    partNumber: 'KU-SLV-0800-B',
    poQty: 100000,
    executedQty: 40000,
    balanceQty: 60000,
    poValue: 4100000,
    executedValue: 1640000,
    balanceValue: 2460000,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-26',
    status: 'Active',
    orderDate: '2026-07-19',
    weeklyBuckets: [
      { week: 'W2 (08-14 Aug)', qty: 40000, status: 'Delivered' },
      { week: 'W4 (22-28 Aug)', qty: 30000, status: 'In Production' },
      { week: 'W6 (01-07 Sep)', qty: 30000, status: 'Scheduled' }
    ],
    workOrders: [
      { id: 'WO-118-A', cutLength: '50m Coils', quantity: 30000, status: 'Running', machine: 'Extrusion Line 1' }
    ],
    dispatches: [
      { invoiceNo: 'INV-2026-0738', date: '2026-08-13', qty: 40000, amount: 1640000 }
    ]
  },
  {
    id: 'SO-2026-0745',
    poNumber: 'PO-CUM-2026-550',
    customerId: 'CUST-005',
    customerName: 'Cummins India Ltd',
    linkedRfqId: 'RFQ-2026-0421',
    linkedRfqNumber: 'RFQ-2026-0421',
    product: 'Heat-shrink Sleeve 8mm Red',
    partNumber: 'KU-HST-0800-R',
    poQty: 70000,
    executedQty: 25000,
    balanceQty: 45000,
    poValue: 2800000,
    executedValue: 1000000,
    balanceValue: 1800000,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-27',
    status: 'Active',
    orderDate: '2026-08-01',
    weeklyBuckets: [
      { week: 'W2 (08-14 Aug)', qty: 25000, status: 'Delivered' },
      { week: 'W4 (22-28 Aug)', qty: 25000, status: 'In Production' },
      { week: 'W5 (29-31 Aug)', qty: 20000, status: 'Scheduled' }
    ],
    workOrders: [
      { id: 'WO-550-1', cutLength: '1.2m Sticks', quantity: 25000, status: 'Running', machine: 'Cross-link Oven 2' }
    ],
    dispatches: [
      { invoiceNo: 'INV-2026-0741', date: '2026-08-14', qty: 25000, amount: 1000000 }
    ]
  },
  {
    id: 'SO-2026-0746',
    poNumber: 'PO-BSA-2026-442',
    customerId: 'CUST-010',
    customerName: 'BSA Corporation Ltd',
    linkedRfqId: 'RFQ-2026-0423',
    linkedRfqNumber: 'RFQ-2026-0423',
    product: 'Fiberglass Sleeving 2.5mm Natural',
    partNumber: 'KU-SLV-0250-N',
    poQty: 280000,
    executedQty: 120000,
    balanceQty: 160000,
    poValue: 3400000,
    executedValue: 1457143,
    balanceValue: 1942857,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-30',
    status: 'Pending Production',
    orderDate: '2026-07-29',
    weeklyBuckets: [
      { week: 'W1 (01-07 Aug)', qty: 60000, status: 'Delivered' },
      { week: 'W2 (08-14 Aug)', qty: 60000, status: 'Delivered' },
      { week: 'W5 (29-31 Aug)', qty: 80000, status: 'Scheduled' },
      { week: 'W6 (01-07 Sep)', qty: 80000, status: 'Scheduled' }
    ],
    workOrders: [],
    dispatches: [
      { invoiceNo: 'INV-2026-0708', date: '2026-08-04', qty: 60000, amount: 728571 },
      { invoiceNo: 'INV-2026-0735', date: '2026-08-12', qty: 60000, amount: 728571 }
    ]
  },
  {
    id: 'SO-2026-0747',
    poNumber: 'PO-TVS-2026-920',
    customerId: 'CUST-013',
    customerName: 'TVS Motor Company Ltd',
    linkedRfqId: 'RFQ-2026-0424',
    linkedRfqNumber: 'RFQ-2026-0424',
    product: 'Silicone Rubber Tubing 12mm White',
    partNumber: 'KU-TUB-1200-W',
    poQty: 75000,
    executedQty: 30000,
    balanceQty: 45000,
    poValue: 4400000,
    executedValue: 1760000,
    balanceValue: 2640000,
    scheduleType: 'Monthly schedule',
    nextDeliveryDate: '2026-08-29',
    status: 'Active',
    orderDate: '2026-08-06',
    weeklyBuckets: [
      { week: 'W2 (08-14 Aug)', qty: 30000, status: 'Delivered' },
      { week: 'W5 (29-31 Aug)', qty: 25000, status: 'Scheduled' },
      { week: 'W6 (01-07 Sep)', qty: 20000, status: 'Scheduled' }
    ],
    workOrders: [],
    dispatches: [
      { invoiceNo: 'INV-2026-0749', date: '2026-08-14', qty: 30000, amount: 1760000 }
    ]
  }
];

export const salesOrderSummary = {
  totalPoValue: 29650000, // ₹2.96 Cr
  totalExecutedValue: 12157021, // ₹1.21 Cr
  totalBalanceValue: 17492979, // ₹1.74 Cr
};
