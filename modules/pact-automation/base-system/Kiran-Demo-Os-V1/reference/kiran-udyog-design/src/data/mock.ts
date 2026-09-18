// TODO: replace with API call - static seed data for the structural demo.
// No network, no persistence. Nothing here survives a refresh.
//
// Account numbers are stored ALREADY MASKED. A full account number does not exist
// anywhere in this codebase, and `maskAccount()` is applied again at every render point.

import type {
  BankAccount,
  Category,
  DepartmentUtilisation,
  Employee,
  MonthlySpend,
  Notification,
  Payout,
  PolicyCap,
  ReceiptFile,
  ReceiptRequest,
  RequestStatus,
  Role,
  Stage,
  TimelineEvent,
} from '@/lib/types';

/* -------------------------------------------------------------------------- */
/* Employees                                                                   */
/* -------------------------------------------------------------------------- */

function bank(
  bankName: string,
  accountHolder: string,
  last4: string,
  ifsc: string,
  verified: boolean,
): BankAccount {
  return { bankName, accountHolder, accountNumberMasked: `XXXX XXXX ${last4}`, ifsc, verified };
}

export const employees: Employee[] = [
  {
    id: 'EMP-01',
    name: 'Ananya Iyer',
    employeeCode: 'ULA-0401',
    department: 'Engineering',
    designation: 'Principal Engineer',
    managerName: 'Rajat Khanna',
    email: 'ananya.iyer@ulacorp.in',
    monthlyAllowance: 40000,
    usedThisMonth: 18400,
    pendingAmount: 6200,
    bankAccount: bank('HDFC Bank', 'Ananya Iyer', '4417', 'HDFC0001432', true),
  },
  {
    id: 'EMP-02',
    name: 'Rohan Deshmukh',
    employeeCode: 'ULA-0402',
    department: 'Sales',
    designation: 'Regional Sales Manager',
    managerName: 'Sunita Barve',
    email: 'rohan.deshmukh@ulacorp.in',
    monthlyAllowance: 35000,
    usedThisMonth: 21600,
    pendingAmount: 8900,
    bankAccount: bank('ICICI Bank', 'Rohan Deshmukh', '9082', 'ICIC0000521', true),
  },
  {
    id: 'EMP-03',
    name: 'Farhan Qureshi',
    employeeCode: 'ULA-0403',
    department: 'Operations',
    designation: 'Plant Operations Lead',
    managerName: 'Sunita Barve',
    email: 'farhan.qureshi@ulacorp.in',
    monthlyAllowance: 30000,
    usedThisMonth: 24800,
    // Remaining = 1,700 of 30,000 (5.7%) -> the "Low balance" warning state.
    pendingAmount: 3500,
    bankAccount: bank('State Bank of India', 'Farhan Qureshi', '3311', 'SBIN0004512', true),
  },
  {
    id: 'EMP-04',
    name: 'Meera Nair',
    employeeCode: 'ULA-0404',
    department: 'Finance',
    designation: 'HR Business Partner',
    managerName: 'Deepak Rao',
    email: 'meera.nair@ulacorp.in',
    monthlyAllowance: 25000,
    usedThisMonth: 7200,
    pendingAmount: 0,
    bankAccount: bank('Axis Bank', 'Meera Nair', '7745', 'UTIB0000234', true),
  },
  {
    id: 'EMP-05',
    name: 'Vikram Sethi',
    employeeCode: 'ULA-0405',
    department: 'Finance',
    designation: 'Accounts Controller',
    managerName: 'Deepak Rao',
    email: 'vikram.sethi@ulacorp.in',
    monthlyAllowance: 28000,
    usedThisMonth: 9400,
    pendingAmount: 2200,
    bankAccount: bank('Kotak Mahindra Bank', 'Vikram Sethi', '5120', 'KKBK0000958', true),
  },
  {
    id: 'EMP-06',
    name: 'Priya Raghavan',
    employeeCode: 'ULA-0406',
    department: 'Content',
    designation: 'Senior Content Strategist',
    managerName: 'Nisha Menon',
    email: 'priya.raghavan@ulacorp.in',
    monthlyAllowance: 20000,
    usedThisMonth: 6800,
    pendingAmount: 4300,
    bankAccount: bank('HDFC Bank', 'Priya Raghavan', '8830', 'HDFC0001432', false),
  },
  {
    id: 'EMP-07',
    name: 'Arjun Bhatt',
    employeeCode: 'ULA-0407',
    department: 'Engineering',
    designation: 'Field Systems Engineer',
    managerName: 'Rajat Khanna',
    email: 'arjun.bhatt@ulacorp.in',
    monthlyAllowance: 32000,
    usedThisMonth: 12900,
    pendingAmount: 7400,
    bankAccount: bank('ICICI Bank', 'Arjun Bhatt', '2264', 'ICIC0000521', true),
  },
  {
    id: 'EMP-08',
    name: 'Sneha Kulkarni',
    employeeCode: 'ULA-0408',
    department: 'Marketing',
    designation: 'Marketing Manager',
    managerName: 'Nisha Menon',
    email: 'sneha.kulkarni@ulacorp.in',
    monthlyAllowance: 26000,
    usedThisMonth: 11200,
    pendingAmount: 5600,
    bankAccount: bank('Axis Bank', 'Sneha Kulkarni', '6019', 'UTIB0000234', true),
  },
  {
    id: 'EMP-09',
    name: 'Imran Shaikh',
    employeeCode: 'ULA-0409',
    department: 'Operations',
    designation: 'Quality Inspector',
    managerName: 'Sunita Barve',
    email: 'imran.shaikh@ulacorp.in',
    monthlyAllowance: 18000,
    usedThisMonth: 5400,
    pendingAmount: 3900,
    bankAccount: bank('State Bank of India', 'Imran Shaikh', '4478', 'SBIN0004512', false),
  },
  {
    id: 'EMP-10',
    name: 'Kavya Reddy',
    employeeCode: 'ULA-0410',
    department: 'Finance',
    designation: 'Payments Officer',
    managerName: 'Deepak Rao',
    email: 'kavya.reddy@ulacorp.in',
    monthlyAllowance: 22000,
    usedThisMonth: 4100,
    pendingAmount: 1800,
    bankAccount: bank('Kotak Mahindra Bank', 'Kavya Reddy', '9903', 'KKBK0000958', true),
  },
  {
    id: 'EMP-11',
    name: 'Nikhil Joshi',
    employeeCode: 'ULA-0411',
    department: 'Finance',
    designation: 'Financial Analyst',
    managerName: 'Deepak Rao',
    email: 'nikhil.joshi@ulacorp.in',
    monthlyAllowance: 24000,
    usedThisMonth: 8700,
    pendingAmount: 2600,
    bankAccount: bank('HDFC Bank', 'Nikhil Joshi', '1157', 'HDFC0001432', true),
  },
  {
    id: 'EMP-12',
    name: 'Tanvi Malhotra',
    employeeCode: 'ULA-0412',
    department: 'Sales',
    designation: 'HR Generalist',
    managerName: 'Sunita Barve',
    email: 'tanvi.malhotra@ulacorp.in',
    monthlyAllowance: 21000,
    usedThisMonth: 9800,
    pendingAmount: 4200,
    bankAccount: bank('ICICI Bank', 'Tanvi Malhotra', '7386', 'ICIC0000521', false),
  },
];

/** The persona the Employee Portal renders. Rohan owns requests in every tab state. */
export const CURRENT_EMPLOYEE_ID = 'EMP-02';

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

const STATUS_STAGE: Record<RequestStatus, Stage> = {
  DRAFT: 'HR',
  SUBMITTED: 'HR',
  HR_INFO_REQUESTED: 'HR',
  HR_REJECTED: 'HR',
  HR_APPROVED: 'ACCOUNTS',
  ACC_INFO_REQUESTED: 'ACCOUNTS',
  ACC_REJECTED: 'ACCOUNTS',
  ACC_APPROVED: 'PAYMENT',
  PAYMENT_QUEUED: 'PAYMENT',
  PAID: 'DONE',
  CREDITED: 'DONE',
};

const HR_ACTORS = ['Meera Nair', 'Tanvi Malhotra'];
const ACC_ACTORS = ['Vikram Sethi', 'Nikhil Joshi'];
const PAY_ACTOR = 'Kavya Reddy';

/** Adds `days` to an ISO date and returns an ISO timestamp. */
function shift(iso: string, days: number, hour = 10): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d.toISOString();
}

interface RequestSpec {
  employeeId: string;
  title: string;
  category: Category;
  amount: number;
  submittedOn: string;
  travelDates?: { from: string; to: string };
  justification: string;
  receipts: Array<[string, number]>;
  status: RequestStatus;
  slaDueOn?: string;
  duplicateOf?: string;
  hrComment?: string;
  accComment?: string;
}

/**
 * Builds a coherent timeline for a request from its status. Every event before the
 * request's current position on the happy path is emitted, with strictly increasing
 * timestamps, so the vertical timeline and the stepper always agree.
 */
function buildTimeline(id: string, spec: RequestSpec, employeeName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const seed = Number(id.slice(-2));
  const hr = HR_ACTORS[seed % HR_ACTORS.length];
  const acc = ACC_ACTORS[seed % ACC_ACTORS.length];
  const push = (
    actor: string,
    role: Role,
    action: string,
    dayOffset: number,
    comment?: string,
  ) => {
    events.push({
      id: `EVT-${id}-${events.length}`,
      actor,
      role,
      action,
      comment,
      at: shift(spec.submittedOn, dayOffset, 9 + events.length),
    });
  };

  if (spec.status === 'DRAFT') return events;

  push(employeeName, 'EMPLOYEE', 'Submitted the request', 0, spec.justification.slice(0, 90));

  if (spec.status === 'SUBMITTED') return events;

  if (spec.status === 'HR_INFO_REQUESTED') {
    push(hr, 'HR', 'More information requested by HR', 1, spec.hrComment);
    return events;
  }
  if (spec.status === 'HR_REJECTED') {
    push(hr, 'HR', 'Rejected by HR', 1, spec.hrComment);
    return events;
  }

  push(hr, 'HR', 'Approved by HR', 1, spec.hrComment);
  if (spec.status === 'HR_APPROVED') return events;

  if (spec.status === 'ACC_INFO_REQUESTED') {
    push(acc, 'ACCOUNTS', 'More information requested by Accounts', 2, spec.accComment);
    return events;
  }
  if (spec.status === 'ACC_REJECTED') {
    push(acc, 'ACCOUNTS', 'Rejected by Accounts', 2, spec.accComment);
    return events;
  }

  push(acc, 'ACCOUNTS', 'Approved by Accounts', 2, spec.accComment);
  if (spec.status === 'ACC_APPROVED') return events;

  push(PAY_ACTOR, 'PAYMENTS', 'Queued for payment', 3);
  if (spec.status === 'PAYMENT_QUEUED') return events;

  push(PAY_ACTOR, 'PAYMENTS', 'Payment disbursed', 4, 'Disbursed via NEFT to the registered account.');
  if (spec.status === 'PAID') return events;

  push(PAY_ACTOR, 'PAYMENTS', 'Credited to allowance', 5, 'Monthly allowance balance restored.');
  return events;
}

function buildReceipts(id: string, files: Array<[string, number]>, submittedOn: string): ReceiptFile[] {
  return files.map(([fileName, sizeKb], i) => ({
    id: `RCP-${id}-${i + 1}`,
    fileName,
    sizeKb,
    uploadedOn: shift(submittedOn, 0, 8 + i),
  }));
}

// 24 specs. Status tally is asserted at the bottom of this file.
const SPECS: RequestSpec[] = [
  {
    employeeId: 'EMP-02', title: 'Client visit - Pune, 3 days', category: 'TRAVEL', amount: 18400,
    submittedOn: '2026-08-28', travelDates: { from: '2026-09-02', to: '2026-09-04' },
    justification: 'Three-day on-site with Suzlon procurement to close the Q3 insulation supply renewal. Rail plus local transfers.',
    receipts: [['irctc-pnr-4471203.pdf', 240]], status: 'DRAFT',
  },
  {
    employeeId: 'EMP-07', title: 'Site inspection - Nashik plant', category: 'FUEL', amount: 4200,
    submittedOn: '2026-08-29', justification: 'Self-drive to the Nashik line for a commissioning check on the new extrusion cell.',
    receipts: [['hpcl-fuel-29aug.jpg', 380]], status: 'DRAFT',
  },
  {
    employeeId: 'EMP-01', title: 'Vendor audit - Bengaluru', category: 'TRAVEL', amount: 26800,
    submittedOn: '2026-08-24', travelDates: { from: '2026-08-27', to: '2026-08-29' },
    justification: 'Annual quality audit at the Bengaluru cable supplier ahead of contract renewal. Flights and airport transfers.',
    receipts: [['indigo-6E2043-boarding.pdf', 412], ['ola-airport-transfer.pdf', 156]],
    status: 'SUBMITTED', slaDueOn: '2026-08-27',
  },
  {
    employeeId: 'EMP-08', title: 'Trade expo travel - Delhi', category: 'TRAVEL', amount: 31500,
    submittedOn: '2026-08-26', travelDates: { from: '2026-09-08', to: '2026-09-11' },
    justification: 'Exhibiting at the India Electrical Expo. Covers return flights and two nights of accommodation.',
    receipts: [['vistara-UK955-eticket.pdf', 508]], status: 'SUBMITTED', slaDueOn: '2026-09-02',
  },
  {
    employeeId: 'EMP-09', title: 'Quality certification workshop - Mumbai', category: 'OTHER', amount: 7600,
    submittedOn: '2026-08-18', justification: 'Two-day IS 7098 certification refresher required for the annual audit sign-off.',
    receipts: [['bis-workshop-invoice.pdf', 290]], status: 'SUBMITTED', slaDueOn: '2026-08-25',
  },
  {
    employeeId: 'EMP-02', title: 'Distributor meet - Ahmedabad', category: 'LODGING', amount: 12800,
    submittedOn: '2026-08-14', travelDates: { from: '2026-08-19', to: '2026-08-21' },
    justification: 'Two nights during the western-region distributor meet. Hotel booked through the corporate desk.',
    receipts: [['fortune-park-invoice-2214.jpg', 890]], status: 'HR_INFO_REQUESTED',
    slaDueOn: '2026-08-20',
    hrComment: 'Please attach the approved distributor meet agenda and confirm the second night was required.',
  },
  {
    employeeId: 'EMP-06', title: 'Content shoot travel - Nashik', category: 'TRAVEL', amount: 9300,
    submittedOn: '2026-08-21', justification: 'Travel for the plant-floor photography shoot feeding the new product microsite.',
    receipts: [['cab-nashik-return.pdf', 175]], status: 'HR_INFO_REQUESTED', slaDueOn: '2026-08-26',
    hrComment: 'Shoot was rescheduled - confirm the revised dates before this goes to Accounts.',
  },
  {
    employeeId: 'EMP-02', title: 'Weekend client dinner - Mumbai', category: 'MEALS', amount: 8900,
    submittedOn: '2026-08-09', justification: 'Dinner with the Motherson Sumi account team following the Saturday review.',
    receipts: [['bombay-canteen-bill.jpg', 620]], status: 'HR_REJECTED',
    hrComment: 'Entertainment on a non-working day needs prior written approval from the regional head. Please re-raise with that approval attached.',
  },
  {
    employeeId: 'EMP-12', title: 'Personal vehicle service claim', category: 'OTHER', amount: 6400,
    submittedOn: '2026-07-30', justification: 'Servicing for the vehicle used on field visits through July.',
    receipts: [['service-invoice-8841.pdf', 340]], status: 'HR_REJECTED',
    hrComment: 'Vehicle maintenance is not reimbursable under the travel policy - only fuel for approved field visits.',
  },
  {
    employeeId: 'EMP-01', title: 'Team offsite lodging - Lonavala', category: 'LODGING', amount: 34200,
    submittedOn: '2026-08-20', travelDates: { from: '2026-08-23', to: '2026-08-25' },
    justification: 'Two-night engineering offsite for the platform re-architecture planning. Twelve attendees, shared rooms.',
    receipts: [['della-resorts-folio.pdf', 1240], ['gst-invoice-lonavala.pdf', 410]],
    status: 'HR_APPROVED', slaDueOn: '2026-08-27',
    hrComment: 'Offsite was on the approved calendar. Headcount and duration check out.',
  },
  {
    employeeId: 'EMP-07', title: 'Emergency line repair - Hyderabad', category: 'TRAVEL', amount: 22400,
    submittedOn: '2026-08-16', travelDates: { from: '2026-08-17', to: '2026-08-18' },
    justification: 'Same-day flight to Hyderabad to restore a failed insulation line at the customer site.',
    receipts: [['indigo-6E511-eticket.pdf', 455]], status: 'HR_APPROVED', slaDueOn: '2026-08-22',
    hrComment: 'Emergency travel, approved retrospectively per the escalation policy.',
  },
  {
    employeeId: 'EMP-11', title: 'Statutory audit support - Chennai', category: 'TRAVEL', amount: 15600,
    submittedOn: '2026-08-11', travelDates: { from: '2026-08-13', to: '2026-08-15' },
    justification: 'On-site support for the statutory auditors reviewing the Chennai depot inventory.',
    receipts: [['train-chennai-2ac.pdf', 198]], status: 'HR_APPROVED',
    // Overdue: due 18 Aug, "today" is 31 Aug.
    slaDueOn: '2026-08-18',
    hrComment: 'Audit attendance confirmed with Finance.',
  },
  {
    employeeId: 'EMP-03', title: 'Raw material sourcing trip - Delhi', category: 'TRAVEL', amount: 27300,
    submittedOn: '2026-08-12', travelDates: { from: '2026-08-18', to: '2026-08-20' },
    justification: 'Three-day sourcing visit to evaluate two alternate XLPE compound suppliers.',
    receipts: [['airasia-I5744-eticket.pdf', 388], ['delhi-hotel-folio.pdf', 720]],
    status: 'ACC_INFO_REQUESTED', slaDueOn: '2026-08-26',
    hrComment: 'Sourcing mandate confirmed with Operations.',
    accComment: 'The hotel folio total does not match the claimed amount. Please share the itemised bill.',
  },
  {
    employeeId: 'EMP-08', title: 'Campaign launch dinner - Mumbai', category: 'MEALS', amount: 11400,
    submittedOn: '2026-08-15', justification: 'Launch dinner for the Q3 brand campaign with the agency and three channel partners.',
    receipts: [['trident-banquet-invoice.pdf', 540]], status: 'ACC_INFO_REQUESTED',
    slaDueOn: '2026-08-24',
    hrComment: 'Business purpose is clear.',
    accComment: 'Attendee list needed - the per-head spend is above the meals cap without it.',
  },
  {
    employeeId: 'EMP-06', title: 'Co-working day passes - Pune', category: 'OTHER', amount: 13200,
    submittedOn: '2026-08-06', justification: 'Twelve co-working day passes used while the Pune office fit-out was in progress.',
    receipts: [['wework-invoice-33127.pdf', 265]], status: 'ACC_REJECTED',
    hrComment: 'Office was genuinely unavailable during the fit-out.',
    accComment: 'Facilities already carried this cost centrally for the same period. Duplicate of the facilities invoice.',
  },
  {
    employeeId: 'EMP-12', title: 'Regional roadshow - Nagpur', category: 'LODGING', amount: 19800,
    submittedOn: '2026-07-28', travelDates: { from: '2026-08-02', to: '2026-08-05' },
    justification: 'Three nights covering the central-region dealer roadshow.',
    receipts: [['radisson-nagpur-folio.pdf', 810]], status: 'ACC_REJECTED',
    hrComment: 'Roadshow attendance approved.',
    accComment: 'Nightly rate exceeds the lodging cap by a wide margin and no exception was pre-approved.',
  },
  {
    employeeId: 'EMP-02', title: 'Key account review - Bengaluru', category: 'TRAVEL', amount: 16700,
    submittedOn: '2026-08-08', travelDates: { from: '2026-08-12', to: '2026-08-13' },
    justification: 'Quarterly business review with the GE account team covering the FY27 volume commitment.',
    receipts: [['indigo-6E318-eticket.pdf', 402], ['uber-blr-transfers.pdf', 120]],
    status: 'ACC_APPROVED',
    hrComment: 'QBR is on the account calendar.',
    accComment: 'Within the travel cap and the Sales department headroom. Cleared for payment.',
  },
  {
    employeeId: 'EMP-09', title: 'Calibration lab visit - Pune', category: 'FUEL', amount: 5100,
    submittedOn: '2026-08-19', justification: 'Fuel for four round trips to the NABL calibration lab during the instrument re-certification.',
    receipts: [['hpcl-fuel-14aug.jpg', 356], ['bpcl-fuel-18aug.jpg', 298]],
    status: 'ACC_APPROVED',
    // The seeded duplicate - drives the Accounts warning banner.
    duplicateOf: 'REQ-2026-0122',
    hrComment: 'Re-certification schedule confirmed.',
    accComment: 'Receipt totals match REQ-2026-0122 - flagged for a duplicate check before disbursement.',
  },
  {
    employeeId: 'EMP-01', title: 'Standards committee meeting - Delhi', category: 'TRAVEL', amount: 21900,
    submittedOn: '2026-08-04', travelDates: { from: '2026-08-07', to: '2026-08-08' },
    justification: 'Representing the company on the BIS insulation standards revision committee.',
    receipts: [['airindia-AI865-eticket.pdf', 470]], status: 'PAYMENT_QUEUED',
    hrComment: 'Committee representation is a standing commitment.',
    accComment: 'Within cap. Queued in the 12 Aug disbursement batch.',
  },
  {
    employeeId: 'EMP-05', title: 'Bank reconciliation visit - Mumbai', category: 'FUEL', amount: 3400,
    submittedOn: '2026-08-10', justification: 'Local travel across three bank branches to close the July reconciliation.',
    receipts: [['fuel-mumbai-10aug.jpg', 212]], status: 'PAYMENT_QUEUED',
    hrComment: 'Routine finance activity.',
    accComment: 'Small-value claim, within the fuel cap.',
  },
  {
    employeeId: 'EMP-02', title: 'Partner onboarding - Chennai', category: 'TRAVEL', amount: 14300,
    submittedOn: '2026-07-24', travelDates: { from: '2026-07-29', to: '2026-07-30' },
    justification: 'Onboarding visit for the new southern-region channel partner, including the contract signing.',
    receipts: [['train-chennai-3ac.pdf', 186]], status: 'PAID',
    hrComment: 'Partner onboarding approved by the regional head.',
    accComment: 'Cleared. Within travel cap and department headroom.',
  },
  {
    employeeId: 'EMP-09', title: 'Instrument re-certification - Pune', category: 'FUEL', amount: 5100,
    submittedOn: '2026-07-21', justification: 'Fuel for the NABL calibration lab round trips during the July re-certification cycle.',
    receipts: [['hpcl-fuel-21jul.jpg', 344]], status: 'PAID',
    hrComment: 'Re-certification is mandatory annually.',
    accComment: 'Approved against the July fuel budget.',
  },
  {
    employeeId: 'EMP-02', title: 'Customer escalation visit - Pune', category: 'TRAVEL', amount: 11200,
    submittedOn: '2026-07-14', travelDates: { from: '2026-07-16', to: '2026-07-17' },
    justification: 'Overnight visit to resolve the Alstom delivery escalation and agree a revised schedule.',
    receipts: [['cab-pune-return.pdf', 165], ['hotel-pune-folio.pdf', 640]],
    status: 'CREDITED',
    hrComment: 'Escalation visit was necessary and time-critical.',
    accComment: 'Within all caps. Approved for disbursement.',
  },
  {
    employeeId: 'EMP-04', title: 'Campus hiring drive - Pune', category: 'OTHER', amount: 17800,
    submittedOn: '2026-07-08', travelDates: { from: '2026-07-11', to: '2026-07-12' },
    justification: 'Two-day campus hiring drive at COEP covering venue charges and candidate refreshments.',
    receipts: [['coep-venue-invoice.pdf', 430], ['catering-bill-11jul.jpg', 275]],
    status: 'CREDITED',
    hrComment: 'Hiring drive was on the approved recruitment plan.',
    accComment: 'Venue and catering within the events allocation.',
  },
];

export const requests: ReceiptRequest[] = SPECS.map((spec, i) => {
  // Padded to 4 digits so these match the requestId references in `payouts`,
  // `notifications` and the `duplicateOf` flag.
  const id = `REQ-2026-${String(101 + i).padStart(4, '0')}`;
  const employee = employees.find((e) => e.id === spec.employeeId);
  const employeeName = employee ? employee.name : 'Unknown';
  return {
    id,
    employeeId: spec.employeeId,
    title: spec.title,
    category: spec.category,
    amount: spec.amount,
    currency: 'INR',
    submittedOn: spec.submittedOn,
    travelDates: spec.travelDates,
    justification: spec.justification,
    receipts: buildReceipts(id, spec.receipts, spec.submittedOn),
    status: spec.status,
    currentStage: STATUS_STAGE[spec.status],
    timeline: buildTimeline(id, spec, employeeName),
    slaDueOn: spec.slaDueOn,
    duplicateOf: spec.duplicateOf,
  };
});

/* -------------------------------------------------------------------------- */
/* Payouts                                                                     */
/* -------------------------------------------------------------------------- */

export const payouts: Payout[] = [
  {
    id: 'PAY-2026-0081', requestId: 'REQ-2026-0117', employeeId: 'EMP-02', amount: 16700,
    method: 'NEFT', status: 'QUEUED', initiatedOn: '2026-08-30',
  },
  {
    id: 'PAY-2026-0082', requestId: 'REQ-2026-0118', employeeId: 'EMP-09', amount: 5100,
    method: 'UPI', status: 'QUEUED', initiatedOn: '2026-08-30',
  },
  {
    id: 'PAY-2026-0083', requestId: 'REQ-2026-0119', employeeId: 'EMP-01', amount: 21900,
    method: 'NEFT', status: 'PROCESSING', initiatedOn: '2026-08-29',
  },
  {
    id: 'PAY-2026-0084', requestId: 'REQ-2026-0120', employeeId: 'EMP-05', amount: 3400,
    method: 'IMPS', status: 'PROCESSING', initiatedOn: '2026-08-29',
  },
  {
    id: 'PAY-2026-0085', requestId: 'REQ-2026-0121', employeeId: 'EMP-02', amount: 14300,
    method: 'NEFT', status: 'PAID', utr: 'UTR2026080112345678',
    initiatedOn: '2026-08-01', settledOn: '2026-08-02',
  },
  {
    id: 'PAY-2026-0086', requestId: 'REQ-2026-0122', employeeId: 'EMP-09', amount: 5100,
    method: 'UPI', status: 'PAID', utr: 'UTR2026072998765432',
    initiatedOn: '2026-07-29', settledOn: '2026-07-29',
  },
  {
    id: 'PAY-2026-0087', requestId: 'REQ-2026-0123', employeeId: 'EMP-02', amount: 11200,
    method: 'NEFT', status: 'PAID', utr: 'UTR2026072244556677',
    initiatedOn: '2026-07-22', settledOn: '2026-07-23',
  },
  {
    id: 'PAY-2026-0088', requestId: 'REQ-2026-0124', employeeId: 'EMP-04', amount: 17800,
    method: 'IMPS', status: 'FAILED', initiatedOn: '2026-07-16',
    failureReason: 'Beneficiary IFSC mismatch - account frozen by bank',
  },
];

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export const notifications: Notification[] = [
  {
    id: 'NTF-01', toRole: 'HR', title: 'New request awaiting HR review',
    body: 'Ananya Iyer raised REQ-2026-0103 for a Bengaluru vendor audit. SLA expires today.',
    at: '2026-08-31T09:15:00+05:30', read: false, requestId: 'REQ-2026-0103',
  },
  {
    id: 'NTF-02', toRole: 'ACCOUNTS', title: 'Possible duplicate claim flagged',
    body: 'REQ-2026-0118 has receipt totals matching REQ-2026-0122. Review before disbursement.',
    at: '2026-08-31T08:40:00+05:30', read: false, requestId: 'REQ-2026-0118',
  },
  {
    id: 'NTF-03', toRole: 'EMPLOYEE', toEmployeeId: 'EMP-02',
    title: 'More information requested on REQ-2026-0106',
    body: 'HR asked for the distributor meet agenda and confirmation of the second night.',
    at: '2026-08-31T07:55:00+05:30', read: false, requestId: 'REQ-2026-0106',
  },
  {
    id: 'NTF-04', toRole: 'PAYMENTS', title: 'Payout failed - action required',
    body: 'PAY-2026-0088 failed with an IFSC mismatch. Retry once the bank record is corrected.',
    at: '2026-08-30T16:20:00+05:30', read: false, requestId: 'REQ-2026-0124',
  },
  {
    id: 'NTF-05', toRole: 'ACCOUNTS', title: 'Request overdue in the Accounts queue',
    body: 'REQ-2026-0112 passed its SLA on 18 Aug and is still awaiting financial review.',
    at: '2026-08-29T11:05:00+05:30', read: true, requestId: 'REQ-2026-0112',
  },
  {
    id: 'NTF-06', toRole: 'EMPLOYEE', toEmployeeId: 'EMP-02',
    title: 'REQ-2026-0117 approved by Accounts',
    body: 'Your Bengaluru key account review was cleared and is queued for payment.',
    at: '2026-08-28T14:30:00+05:30', read: true, requestId: 'REQ-2026-0117',
  },
  {
    id: 'NTF-07', toRole: 'HR', title: 'Two requests rejected this week',
    body: 'REQ-2026-0108 and REQ-2026-0109 were declined. Both employees have been notified.',
    at: '2026-08-27T10:10:00+05:30', read: true,
  },
  {
    id: 'NTF-08', toRole: 'EMPLOYEE', toEmployeeId: 'EMP-02',
    title: 'REQ-2026-0123 credited to your allowance',
    body: 'Rs 11,200 has been credited. Your remaining balance has been updated.',
    at: '2026-08-25T09:00:00+05:30', read: true, requestId: 'REQ-2026-0123',
  },
  {
    id: 'NTF-09', toRole: 'PAYMENTS', title: 'Three bank accounts pending verification',
    body: 'Priya Raghavan, Imran Shaikh and Tanvi Malhotra have unverified account records.',
    at: '2026-08-24T15:45:00+05:30', read: true,
  },
  {
    id: 'NTF-10', toRole: 'ADMIN', title: 'Engineering is at 84% allowance utilisation',
    body: 'The Engineering department has used most of its monthly allocation with a week to run.',
    at: '2026-08-23T12:00:00+05:30', read: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Aggregates                                                                  */
/* -------------------------------------------------------------------------- */

export const monthlySpend: MonthlySpend[] = [
  { month: 'Mar', disbursed: 1180000, budget: 1400000 },
  { month: 'Apr', disbursed: 1320000, budget: 1400000 },
  { month: 'May', disbursed: 960000, budget: 1400000 },
  { month: 'Jun', disbursed: 1540000, budget: 1600000 },
  { month: 'Jul', disbursed: 1710000, budget: 1600000 },
  { month: 'Aug', disbursed: 1285000, budget: 1600000 },
];

export const departmentUtilisation: DepartmentUtilisation[] = [
  { department: 'Engineering', allocated: 720000, used: 605000, pending: 42000, headcount: 3 },
  { department: 'Sales', allocated: 560000, used: 318000, pending: 74000, headcount: 3 },
  { department: 'Operations', allocated: 480000, used: 291000, pending: 38000, headcount: 2 },
  { department: 'Finance', allocated: 640000, used: 274000, pending: 31000, headcount: 4 },
  { department: 'Content', allocated: 240000, used: 118000, pending: 22000, headcount: 1 },
  { department: 'Marketing', allocated: 320000, used: 176000, pending: 29000, headcount: 1 },
];

export const policyCaps: PolicyCap[] = [
  { category: 'TRAVEL', label: 'Travel cap', cap: 25000, unit: 'per trip' },
  { category: 'LODGING', label: 'Lodging cap', cap: 4000, unit: 'per night' },
  { category: 'MEALS', label: 'Meals cap', cap: 1200, unit: 'per day' },
  { category: 'FUEL', label: 'Fuel cap', cap: 8000, unit: 'per month' },
  { category: 'OTHER', label: 'General claim cap', cap: 10000, unit: 'per claim' },
];

/** Derived, never hand-typed, so it can not drift from `requests`. */
export const categorySpend: { category: Category; amount: number; count: number }[] = (() => {
  const order: Category[] = ['TRAVEL', 'LODGING', 'MEALS', 'FUEL', 'OTHER'];
  const totals = new Map<Category, { amount: number; count: number }>();
  for (const c of order) totals.set(c, { amount: 0, count: 0 });
  for (const r of requests) {
    const entry = totals.get(r.category);
    if (entry) {
      entry.amount += r.amount;
      entry.count += 1;
    }
  }
  return order.map((category) => ({ category, ...totals.get(category)! }));
})();

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

export function getEmployee(id: string): Employee | undefined {
  return employees.find((e) => e.id === id);
}

export function getRequest(id: string): ReceiptRequest | undefined {
  return requests.find((r) => r.id === id);
}

export function requestsForEmployee(id: string): ReceiptRequest[] {
  return requests.filter((r) => r.employeeId === id);
}

// Status tally across the 24 seeded requests — every status appears at least twice:
//   DRAFT 2 · SUBMITTED 3 · HR_INFO_REQUESTED 2 · HR_REJECTED 2 · HR_APPROVED 3
//   ACC_INFO_REQUESTED 2 · ACC_REJECTED 2 · ACC_APPROVED 2 · PAYMENT_QUEUED 2
//   PAID 2 · CREDITED 2   = 24
