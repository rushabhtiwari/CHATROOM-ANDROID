import { Quotation } from '../types';

export const mockQuotations: Quotation[] = [
  {
    id: 'QTE-2026-0812',
    quoteNumber: 'QTE-2026-0812',
    rfqId: 'RFQ-2026-0418',
    rfqNumber: 'RFQ-2026-0418',
    customerId: 'CUST-001',
    customerName: 'Motherson Sumi Systems Ltd',
    contactPerson: 'Vivek Sharma',
    contactEmail: 'vivek.s@motherson.com',
    items: [
      {
        id: 'QI-1',
        partNumber: 'KU-SLV-0625-B',
        description: 'Silicone Coated Fiberglass Sleeving 6.0mm Black (EV Specification, Class H 180°C)',
        quantity: 25000,
        uom: 'Metres',
        standardPrice: 28.00,
        offeredPrice: 30.35, // 8.4% above standard
        discountPct: 0,
        marginPct: 22.4,
        hsnCode: '85469090',
        gstRate: 18,
        deliveryWeeks: 3,
        isPriceAboveStandard: true
      },
      {
        id: 'QI-2',
        partNumber: 'KU-HST-0800-R',
        description: 'Heat-shrink Sleeve 8mm Red (Dual-wall adhesive lined)',
        quantity: 5000,
        uom: 'Metres',
        standardPrice: 42.00,
        offeredPrice: 45.50, // 8.3% above standard
        discountPct: 0,
        marginPct: 24.1,
        hsnCode: '39173290',
        gstRate: 18,
        deliveryWeeks: 2,
        isPriceAboveStandard: true
      }
    ],
    totalValue: 986250,
    totalGst: 177525,
    grandTotal: 1163775,
    marginPct: 22.8,
    status: 'Awaiting HOD',
    validTill: '2026-08-23', // Expiring in 4 days! (Amber row highlight)
    followUpsSent: 0,
    isExpiringSoon: true,
    hasPriceIncrease: true,
    priceIncreasePct: 8.4,
    approvalRequiredBy: 'Rajesh Kumar (HOD Sales)',
    commercialTerms: `1. Prices are EX-WORKS Secunderabad, freight extra at actuals.
2. GST 18% extra as applicable at the time of invoicing.
3. Delivery: 2-3 weeks from confirmed PO and drawing clearance.
4. Payment: 60 days credit from invoice date, subject to clearance of overdue balance.
5. Validity: 15 days from quote date.`,
    paymentTerms: '60 days net from invoice date',
    freightTerms: 'Ex-Works Secunderabad / Door delivery extra at actuals',
    createdAt: '2026-08-18'
  },
  {
    id: 'QTE-2026-0814',
    quoteNumber: 'QTE-2026-0814',
    rfqId: 'RFQ-2026-0419',
    rfqNumber: 'RFQ-2026-0419',
    customerId: 'CUST-003',
    customerName: 'GE Power India Ltd',
    contactPerson: 'Rohit Kulkarni',
    contactEmail: 'rohit.kulkarni@ge.com',
    items: [
      {
        id: 'QI-3',
        partNumber: 'KU-BRD-1600-N',
        description: 'Braided Expandable Sleeving 16mm Black (PET Monofilament, Flame Retardant)',
        quantity: 18000,
        uom: 'Metres',
        standardPrice: 22.00,
        offeredPrice: 22.00,
        discountPct: 0,
        marginPct: 22.0,
        hsnCode: '59090090',
        gstRate: 18,
        deliveryWeeks: 2,
        isPriceAboveStandard: false
      }
    ],
    totalValue: 396000,
    totalGst: 71280,
    grandTotal: 467280,
    marginPct: 22.0,
    status: 'Sent',
    sentAt: '2026-08-18T11:45:00+05:30',
    validTill: '2026-09-02',
    followUpsSent: 0,
    isExpiringSoon: false,
    hasPriceIncrease: false,
    priceIncreasePct: 0,
    commercialTerms: `1. Prices are FOR Destination Sanand, Gujarat.
2. Taxes: GST 18% extra.
3. Test Certificates: Routine test report + UL Yellow Card certificate included.
4. Payment: 45 days against submission of verified invoices.`,
    paymentTerms: '45 days net',
    freightTerms: 'FOR Sanand (Included)',
    createdAt: '2026-08-18'
  },
  {
    id: 'QTE-2026-0801',
    quoteNumber: 'QTE-2026-0801',
    rfqId: 'RFQ-2026-0422',
    rfqNumber: 'RFQ-2026-0422',
    customerId: 'CUST-007',
    customerName: 'Raychem RPG Pvt Ltd',
    contactPerson: 'Nitin Sawant',
    contactEmail: 'nsawant@raychemrpg.com',
    items: [
      {
        id: 'QI-4',
        partNumber: 'KU-PUC-0400-C',
        description: 'PU Coated Sleeve 4mm Clear (Class F 155°C)',
        quantity: 30000,
        uom: 'Metres',
        standardPrice: 24.50,
        offeredPrice: 24.50,
        discountPct: 0,
        marginPct: 19.0,
        hsnCode: '85469090',
        gstRate: 18,
        deliveryWeeks: 3,
        isPriceAboveStandard: false
      }
    ],
    totalValue: 735000,
    totalGst: 132300,
    grandTotal: 867300,
    marginPct: 19.0,
    status: 'Under negotiation',
    sentAt: '2026-08-12T14:10:00+05:30',
    validTill: '2026-08-22', // Expiring in 3 days! (Amber row highlight)
    followUpsSent: 2,
    isExpiringSoon: true,
    hasPriceIncrease: false,
    priceIncreasePct: 0,
    commercialTerms: 'Standard commercial terms as per Raychem rate contract.',
    paymentTerms: '45 days from invoice date',
    freightTerms: 'Ex-Works Secunderabad',
    createdAt: '2026-08-12'
  },
  {
    id: 'QTE-2026-0809',
    quoteNumber: 'QTE-2026-0809',
    rfqId: 'RFQ-2026-0425',
    rfqNumber: 'RFQ-2026-0425',
    customerId: 'CUST-009',
    customerName: 'Regal Beloit India Pvt Ltd',
    contactPerson: 'Prashant Nair',
    contactEmail: 'prashant.nair@regalrexnord.com',
    items: [
      {
        id: 'QI-5',
        partNumber: 'KU-SLV-1000-Y',
        description: 'Acrylic Coated Sleeve 10mm Yellow (Motor Leads)',
        quantity: 14000,
        uom: 'Metres',
        standardPrice: 34.50,
        offeredPrice: 34.50,
        discountPct: 0,
        marginPct: 23.5,
        hsnCode: '85469090',
        gstRate: 18,
        deliveryWeeks: 2,
        isPriceAboveStandard: false
      }
    ],
    totalValue: 483000,
    totalGst: 86940,
    grandTotal: 569940,
    marginPct: 23.5,
    status: 'Sent',
    sentAt: '2026-08-16T17:00:00+05:30',
    validTill: '2026-08-31',
    followUpsSent: 1,
    isExpiringSoon: false,
    hasPriceIncrease: false,
    priceIncreasePct: 0,
    commercialTerms: 'Door delivery Hyderabad local plant.',
    paymentTerms: '30 days net',
    freightTerms: 'Included',
    createdAt: '2026-08-16'
  },
  {
    id: 'QTE-2026-0798',
    quoteNumber: 'QTE-2026-0798',
    rfqId: 'RFQ-2026-0426',
    rfqNumber: 'RFQ-2026-0426',
    customerId: 'CUST-006',
    customerName: 'Crompton Greaves Consumer Electricals',
    contactPerson: 'Gaurav Banerjee',
    contactEmail: 'gaurav.b@crompton.co.in',
    items: [
      {
        id: 'QI-6',
        partNumber: 'KU-VAR-0400-H',
        description: 'Varnished Sleeving Class H 4mm Amber',
        quantity: 40000,
        uom: 'Metres',
        standardPrice: 19.80,
        offeredPrice: 19.80,
        discountPct: 0,
        marginPct: 22.0,
        hsnCode: '85469090',
        gstRate: 18,
        deliveryWeeks: 3,
        isPriceAboveStandard: false
      }
    ],
    totalValue: 792000,
    totalGst: 142560,
    grandTotal: 934560,
    marginPct: 22.0,
    status: 'Accepted',
    sentAt: '2026-08-10T11:00:00+05:30',
    validTill: '2026-08-25',
    followUpsSent: 1,
    isExpiringSoon: false,
    hasPriceIncrease: false,
    priceIncreasePct: 0,
    commercialTerms: 'Annual rate contract terms apply.',
    paymentTerms: '45 days from GRN',
    freightTerms: 'Ex-Works',
    createdAt: '2026-08-10'
  }
];
