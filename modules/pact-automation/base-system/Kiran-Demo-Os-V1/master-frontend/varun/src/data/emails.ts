import { EmailIntakeItem } from '../types';

export const mockEmails: EmailIntakeItem[] = [
  {
    id: 'EML-2026-0891',
    senderName: 'Vivek Sharma',
    senderEmail: 'vivek.s@motherson.com',
    senderCompany: 'Motherson Sumi Systems Ltd',
    subject: 'RFQ: Silicone Coated Fiberglass Sleeve 6mm for EV Harness Line - Urgent 25,000 Metres',
    preview: 'Dear Rajesh ji, please provide your best commercial quote for Silicone Coated Fiberglass Sleeving 6mm Black for our upcoming EV wiring project...',
    body: `Dear Rajesh ji,

Hope you are doing well.

Please provide your best commercial quote for Silicone Coated Fiberglass Sleeving 6.0mm Black (part KU-SLV-0625-B) for our upcoming EV wiring project in Noida.

Key requirements:
1. Quantity: 25,000 Metres in 50m coils
2. Target Price: ₹26.50 / Metre
3. Dielectric requirement: 4.0 kV breakdown voltage with UL94 V-0 flame rating
4. SOP Date: 15 September 2026
5. Delivery Location: Motherson Plant 4, Sector 80, Noida, UP
6. Payment Terms: 60 days credit from invoice date

Please confirm availability and dispatch lead time. Drawings attached for reference.

Best regards,
Vivek Sharma
Senior Manager - Sourcing
Motherson Sumi Systems Ltd, Noida`,
    receivedAt: '2026-08-19T06:14:00+05:30',
    intent: 'RFQ',
    confidence: 96,
    status: 'Needs review',
    mailbox: 'sales@kiranudyog.com',
    attachments: [
      { name: 'Motherson_Sept_Schedule.xlsx', size: '1.4 MB', type: 'spreadsheet' },
      { name: 'Drawing_KU-SLV-0625.pdf', size: '840 KB', type: 'pdf' }
    ],
    isAIProcessed: true,
    matchedCustomerId: 'CUST-001',
    linkedRfqId: 'RFQ-2026-0418',
    extractedData: {
      customer: 'Motherson Sumi Systems Ltd',
      contact: 'Vivek Sharma (Senior Manager - Sourcing)',
      partNumber: 'KU-SLV-0625-B',
      description: 'Silicone Coated Fiberglass Sleeving 6.0mm Black',
      quantity: '25,000',
      uom: 'Metres',
      targetPrice: '₹26.50',
      specification: '4.0 kV breakdown voltage, UL94 V-0',
      sopDate: '15 Sep 2026',
      deliveryLocation: 'Motherson Plant 4, Sector 80, Noida, UP',
      paymentTerms: '60 days credit from invoice date',
      fieldConfidences: {
        customer: 99,
        contact: 98,
        partNumber: 97,
        description: 98,
        quantity: 99,
        uom: 99,
        targetPrice: 94,
        specification: 92,
        sopDate: 96,
        deliveryLocation: 98,
        paymentTerms: 95
      },
      fieldOrigins: {
        customer: 'Motherson Sumi Systems Ltd, Noida',
        contact: 'Vivek Sharma',
        partNumber: 'KU-SLV-0625-B',
        description: 'Silicone Coated Fiberglass Sleeving 6.0mm Black',
        quantity: '25,000 Metres',
        uom: 'Metres',
        targetPrice: '₹26.50 / Metre',
        specification: '4.0 kV breakdown voltage with UL94 V-0 flame rating',
        sopDate: '15 September 2026',
        deliveryLocation: 'Motherson Plant 4, Sector 80, Noida, UP',
        paymentTerms: '60 days credit from invoice date'
      }
    },
    replyDraft: {
      subject: 'Re: RFQ: Silicone Coated Fiberglass Sleeve 6mm for EV Harness Line - Urgent 25,000 Metres',
      body: `Dear Vivek ji,

Thank you for your inquiry. We are pleased to acknowledge your RFQ for 25,000m of Silicone Coated Fiberglass Sleeve 6mm (KU-SLV-0625-B). 

Our engineering team has reviewed the UL94 V-0 specification and confirmed full compliance. Our quotation QTE-2026-0812 is being prepared with standard 50m spool packaging and scheduled delivery by 15 September 2026.

Note: As your current overdue outstanding stands at ₹8,42,150, our accounts desk will connect regarding the regularisation of the overdue balance prior to dispatch release.

Warm regards,
Rajesh Kumar
Head of Sales — Kiran Cable Protection Products Pvt. Ltd.`,
      model: 'claude-sonnet-4-6',
      needsHODApproval: true
    }
  },
  {
    id: 'EML-2026-0892',
    senderName: 'Anil Sengupta',
    senderEmail: 'anil.sengupta@alstomgroup.com',
    senderCompany: 'Alstom Transport India Ltd',
    subject: 'Schedule Update: August Batch Dispatch confirmation for Class H Sleeving',
    preview: 'Hi Rajesh, please confirm if the 12,000 Metres of Class H varnished sleeving KU-VAR-0400-H is scheduled on time for Sri City delivery...',
    receivedAt: '2026-08-19T05:42:00+05:30',
    intent: 'Schedule',
    confidence: 94,
    status: 'Auto-created',
    mailbox: 'dispatch@kiranudyog.com',
    attachments: [
      { name: 'Alstom_Dispatch_Instructions_Aug.pdf', size: '420 KB', type: 'pdf' }
    ],
    isAIProcessed: true,
    matchedCustomerId: 'CUST-002',
    linkedRfqId: 'RFQ-2026-0412',
    body: `Hi Rajesh,

Please confirm if the 12,000 Metres of Class H varnished sleeving KU-VAR-0400-H is scheduled on time for Sri City delivery.
Our Metro train bogie harness line requires this batch before 28 August 2026.

Kindly share the vehicle number and ASN once dispatched from Secunderabad.

Best regards,
Anil Sengupta
Alstom Transport India Ltd`,
    extractedData: {
      customer: 'Alstom Transport India Ltd',
      contact: 'Anil Sengupta',
      partNumber: 'KU-VAR-0400-H',
      description: 'Class H varnished sleeving 4mm',
      quantity: '12,000',
      uom: 'Metres',
      targetPrice: 'Not found in email',
      specification: 'Class H temperature index, bogie harness line',
      sopDate: '28 Aug 2026',
      deliveryLocation: 'Sri City, Andhra Pradesh',
      paymentTerms: 'Standard contract terms (45 days)',
      fieldConfidences: {
        customer: 99,
        contact: 97,
        partNumber: 96,
        description: 95,
        quantity: 98,
        uom: 98,
        targetPrice: 40,
        specification: 88,
        sopDate: 97,
        deliveryLocation: 96,
        paymentTerms: 75
      },
      fieldOrigins: {
        customer: 'Alstom Transport India Ltd',
        contact: 'Anil Sengupta',
        partNumber: 'KU-VAR-0400-H',
        description: 'Class H varnished sleeving',
        quantity: '12,000 Metres',
        uom: 'Metres',
        targetPrice: '',
        specification: 'Metro train bogie harness line',
        sopDate: '28 August 2026',
        deliveryLocation: 'Sri City',
        paymentTerms: ''
      }
    }
  },
  {
    id: 'EML-2026-0893',
    senderName: 'Rohit Kulkarni',
    senderEmail: 'rohit.kulkarni@ge.com',
    senderCompany: 'GE Power India Ltd',
    subject: 'New Requirement: Braided Expandable Sleeving 16mm (Flame Retardant)',
    preview: 'Dear Kiran Sales, We have an immediate requirement for 18,000 Metres of KU-BRD-1600-N for turbine control panel wiring at our Sanand plant...',
    receivedAt: '2026-08-19T04:20:00+05:30',
    intent: 'RFQ',
    confidence: 97,
    status: 'Auto-created',
    mailbox: 'sales@kiranudyog.com',
    attachments: [
      { name: 'GE_Specification_ControlPanels_2026.pdf', size: '2.1 MB', type: 'pdf' }
    ],
    isAIProcessed: true,
    matchedCustomerId: 'CUST-003',
    linkedRfqId: 'RFQ-2026-0419',
    body: `Dear Kiran Sales,

We have an immediate requirement for 18,000 Metres of KU-BRD-1600-N (Braided Expandable 16mm Black) for turbine control panel wiring at our Sanand plant.

Target Price: ₹21.80 / Metre
SOP Date: 10 September 2026
Delivery: GE Power India Ltd, Sanand Industrial Area, Gujarat.

Please issue formal quotation along with UL yellow card test certificates.

Thanks,
Rohit Kulkarni
GE Power India Ltd`,
    extractedData: {
      customer: 'GE Power India Ltd',
      contact: 'Rohit Kulkarni',
      partNumber: 'KU-BRD-1600-N',
      description: 'Braided Expandable Sleeving 16mm Black',
      quantity: '18,000',
      uom: 'Metres',
      targetPrice: '₹21.80',
      specification: 'Flame retardant, UL yellow card test certificate',
      sopDate: '10 Sep 2026',
      deliveryLocation: 'Sanand Industrial Area, Gujarat',
      paymentTerms: '45 days credit',
      fieldConfidences: {
        customer: 99,
        contact: 98,
        partNumber: 99,
        description: 98,
        quantity: 99,
        uom: 99,
        targetPrice: 95,
        specification: 91,
        sopDate: 97,
        deliveryLocation: 98,
        paymentTerms: 85
      },
      fieldOrigins: {
        customer: 'GE Power India Ltd',
        contact: 'Rohit Kulkarni',
        partNumber: 'KU-BRD-1600-N',
        description: 'Braided Expandable 16mm Black',
        quantity: '18,000 Metres',
        uom: 'Metres',
        targetPrice: '₹21.80 / Metre',
        specification: 'turbine control panel wiring',
        sopDate: '10 September 2026',
        deliveryLocation: 'Sanand Industrial Area, Gujarat',
        paymentTerms: ''
      }
    }
  },
  {
    id: 'EML-2026-0894',
    senderName: 'Deepak Varma',
    senderEmail: 'procurement@aerotech-harness.co.in',
    senderCompany: 'Aerotech Harness Solutions',
    subject: 'Inquiry for Acrylic Coated Sleeving 10mm & Heat Shrink 8mm',
    preview: 'Good morning. We are setting up a tier-1 cable harness facility in Hosur and require 8,000m of 10mm Acrylic Sleeving...',
    receivedAt: '2026-08-19T03:15:00+05:30',
    intent: 'RFQ',
    confidence: 82,
    status: 'Unknown customer',
    mailbox: 'sales@kiranudyog.com',
    attachments: [
      { name: 'RFQ_Aerotech_BOM_0826.xlsx', size: '650 KB', type: 'spreadsheet' }
    ],
    isAIProcessed: true,
    matchedCustomerId: undefined,
    body: `Good morning.

We are setting up a tier-1 cable harness facility in Hosur and require:
1. 8,000 Metres of 10mm Acrylic Coated Sleeving Yellow (KU-SLV-1000-Y)
2. 5,000 Metres of Heat-shrink Sleeve 8mm Red (KU-HST-0800-R)

Delivery needed by 20 September 2026 to Hosur, Tamil Nadu.
Please send vendor registration form and quotation.

Deepak Varma
Procurement Lead
Aerotech Harness Solutions Pvt Ltd`,
    extractedData: {
      customer: 'Aerotech Harness Solutions Pvt Ltd',
      contact: 'Deepak Varma (Procurement Lead)',
      partNumber: 'KU-SLV-1000-Y & KU-HST-0800-R',
      description: 'Acrylic Coated Sleeving 10mm Yellow + Heat Shrink 8mm Red',
      quantity: '13,000',
      uom: 'Metres (Combined)',
      targetPrice: 'Not found in email',
      specification: 'Tier-1 cable harness standard',
      sopDate: '20 Sep 2026',
      deliveryLocation: 'Hosur, Tamil Nadu',
      paymentTerms: 'Not specified (Requires onboarding)',
      fieldConfidences: {
        customer: 95,
        contact: 92,
        partNumber: 88,
        description: 90,
        quantity: 92,
        uom: 90,
        targetPrice: 35,
        specification: 78,
        sopDate: 92,
        deliveryLocation: 94,
        paymentTerms: 45
      },
      fieldOrigins: {
        customer: 'Aerotech Harness Solutions Pvt Ltd',
        contact: 'Deepak Varma',
        partNumber: 'KU-SLV-1000-Y',
        description: 'Acrylic Coated Sleeving Yellow',
        quantity: '8,000 Metres',
        uom: 'Metres',
        targetPrice: '',
        specification: 'tier-1 cable harness facility',
        sopDate: '20 September 2026',
        deliveryLocation: 'Hosur, Tamil Nadu',
        paymentTerms: ''
      }
    }
  },
  {
    id: 'EML-2026-0895',
    senderName: 'Mahesh Patil',
    senderEmail: 'mahesh.patil@suzlon.com',
    senderCompany: 'Suzlon Energy Ltd',
    subject: 'PO Amendment for Suzlon Wind Generator Lead Sleeving KU-SLV-0800-B',
    preview: 'Dear Sunita, We have amended PO-SUZ-2026-118 to increase batch quantity from 6,000m to 9,500m...',
    receivedAt: '2026-08-18T18:40:00+05:30',
    intent: 'PO',
    confidence: 95,
    status: 'Auto-created',
    mailbox: 'sales@kiranudyog.com',
    attachments: [
      { name: 'PO_SUZ_2026_118_Rev2.pdf', size: '512 KB', type: 'pdf' }
    ],
    isAIProcessed: true,
    matchedCustomerId: 'CUST-004',
    body: `Dear Sunita,

We have amended PO-SUZ-2026-118 to increase batch quantity from 6,000m to 9,500m for 8mm Silicone Coated Sleeve (KU-SLV-0800-B) for our Jaisalmer wind farm nacelle assembly.

Price remains agreed at ₹37.50 / Metre.
Delivery date revised to 05 September 2026.

Please send amended sales order acknowledgement.

Regards,
Mahesh Patil
Suzlon Energy Ltd`,
    extractedData: {
      customer: 'Suzlon Energy Ltd',
      contact: 'Mahesh Patil',
      partNumber: 'KU-SLV-0800-B',
      description: '8mm Silicone Coated Sleeve Black',
      quantity: '9,500',
      uom: 'Metres',
      targetPrice: '₹37.50',
      specification: 'Wind generator lead sleeving Class H',
      sopDate: '05 Sep 2026',
      deliveryLocation: 'Jaisalmer Nacelle Plant / Pune dispatch',
      paymentTerms: '45 days credit',
      fieldConfidences: {
        customer: 99,
        contact: 98,
        partNumber: 98,
        description: 97,
        quantity: 99,
        uom: 99,
        targetPrice: 97,
        specification: 92,
        sopDate: 96,
        deliveryLocation: 90,
        paymentTerms: 91
      },
      fieldOrigins: {
        customer: 'Suzlon Energy Ltd',
        contact: 'Mahesh Patil',
        partNumber: 'KU-SLV-0800-B',
        description: '8mm Silicone Coated Sleeve',
        quantity: '9,500m',
        uom: 'Metres',
        targetPrice: '₹37.50 / Metre',
        specification: 'wind generator lead sleeving',
        sopDate: '05 September 2026',
        deliveryLocation: '',
        paymentTerms: ''
      }
    }
  },
  {
    id: 'EML-2026-0896',
    senderName: 'Sanjay Deshpande',
    senderEmail: 'sanjay.d@cummins.com',
    senderCompany: 'Cummins India Ltd',
    subject: 'Payment Advice: NEFT UTR CMS26081899124 Credited ₹14,80,000',
    preview: 'Dear Meera ji, please find attached payment advice for invoice INV-2026-0741 and INV-2026-0755...',
    receivedAt: '2026-08-18T16:22:00+05:30',
    intent: 'Payment query',
    confidence: 98,
    status: 'Auto-created',
    mailbox: 'accounts@kiranudyog.com',
    attachments: [
      { name: 'Payment_Advice_Cummins_18Aug.pdf', size: '290 KB', type: 'pdf' }
    ],
    isAIProcessed: true,
    matchedCustomerId: 'CUST-005',
    body: `Dear Meera ji,

Please find attached payment advice for invoice INV-2026-0741 and INV-2026-0755 credited to your HDFC Bank account today.
Amount: ₹14,80,000
UTR Number: CMS26081899124

Please update your ledger and issue receipt.

Warm regards,
Sanjay Deshpande
Accounts Payable | Cummins India Ltd`,
    extractedData: {
      customer: 'Cummins India Ltd',
      contact: 'Sanjay Deshpande',
      partNumber: 'N/A (Payment Advice)',
      description: 'NEFT Payment for Invoices INV-2026-0741 & 0755',
      quantity: '0',
      uom: 'N/A',
      targetPrice: '₹14,80,000',
      specification: 'UTR: CMS26081899124',
      sopDate: '18 Aug 2026',
      deliveryLocation: 'HDFC Bank Secunderabad',
      paymentTerms: 'Cleared',
      fieldConfidences: {
        customer: 99,
        contact: 98,
        partNumber: 99,
        description: 98,
        quantity: 99,
        uom: 99,
        targetPrice: 99,
        specification: 99,
        sopDate: 99,
        deliveryLocation: 95,
        paymentTerms: 99
      },
      fieldOrigins: {
        customer: 'Cummins India Ltd',
        contact: 'Sanjay Deshpande',
        partNumber: '',
        description: 'invoice INV-2026-0741 and INV-2026-0755',
        quantity: '',
        uom: '',
        targetPrice: '₹14,80,000',
        specification: 'CMS26081899124',
        sopDate: 'today',
        deliveryLocation: 'HDFC Bank account',
        paymentTerms: 'credited'
      }
    }
  }
];

export const mockEmailStats = {
  needsReview: 12,
  autoCreated: 48,
  unknownCustomer: 3,
  duplicatesMerged: 7,
  notAnRfq: 21,
  failedExtraction: 2,
  totalUnprocessed: 14
};
