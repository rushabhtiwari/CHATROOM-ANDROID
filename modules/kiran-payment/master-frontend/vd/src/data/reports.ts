import { ReportItem } from '../types';

export const mockReportsList: ReportItem[] = [
  {
    id: 'pending-sales-orders',
    name: 'Pending Sales Orders Report',
    description: 'Detailed customer & PO-wise balance quantity and unexecuted order book value across all production lines.',
    category: 'Sales',
    schedule: 'Daily 08:00 AM IST',
    lastRunAt: '19 Aug 2026, 08:00 AM',
    recipients: ['rajesh.kumar@kiranudyog.com', 'vikram.shetty@kiranudyog.com', 'neha.joshi@kiranudyog.com'],
    aiSummary: {
      points: [
        'Total pending sales order book stands at ₹1.75 Cr across 7 key enterprise accounts.',
        'Motherson Sumi represents 38.5% of total pending volume (1.05 lakh metres), currently pacing 2 days behind schedule on extrusion line 3.',
        'Alstom Transport August requirement is 72% executed with remaining 1.90 lakh metres scheduled across next 2 weeks.'
      ],
      generatedByModel: 'claude-sonnet-4-6',
      generatedAt: '19 Aug 2026, 08:00 AM IST'
    }
  },
  {
    id: 'product-wise-consolidated',
    name: 'Product-Wise Consolidated MIS',
    description: 'Consolidated PO vs Executed vs Balance quantity and value matrix grouped by product category.',
    category: 'Sales',
    schedule: 'Every Friday 06:00 PM IST',
    lastRunAt: '15 Aug 2026, 06:00 PM',
    recipients: ['rajesh.kumar@kiranudyog.com', 'management@kiranudyog.com'],
    aiSummary: {
      points: [
        'Silicone Coated Fiberglass (6mm & 8mm) leads total order value at ₹89.5 Lakhs (30.2% of overall book).',
        'Heat-shrink sleeving demonstrates highest gross margin realization at 24.1% on ₹28.0 Lakhs PO volume.',
        'Braided expandable sleeving 16mm capacity utilization is running at 91% in Bay 4.'
      ],
      generatedByModel: 'claude-sonnet-4-6',
      generatedAt: '15 Aug 2026, 06:00 PM IST'
    }
  },
  {
    id: 'customer-wise-mis',
    name: 'Customer-Wise Revenue & Collection MIS',
    description: 'Complete commercial scorecard per customer: Billed sales, Pending orders, Overdue receivables, and Collection health.',
    category: 'Accounts',
    schedule: 'Every Monday 09:00 AM IST',
    lastRunAt: '18 Aug 2026, 09:00 AM',
    recipients: ['meera.iyer@kiranudyog.com', 'rajesh.kumar@kiranudyog.com'],
    aiSummary: {
      points: [
        'Top 5 accounts (Motherson, Alstom, GE, Suzlon, Cummins) account for 74% of monthly billing and 81% of outstanding receivables.',
        'Collection efficiency in South region reached 98.2% supported by prompt Alstom & TVS remittances.',
        'Motherson Sumi overdue balance of ₹8.42 Lakhs is the single highest credit concern exceeding 60-day threshold.'
      ],
      generatedByModel: 'claude-sonnet-4-6',
      generatedAt: '18 Aug 2026, 09:00 AM IST'
    }
  },
  {
    id: 'weekly-receivables',
    name: 'Weekly Receivables Ageing Report',
    description: 'Critical ageing slab analysis (0-30, 31-45, 46-60, 61-90, 90+ days) with automated reminder tracking.',
    category: 'Accounts',
    schedule: 'Daily 09:00 AM IST',
    lastRunAt: '19 Aug 2026, 09:00 AM',
    recipients: ['meera.iyer@kiranudyog.com'],
    aiSummary: {
      points: [
        'Total receivables stand at ₹6.84 Cr, of which ₹13.62 Lakhs (1.99%) is classified as overdue beyond 45 days.',
        '61-90 days overdue slab is concentrated in Motherson Sumi (₹8.42 L) and Suzlon Energy (₹3.40 L).',
        '4 automated reminder runs dispatched this week; 2 accounts acknowledged with promised RTGS payment dates.'
      ],
      generatedByModel: 'claude-sonnet-4-6',
      generatedAt: '19 Aug 2026, 09:00 AM IST'
    }
  }
];

export const mockProductConsolidatedData = [
  { product: 'Silicone Coated Sleeve 6mm', poQty: 180000, execQty: 75000, balQty: 105000, poVal: 4850000, execVal: 2020833, balVal: 2829167 },
  { product: 'Class H Varnished Sleeving 4mm', poQty: 300000, execQty: 110000, balQty: 190000, poVal: 6200000, execVal: 2273333, balVal: 3926667 },
  { product: 'Braided Expandable 16mm', poQty: 175000, execQty: 90000, balQty: 85000, poVal: 3900000, execVal: 2005714, balVal: 1894286 },
  { product: 'Silicone Coated Sleeve 8mm', poQty: 100000, execQty: 40000, balQty: 60000, poVal: 4100000, execVal: 1640000, balVal: 2460000 },
  { product: 'Heat-shrink Sleeve 8mm', poQty: 70000, execQty: 25000, balQty: 45000, poVal: 2800000, execVal: 1000000, balVal: 1800000 },
  { product: 'Fiberglass Sleeving 2.5mm', poQty: 280000, execQty: 120000, balQty: 160000, poVal: 3400000, execVal: 1457143, balVal: 1942857 },
  { product: 'Silicone Rubber Tubing 12mm', poQty: 75000, execQty: 30000, balQty: 45000, poVal: 4400000, execVal: 1760000, balVal: 2640000 }
];

export const mockCustomerMISData = [
  { customer: 'Motherson Sumi Systems Ltd', salesVal: 13150000, pendingVal: 2829167, overdueVal: 842150, yetDueVal: 15617850, totalReceivable: 16460000, status: 'Overdue' },
  { customer: 'Alstom Transport India Ltd', salesVal: 11550000, pendingVal: 3926667, overdueVal: 0, yetDueVal: 11550000, totalReceivable: 11550000, status: 'On track' },
  { customer: 'GE Power India Ltd', salesVal: 7900000, pendingVal: 1894286, overdueVal: 0, yetDueVal: 7900000, totalReceivable: 7900000, status: 'On track' },
  { customer: 'Suzlon Energy Ltd', salesVal: 4100000, pendingVal: 2460000, overdueVal: 340000, yetDueVal: 8460000, totalReceivable: 8800000, status: 'At risk' },
  { customer: 'Cummins India Ltd', salesVal: 2800000, pendingVal: 1800000, overdueVal: 0, yetDueVal: 7400000, totalReceivable: 7400000, status: 'On track' },
  { customer: 'Raychem RPG Pvt Ltd', salesVal: 3100000, pendingVal: 735000, overdueVal: 180000, yetDueVal: 5720000, totalReceivable: 5900000, status: 'At risk' },
  { customer: 'BSA Corporation Ltd', salesVal: 3400000, pendingVal: 1942857, overdueVal: 0, yetDueVal: 6200000, totalReceivable: 6200000, status: 'On track' },
  { customer: 'TVS Motor Company Ltd', salesVal: 4400000, pendingVal: 2640000, overdueVal: 0, yetDueVal: 7900000, totalReceivable: 7900000, status: 'On track' }
];
