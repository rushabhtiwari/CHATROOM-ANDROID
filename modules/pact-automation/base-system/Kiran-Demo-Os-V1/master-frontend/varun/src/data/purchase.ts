import { PurchaseRequest, VendorComparison, PurchaseOrderRecord, ThreeWayMatchRecord } from '../types';

export const mockSupplierPerformance = [
  { vendor: 'Saint-Gobain Vetrotex India', onTimePct: 98.4, qualityRejectPct: 0.2, leadTimeDays: 7, rating: 'Tier 1' },
  { vendor: 'Dow Chemical International', onTimePct: 95.0, qualityRejectPct: 0.5, leadTimeDays: 14, rating: 'Tier 1' },
  { vendor: 'Wacker Metroark Chemicals', onTimePct: 92.1, qualityRejectPct: 0.8, leadTimeDays: 10, rating: 'Tier 2' },
  { vendor: 'Reliance Industries (PET)', onTimePct: 99.0, qualityRejectPct: 0.1, leadTimeDays: 5, rating: 'Tier 1' },
  { vendor: 'PolyChem Emulsions Pvt Ltd', onTimePct: 88.5, qualityRejectPct: 1.4, leadTimeDays: 12, rating: 'Tier 2' }
];

export const mockPurchaseRequests: PurchaseRequest[] = [
  {
    id: 'PR-2026-0814',
    prNumber: 'PR-2026-0814',
    item: 'E-Glass Continuous Filament Yarn 68 Tex',
    partNumber: 'RM-YRN-0068-EG',
    quantity: 4500,
    uom: 'Kg',
    department: 'Stores',
    costCenter: 'CC-EXT-01',
    suggestedVendor: 'Saint-Gobain Vetrotex India',
    estimatedValue: 742500,
    isAutoPopulatedMRP: true,
    approvalRoute: 'Auto-triggered by Minimum Reorder Level (< 1,200kg in stock)',
    status: 'Pending HOD',
    createdAt: '2026-08-19'
  },
  {
    id: 'PR-2026-0810',
    prNumber: 'PR-2026-0810',
    item: 'High Viscosity Silicone Coating Emulsion (Class H)',
    partNumber: 'RM-SIL-0800-HV',
    quantity: 1200,
    uom: 'Kg',
    department: 'Production',
    costCenter: 'CC-COAT-02',
    suggestedVendor: 'Dow Chemical International',
    estimatedValue: 480000,
    isAutoPopulatedMRP: true,
    approvalRoute: 'Auto-triggered by Motherson SO-2026-0741 batch reservation',
    status: 'Approved',
    createdAt: '2026-08-18'
  },
  {
    id: 'PR-2026-0804',
    prNumber: 'PR-2026-0804',
    item: 'PET Monofilament Yarn 0.25mm Black',
    partNumber: 'RM-PET-0250-BK',
    quantity: 3000,
    uom: 'Kg',
    department: 'Stores',
    costCenter: 'CC-BRD-03',
    suggestedVendor: 'Reliance Industries (PET Polymers)',
    estimatedValue: 420000,
    isAutoPopulatedMRP: false,
    approvalRoute: 'Raised manually by Suresh Pillai',
    status: 'PO Created',
    createdAt: '2026-08-16'
  }
];

export const mockVendorComparisons: VendorComparison[] = [
  {
    rfqId: 'VRFQ-2026-012',
    rfqNumber: 'VRFQ-2026-012',
    materialName: 'High Dielectric Silicone Emulsion (UL94 V-0 Grade)',
    quantity: 2500,
    uom: 'Kg',
    vendors: [
      {
        vendorName: 'Dow Chemical International',
        price: 395.00,
        deliveryWeeks: 2,
        discountPct: 4.0,
        paymentTerms: '45 days credit',
        isBestPrice: true,
        isBestDelivery: true
      },
      {
        vendorName: 'Wacker Metroark Chemicals',
        price: 412.00,
        deliveryWeeks: 3,
        discountPct: 2.5,
        paymentTerms: '30 days credit'
      },
      {
        vendorName: 'PolyChem Emulsions Pvt Ltd',
        price: 405.00,
        deliveryWeeks: 4,
        discountPct: 5.0,
        paymentTerms: '30 days credit'
      }
    ],
    recommendedVendor: 'Dow Chemical International',
    aiRecommendationReason: 'Lowest landed cost (₹379.20/kg net of discount), 2-week faster delivery from Chennai bonded warehouse, and complies fully with UL94 V-0 requirement.'
  },
  {
    rfqId: 'VRFQ-2026-014',
    rfqNumber: 'VRFQ-2026-014',
    materialName: 'E-Glass Braid Yarn 136 Tex (Heat-treated)',
    quantity: 8000,
    uom: 'Kg',
    vendors: [
      {
        vendorName: 'Saint-Gobain Vetrotex India',
        price: 165.00,
        deliveryWeeks: 1,
        discountPct: 3.0,
        paymentTerms: '45 days credit',
        isBestPrice: true,
        isBestDelivery: true
      },
      {
        vendorName: 'Owens Corning India',
        price: 172.00,
        deliveryWeeks: 2,
        discountPct: 2.0,
        paymentTerms: '30 days credit'
      }
    ],
    recommendedVendor: 'Saint-Gobain Vetrotex India',
    aiRecommendationReason: 'Best landed rate (₹160.05/kg net), 7-day local depot delivery, existing Class H certification on file.'
  }
];

export const mockPurchaseOrders: PurchaseOrderRecord[] = [
  {
    id: 'PO-PUR-2026-0914',
    poNumber: 'PO-PUR-2026-0914',
    vendorId: 'VND-002',
    vendorName: 'Dow Chemical International Pvt Ltd',
    item: 'High Viscosity Silicone Coating Emulsion',
    quantity: 1200,
    uom: 'Kg',
    value: 480000,
    deliveryDate: '2026-08-26',
    grnStatus: 'Pending',
    sentToVendorAt: '19 Aug 2026, 09:15 AM IST (Auto-sent)',
    status: 'Open'
  },
  {
    id: 'PO-PUR-2026-0908',
    poNumber: 'PO-PUR-2026-0908',
    vendorId: 'VND-001',
    vendorName: 'Saint-Gobain Vetrotex India',
    item: 'E-Glass Continuous Filament Yarn 68 Tex',
    quantity: 4500,
    uom: 'Kg',
    value: 742500,
    deliveryDate: '2026-08-22',
    grnStatus: 'Partially Received',
    sentToVendorAt: '15 Aug 2026, 11:30 AM IST (Auto-sent)',
    status: 'In Transit'
  },
  {
    id: 'PO-PUR-2026-0895',
    poNumber: 'PO-PUR-2026-0895',
    vendorId: 'VND-005',
    vendorName: 'Reliance Industries (PET Polymers)',
    item: 'PET Monofilament Yarn 0.25mm Black',
    quantity: 3000,
    uom: 'Kg',
    value: 420000,
    deliveryDate: '2026-08-16',
    grnStatus: '3-Way Match Verified',
    sentToVendorAt: '10 Aug 2026, 14:00 PM IST (Auto-sent)',
    status: 'Completed'
  }
];

export const mockThreeWayMatchRecords: ThreeWayMatchRecord[] = [
  {
    id: 'GRN-2026-0419',
    grnNumber: 'GRN-2026-0419',
    poNumber: 'PO-PUR-2026-0892',
    invoiceNumber: 'INV-SG-88129',
    vendorName: 'Saint-Gobain Vetrotex India',
    item: 'E-Glass Braid Yarn 136 Tex',
    poQty: 4000,
    grnQty: 3800,
    deliveredQty: 3800,
    invoiceQty: 4000,
    poRate: 165.00,
    invoiceRate: 165.00,
    totalValue: 660000,
    status: 'Exception',
    exceptions: [
      {
        type: 'Quantity Mismatch',
        deltaText: 'Qty short by 200 kg (GRN: 3,800 kg vs Invoice: 4,000 kg)',
        aiExplanation: 'Stores weight slip indicates net tare discrepancy on pallet 4. Recommend issuing Debit Note DN-2026-042 for ₹33,000 before passing invoice to Accounts.'
      }
    ]
  },
  {
    id: 'GRN-2026-0412',
    grnNumber: 'GRN-2026-0412',
    poNumber: 'PO-PUR-2026-0880',
    invoiceNumber: 'INV-PC-4412',
    vendorName: 'PolyChem Emulsions Pvt Ltd',
    item: 'PU Coating Lacquer 50L Drums',
    poQty: 20,
    grnQty: 20,
    deliveredQty: 20,
    invoiceQty: 20,
    poRate: 12500.00,
    invoiceRate: 12920.00,
    totalValue: 258400,
    status: 'Exception',
    exceptions: [
      {
        type: 'Rate Mismatch',
        deltaText: 'Rate ₹420.00 higher than PO per drum (+3.36%)',
        aiExplanation: 'Vendor billed unscheduled freight surcharge without prior PO revision approval. Recommend querying vendor accounts desk.'
      }
    ]
  },
  {
    id: 'GRN-2026-0408',
    grnNumber: 'GRN-2026-0408',
    poNumber: 'PO-PUR-2026-0895',
    invoiceNumber: 'INV-RIL-99014',
    vendorName: 'Reliance Industries (PET Polymers)',
    item: 'PET Monofilament Yarn 0.25mm Black',
    poQty: 3000,
    grnQty: 3000,
    deliveredQty: 3000,
    invoiceQty: 3000,
    poRate: 140.00,
    invoiceRate: 140.00,
    totalValue: 420000,
    status: 'Matched',
    exceptions: []
  }
];
