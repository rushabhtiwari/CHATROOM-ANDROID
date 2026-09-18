/**
 * Seed data for the workspace.
 *
 * The people here are the same people the finance module bills against, down
 * to the employee ids: the signed-in user is the regional sales manager whose
 * claims appear in the reimbursement ledger, and the HR partner he sends
 * receipts to is the one whose queue they land in. That correspondence is the
 * point — a claim filed in a conversation and the same claim on the finance
 * screen have to be obviously one thing.
 *
 * The conversations are written to read like a Tuesday afternoon at a cable
 * protection manufacturer: partial threads, open questions, a decision nobody
 * has taken yet. An empty or uniformly cheerful workspace is what makes a
 * collaboration tool look like a prototype.
 *
 * Ids are load-bearing — rooms, threads, reactions and read markers all
 * reference them. Change the words, not the `u*`, `d*`, `r*` or `gd1` keys.
 */

import type { PrivateAIMessage, Room, SharedMessage, User, UserGroup } from "./chat-types";

const now = Date.now();
const min = 60_000;
const day = 24 * 60 * min;

/* -------------------------------------------------------------------------- */
/* Directory                                                                  */
/* -------------------------------------------------------------------------- */

export const SEED_USERS: User[] = [
  {
    id: "u1",
    name: "Rohan Deshmukh",
    role: "Regional Sales Manager",
    department: "Sales",
    email: "rohan.deshmukh@kirancable.co.in",
    online: true,
    color: "#4cc9f0",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u2",
    name: "Ananya Iyer",
    role: "Principal Engineer",
    department: "Engineering",
    email: "ananya.iyer@kirancable.co.in",
    online: true,
    color: "#b388ff",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u3",
    name: "Arjun Bhatt",
    role: "Field Systems Engineer",
    department: "Engineering",
    email: "arjun.bhatt@kirancable.co.in",
    online: false,
    color: "#ffb703",
    timeZone: "Europe/Berlin",
  },
  {
    id: "u4",
    name: "Priya Raghavan",
    role: "Senior Content Strategist",
    department: "Content",
    email: "priya.raghavan@kirancable.co.in",
    online: true,
    color: "#4ade80",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u5",
    name: "Imran Shaikh",
    role: "Quality Inspector",
    department: "Operations",
    email: "imran.shaikh@kirancable.co.in",
    online: false,
    color: "#f472b6",
    timeZone: "America/New_York",
  },
  {
    id: "u6",
    name: "Rajat Khanna",
    role: "Head of Engineering",
    department: "Engineering",
    email: "rajat.khanna@kirancable.co.in",
    online: true,
    color: "#fb7185",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u7",
    name: "Meera Nair",
    role: "HR Business Partner",
    department: "People",
    email: "meera.nair@kirancable.co.in",
    online: true,
    color: "#38bdf8",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u8",
    name: "Tanvi Malhotra",
    role: "HR Generalist",
    department: "People",
    email: "tanvi.malhotra@kirancable.co.in",
    online: true,
    color: "#f97316",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u9",
    name: "Sunita Barve",
    role: "Head of Operations",
    department: "Operations",
    email: "sunita.barve@kirancable.co.in",
    online: false,
    color: "#a78bfa",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u10",
    name: "Vikram Sethi",
    role: "Accounts Controller",
    department: "Finance",
    email: "vikram.sethi@kirancable.co.in",
    online: false,
    color: "#2dd4bf",
    timeZone: "Europe/London",
  },
  {
    id: "u11",
    name: "Sneha Kulkarni",
    role: "Marketing Manager",
    department: "Marketing",
    email: "sneha.kulkarni@kirancable.co.in",
    online: true,
    color: "#e879f9",
    timeZone: "Asia/Kolkata",
  },
  {
    id: "u12",
    name: "Farhan Qureshi",
    role: "Plant Operations Lead",
    department: "Operations",
    email: "farhan.qureshi@kirancable.co.in",
    online: true,
    color: "#facc15",
    timeZone: "Asia/Singapore",
  },
  {
    id: "u13",
    name: "Deepak Rao",
    role: "Chief Financial Officer",
    department: "Finance",
    email: "deepak.rao@kirancable.co.in",
    online: false,
    color: "#818cf8",
    timeZone: "Europe/Berlin",
  },
  {
    id: "u14",
    name: "Kavya Reddy",
    role: "Payments Officer",
    department: "Finance",
    email: "kavya.reddy@kirancable.co.in",
    online: true,
    color: "#22d3ee",
    timeZone: "Asia/Kolkata",
  },
];

export const SEED_GROUPS: UserGroup[] = [
  { id: "g-eng", handle: "engineering", name: "Engineering", memberIds: ["u2", "u3", "u6"] },
  { id: "g-design", handle: "design", name: "Product Development", memberIds: ["u4"] },
  { id: "g-leads", handle: "leads", name: "Department heads", memberIds: ["u6", "u7", "u9", "u13"] },
  { id: "g-sales", handle: "sales", name: "Sales", memberIds: ["u1", "u11"] },
  { id: "g-people", handle: "people", name: "People team", memberIds: ["u7", "u8"] },
];

/* -------------------------------------------------------------------------- */
/* Rooms                                                                      */
/* -------------------------------------------------------------------------- */

const EVERYONE = SEED_USERS.map((user) => user.id);

export const SEED_ROOMS: Room[] = [
  /* ------------------------------ Departments ----------------------------- */
  {
    id: "d-people",
    type: "group",
    category: "department",
    name: "People & HR",
    topic: "Leave, payroll and reimbursement policy",
    description:
      "Policy, leave, payroll dates and the reimbursement rules. Everyone is a member.",
    createdBy: "u7",
    createdAt: now - day * 180,
    adminIds: ["u7", "u9"],
    participantIds: EVERYONE,
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#38bdf8",
  },
  {
    id: "d-eng",
    type: "group",
    category: "department",
    name: "Engineering",
    topic: "Extrusion lines, die changes and field failures",
    description:
      "Extrusion line coordination: die changes, wall-thickness trials, field failure analysis and product specification decisions.",
    createdBy: "u13",
    createdAt: now - day * 150,
    adminIds: ["u13", "u3"],
    participantIds: ["u1", "u2", "u3", "u5", "u13", "u14"],
    groupMuted: false,
    mutedUserIds: [],
    invite: {
      code: "ENG4417",
      createdAt: now - day * 30,
      expiresAt: now + day * 14,
      maxUses: 40,
      uses: 11,
    },
    color: "#818cf8",
  },
  {
    id: "d-design",
    type: "group",
    category: "department",
    name: "Product Development",
    topic: "HDPE duct spec revision under review",
    description:
      "New product introduction: material trials, wall-thickness specifications and the drawings that go with each SKU.",
    createdBy: "u4",
    createdAt: now - day * 140,
    adminIds: ["u4"],
    participantIds: ["u1", "u2", "u4", "u11", "u13"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#4ade80",
  },
  {
    id: "r2",
    type: "group",
    category: "department",
    name: "Sales",
    topic: "Pipeline review every Thursday",
    description:
      "Enquiries, quotations, order status and customer escalations across all four regions. Bring numbers, not adjectives.",
    createdBy: "u6",
    createdAt: now - day * 12,
    adminIds: ["u6", "u1"],
    participantIds: ["u1", "u2", "u6", "u5"],
    groupMuted: false,
    mutedUserIds: [],
    invite: {
      code: "SLS900",
      createdAt: now - day * 12,
      expiresAt: null,
      maxUses: null,
      uses: 1,
    },
    color: "#b388ff",
  },
  {
    id: "d-marketing",
    type: "group",
    category: "department",
    name: "Marketing",
    topic: "Elecrama stand and the Q3 catalogue",
    description: "Campaigns, trade shows, the product catalogue, and anything that carries the Kiran mark outside the company.",
    createdBy: "u11",
    createdAt: now - day * 120,
    adminIds: ["u11"],
    participantIds: ["u1", "u4", "u6", "u11"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#e879f9",
  },
  {
    id: "d-success",
    type: "group",
    category: "department",
    name: "Customer Support",
    topic: "Site complaints and warranty claims",
    description:
      "Installation queries, warranty claims and site complaints. Anything that needs a root cause goes to Engineering with the lot number.",
    createdBy: "u12",
    createdAt: now - day * 100,
    adminIds: ["u12"],
    participantIds: ["u1", "u5", "u6", "u12"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#facc15",
  },
  {
    id: "d-finance",
    type: "group",
    category: "department",
    name: "Finance & Accounts",
    topic: "August close on the 5th",
    description:
      "Receivables, payables, reimbursements and the monthly close. Approvals over ₹2,00,000 need a thread here.",
    createdBy: "u10",
    createdAt: now - day * 160,
    adminIds: ["u10"],
    participantIds: ["u1", "u6", "u7", "u10"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#2dd4bf",
  },

  /* -------------------------------- Projects ------------------------------ */
  {
    id: "r1",
    type: "group",
    category: "project",
    name: "Plant Expansion — Unit 3",
    topic: "Machine order decision due Friday",
    description: "Unit 3 expansion: line capacity, machine selection, civil works schedule and the capital budget behind them.",
    createdBy: "u1",
    createdAt: now - day * 21,
    adminIds: ["u1"],
    participantIds: ["u1", "u2", "u3", "u4", "u5", "u6"],
    groupMuted: false,
    mutedUserIds: ["u3"],
    invite: {
      code: "ABC123",
      createdAt: now - day * 21,
      expiresAt: now + day * 7,
      maxUses: 25,
      uses: 3,
    },
    color: "#4cc9f0",
  },
  {
    id: "r3",
    type: "group",
    category: "project",
    name: "Bharat Metro — Duct Order",
    topic: "Dispatch window: 27th–29th",
    description: "Execution room for the Bharat Metro duct order: production slotting, quality clearance, packing and dispatch.",
    createdBy: "u1",
    createdAt: now - day * 5,
    adminIds: ["u1"],
    participantIds: ["u1", "u3", "u4"],
    groupMuted: false,
    mutedUserIds: [],
    invite: {
      code: "ALP447",
      createdAt: now - day * 5,
      expiresAt: now - day,
      maxUses: 10,
      uses: 2,
    },
    color: "#4ade80",
  },
  {
    id: "p-atlas",
    type: "group",
    category: "project",
    name: "PACT ERP Rollout",
    topic: "Cutover window: 27th, 01:00–04:00 IST",
    description:
      "Moving purchase, stores and dispatch onto PACT. The runbook is pinned; every cutover step needs a named owner.",
    createdBy: "u13",
    createdAt: now - day * 34,
    adminIds: ["u13", "u3"],
    participantIds: ["u1", "u3", "u13", "u14"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#22d3ee",
  },

  /* --------------------------------- Social ------------------------------- */
  {
    id: "s-watercooler",
    type: "group",
    category: "social",
    name: "Watercooler",
    topic: "Not work",
    description: "Non-work chatter. Mute it without guilt.",
    createdBy: "u9",
    createdAt: now - day * 90,
    adminIds: ["u9"],
    participantIds: ["u1", "u2", "u4", "u6", "u9", "u11", "u12", "u14"],
    groupMuted: false,
    mutedUserIds: [],
    invite: null,
    color: "#f97316",
  },

  /* --------------------------- Group and direct --------------------------- */
  {
    id: "gd1",
    type: "groupdm",
    createdAt: now - day * 4,
    adminIds: [],
    participantIds: ["u1", "u2", "u4"],
    mutedUserIds: [],
    color: "#f59e0b",
  },
  {
    id: "d1",
    type: "direct",
    createdAt: now - day * 2,
    adminIds: [],
    participantIds: ["u1", "u2"],
    mutedUserIds: [],
  },
  {
    id: "d2",
    type: "direct",
    createdAt: now - day,
    adminIds: [],
    participantIds: ["u1", "u4"],
    mutedUserIds: [],
  },
  {
    id: "d3",
    type: "direct",
    createdAt: now - day * 3,
    adminIds: [],
    participantIds: ["u1", "u3"],
    mutedUserIds: [],
  },
  {
    id: "d4",
    type: "direct",
    createdAt: now - day * 6,
    adminIds: [],
    participantIds: ["u1", "u7"],
    mutedUserIds: [],
  },
  {
    id: "d6",
    type: "direct",
    createdAt: now - day * 4,
    adminIds: [],
    participantIds: ["u1", "u10"],
    mutedUserIds: [],
  },
  {
    id: "d5",
    type: "direct",
    createdAt: now - day * 2,
    adminIds: [],
    participantIds: ["u1", "u6"],
    mutedUserIds: [],
  },
];

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

interface SeedMessageOptions {
  threadRootId?: string;
  pinnedBy?: string;
  editedAt?: number;
  reactions?: Record<string, string[]>;
}

function m(
  roomId: string,
  senderId: string,
  content: string,
  minsAgo: number,
  options: SeedMessageOptions = {},
): SharedMessage {
  const id = `${roomId}-${senderId}-${minsAgo}`;
  return {
    id,
    clientId: `seed-${id}`,
    roomId,
    senderId,
    content,
    timestamp: now - minsAgo * min,
    reactions: options.reactions ?? {},
    delivery: "read",
    ...(options.threadRootId ? { threadRootId: options.threadRootId } : {}),
    ...(options.pinnedBy ? { pinnedBy: options.pinnedBy, pinnedAt: now - minsAgo * min } : {}),
    ...(options.editedAt ? { editedAt: now - options.editedAt * min } : {}),
  };
}

export const SEED_MESSAGES: SharedMessage[] = [
  /* ----------------------------- People & HR ------------------------------ */
  m(
    "d-people",
    "u7",
    "**Reimbursement rules, restated.**\n\nClaims go in within 30 days of the spend, with the original bill attached. HR clears business need, Accounts clears budget. Anything above ₹25,000 also needs Deepak's sign-off.\n\nThe 30-day window is the part people keep missing. After that it needs a written exception.",
    2880,
    { pinnedBy: "u7", reactions: { "👍": ["u1", "u5", "u12"] } },
  ),
  m(
    "d-people",
    "u7",
    "Plant is closed on the 15th. Dispatch cover is arranged with <!quality> — Imran is on site for the morning shift.",
    1440,
  ),
  m(
    "d-people",
    "u8",
    "Two offers went out for the Unit 3 line operator roles this morning. Both verbal yes, paperwork pending.",
    620,
    { reactions: { "🎉": ["u7", "u9", "u12"] } },
  ),
  m(
    "d-people",
    "u13",
    "Good. Do we have joining dates? I need them before I close the Unit 3 manpower budget.",
    600,
  ),
  m("d-people", "u8", "Earliest the 1st, latest the 15th. I'll confirm by Thursday.", 590, {
    threadRootId: "d-people-u13-600",
  }),
  m(
    "d-people",
    "u7",
    "Travel policy update is live in the handbook. The change that matters: own-vehicle fuel is now reimbursed at ₹11 per km against the log, rather than on the bill amount.",
    240,
  ),
  m(
    "d-people",
    "u10",
    "Accounts has the new rate in the system from this month's claims onward. Anything already filed is settled at the old rate.",
    232,
  ),
  m(
    "d-people",
    "u7",
    "Kavya Reddy joins Accounts today as Payments Officer, reporting to Deepak. She takes over the disbursement run from Friday.",
    45,
    { reactions: { "👋": ["u1", "u2", "u10", "u13"] } },
  ),

  /* ------------------------------ Engineering ----------------------------- */
  m(
    "d-eng",
    "u6",
    "**Line 2 die change — week 34**\n\n- Changeover: Wednesday 14:00\n- Trial run: Wednesday 18:00\n- Full production: Thursday 06:00, once the wall thickness passes\n\nAnything not slotted before the changeover goes to next week. No exceptions — we lose four hours either way.",
    4320,
    { pinnedBy: "u6" },
  ),
  m(
    "d-eng",
    "u3",
    "Back from the Nashik site. The failure is not the duct — it is the jointing. Installer used a solvent cement rated for PVC on an HDPE coupler.",
    3600,
    { reactions: { "👀": ["u6", "u5"] } },
  ),
  m(
    "d-eng",
    "u2",
    "That matches the two before it. Can we get a one-page installation sheet into every carton? Cheaper than another site visit.",
    3540,
  ),
  m(
    "d-eng",
    "u3",
    "Drafting it today. Photographs of the right and wrong coupler, nothing else — anything longer will not get read on site.",
    3500,
    { threadRootId: "d-eng-u2-3540" },
  ),
  m(
    "d-eng",
    "u5",
    "Wall thickness on the 110mm trial came in at 4.2mm against a 4.0 spec. Within tolerance but consistently heavy — we are giving away material on every metre.",
    1800,
  ),
  m(
    "d-eng",
    "u6",
    "Pull the die back by 0.15 and re-run. If it holds at 4.05 we save roughly ₹2.4 lakh a month on Line 2 alone.",
    1740,
    { reactions: { "🔥": ["u2", "u12"] } },
  ),
  m(
    "d-eng",
    "u2",
    "Re-run is scheduled after the changeover. I'll post the numbers here.",
    900,
  ),
  m(
    "d-eng",
    "u12",
    "Raw material note: the HDPE lot from Suraj is running slightly high on melt index. Nothing failing, but it will shift the die settings again.",
    420,
  ),

  /* -------------------------- Product Development ------------------------- */
  m(
    "d-design",
    "u2",
    "**Spec revision — 110mm HDPE duct**\n\nMoving from a 4.0mm nominal wall to 3.85mm with a tighter tolerance band. Same crush rating, less material.\n\nDrawings are updated. This needs a quality sign-off before it goes near a customer drawing.",
    5760,
    { pinnedBy: "u2" },
  ),
  m(
    "d-design",
    "u5",
    "I want three lots at the new wall through crush testing before I sign anything. Two passes is not evidence.",
    5700,
  ),
  m("d-design", "u2", "Agreed. Lots are booked for the 22nd, 23rd and 25th.", 5640, {
    threadRootId: "d-design-u5-5700",
  }),
  m(
    "d-design",
    "u4",
    "Once it is signed off I need the revised drawing numbers for the catalogue. The current sheet still shows the old wall.",
    2400,
  ),
  m(
    "d-design",
    "u11",
    "And a line for the Elecrama stand — \"same strength, less plastic\" is a story worth telling if the numbers hold.",
    2340,
    { reactions: { "💯": ["u2", "u4"] } },
  ),
  m(
    "d-design",
    "u13",
    "It holds commercially too. At current volumes the material saving is about ₹31 lakh a year across the 110 range.",
    1200,
  ),

  /* --------------------------------- Sales -------------------------------- */
  m(
    "r2",
    "u1",
    "**Pipeline, week 34**\n\n- Bharat Metro — order in production, dispatch window 27th–29th\n- Suzlon renewal — quotation with them, decision expected this week\n- L&T Chennai — site visit done, drawings requested\n\nThe Suzlon one is the number that moves the quarter.",
    4200,
    { pinnedBy: "u1" },
  ),
  m(
    "r2",
    "u1",
    "Back from Pune. Suzlon procurement want a three-year rate hold rather than annual. Deepak, is that something we can price?",
    3000,
    { reactions: { "👀": ["u6"] } },
  ),
  m(
    "r2",
    "u5",
    "Before anyone commits — a three-year hold on HDPE pricing with the resin market where it is would need a raw-material escalation clause. Otherwise we are the ones carrying it.",
    2940,
  ),
  m(
    "r2",
    "u2",
    "Second that. Fixed conversion, indexed material. That is the only shape that works.",
    2880,
    { threadRootId: "r2-u5-2940" },
  ),
  m(
    "r2",
    "u1",
    "Filing the travel for the Pune visit now. Three days, rail plus local transfers.",
    180,
  ),

  /* ------------------------------- Marketing ------------------------------ */
  m(
    "d-marketing",
    "u11",
    "**Elecrama stand — 6×6, hall 4.** Layout is confirmed. We get the corner, which is worth more than the extra metre we asked for.",
    4800,
    { pinnedBy: "u11" },
  ),
  m(
    "d-marketing",
    "u4",
    "Catalogue is at second proof. Waiting on the revised 110mm drawings before it can go to print.",
    3300,
  ),
  m(
    "d-marketing",
    "u11",
    "Print deadline is the 20th. If the drawings slip past the 18th we print the current spec and insert an errata, which I would rather not do.",
    3240,
  ),
  m("d-marketing", "u4", "Understood. I'll chase quality on the 17th if nothing has landed.", 3200, {
    threadRootId: "d-marketing-u11-3240",
  }),
  m(
    "d-marketing",
    "u1",
    "Can we have twenty of the new catalogue held back for the Suzlon meeting? Physical copies still land better than a PDF in that room.",
    600,
  ),

  /* --------------------------- Customer Support --------------------------- */
  m(
    "d-success",
    "u12",
    "**Open site complaints — 3**\n\n- Nashik: jointing failure, engineering visited, root cause is installer method\n- Vadodara: short supply of couplers, replacement dispatched\n- Bhopal: colour variation across two lots, customer wants an explanation\n\nOnly Bhopal needs a decision.",
    5400,
    { pinnedBy: "u12" },
  ),
  m(
    "d-success",
    "u5",
    "Bhopal is real. Two different masterbatch lots inside one order. It is cosmetic, but on an exposed run the customer will see it every day.",
    5340,
  ),
  m(
    "d-success",
    "u1",
    "They are a repeat account. I would rather replace the visible run than argue that it meets spec.",
    5280,
    { reactions: { "👍": ["u12", "u6"] } },
  ),
  m("d-success", "u12", "Agreed. Raising the replacement against warranty.", 5200, {
    threadRootId: "d-success-u1-5280",
  }),
  m(
    "d-success",
    "u6",
    "Longer term: lock masterbatch to one lot per order in the production plan. It costs us nothing and removes the whole class of complaint.",
    4800,
  ),
  m(
    "d-success",
    "u12",
    "Raised with production planning. It goes into the PACT rollout as a rule rather than a habit.",
    300,
  ),

  /* --------------------------- Finance & Accounts -------------------------- */
  m(
    "d-finance",
    "u13",
    "**August close — the 5th.**\n\nEverything for August must be in the system by the 3rd. Reimbursement claims included: a claim filed on the 4th lands in September, and people are always surprised by that.",
    4320,
    { pinnedBy: "u13" },
  ),
  m(
    "d-finance",
    "u10",
    "Receivables ageing is better than last month. Over-90 is down to ₹41 lakh from ₹58 lakh, mostly the Vadodara account clearing.",
    3600,
    { reactions: { "🎉": ["u13"] } },
  ),
  m(
    "d-finance",
    "u7",
    "Reimbursement queue is at eleven claims. Six are mine to clear, and I will have them done today.",
    1200,
  ),
  m(
    "d-finance",
    "u10",
    "Once HR clears them I can run the disbursement in one batch on Friday. One transfer per employee rather than one per claim — it saves the bank charges and the reconciliation.",
    1140,
  ),
  m(
    "d-finance",
    "u13",
    "Do that. And keep the Sales travel claims moving; people are spending their own money and waiting on us.",
    1080,
    { reactions: { "👍": ["u10", "u7"] } },
  ),

  /* ------------------------ Plant Expansion — Unit 3 ----------------------- */
  m(
    "r1",
    "u9",
    "**Machine decision is due Friday.**\n\nTwo quotes on the table for the Unit 3 extrusion line. Battenfeld is ₹2.1 crore with a 22-week lead time; the Chinese line is ₹1.35 crore at 14 weeks.\n\nThis is not only a price question. Say what you actually think.",
    7200,
    { pinnedBy: "u9" },
  ),
  m(
    "r1",
    "u6",
    "Battenfeld, and it is not close. We run these lines for fifteen years. The spares position alone is worth the difference.",
    7080,
    { reactions: { "👍": ["u2", "u5"] } },
  ),
  m(
    "r1",
    "u5",
    "Agreed on quality. But 22 weeks means we cannot take Unit 3 volume before Q1, and Sales are already quoting on it.",
    7020,
  ),
  m(
    "r1",
    "u1",
    "I am quoting Q1 delivery, not Q4. Nobody has been promised anything on Unit 3 capacity.",
    6960,
    { threadRootId: "r1-u5-7020" },
  ),
  m(
    "r1",
    "u13",
    "The capital difference is ₹75 lakh. Over fifteen years that is not the deciding number — downtime is. What does an unplanned week cost us on a line like this?",
    6900,
  ),
  m(
    "r1",
    "u6",
    "Roughly ₹18 lakh in lost output, before any penalty on a late dispatch. Two bad weeks and the price gap is gone.",
    6840,
    { threadRootId: "r1-u13-6900", reactions: { "💯": ["u9", "u13"] } },
  ),
  m(
    "r1",
    "u2",
    "One more thing in Battenfeld's favour: the die tooling is compatible with what we already run on Line 2. The other one is not.",
    6720,
  ),
  m(
    "r1",
    "u9",
    "That settles it for me. I'll put Battenfeld to the board on Friday with the downtime numbers attached.",
    6600,
  ),
  m(
    "r1",
    "u4",
    "Civil works schedule needs the machine footprint before it can be finalised. Whoever wins, I need drawings.",
    2400,
  ),
  m(
    "r1",
    "u3",
    "Power is the other one. The Battenfeld line needs a 400 kVA connection; our current sanction is 315.",
    2340,
  ),
  m(
    "r1",
    "u9",
    "Noted. Enhancement application takes about eight weeks, so it starts alongside the order, not after it.",
    2280,
    { threadRootId: "r1-u3-2340" },
  ),
  m(
    "r1",
    "u13",
    "Board pack is drafted. Sending it round tomorrow for comments before Friday.",
    120,
  ),

  /* ------------------------ Bharat Metro — Duct Order ---------------------- */
  m(
    "r3",
    "u1",
    "**Bharat Metro — 12,000 m of 110mm HDPE duct.**\n\nDispatch window is the 27th to the 29th. They have a site shutdown on the 30th, so late is the same as not at all.",
    3000,
    { pinnedBy: "u1" },
  ),
  m(
    "r3",
    "u3",
    "Production is on schedule. 8,400 m done, the balance runs after the Line 2 changeover.",
    2400,
    { reactions: { "👍": ["u1"] } },
  ),
  m(
    "r3",
    "u4",
    "Packing list is ready. Waiting on the quality clearance certificate before I can raise the ASN.",
    900,
  ),

  /* ---------------------------- PACT ERP Rollout --------------------------- */
  m(
    "p-atlas",
    "u13",
    "**Cutover: the 27th, 01:00–04:00 IST.**\n\nPurchase, stores and dispatch move to PACT. Everything else stays where it is for now.\n\nIf we are not through validation by 03:00 we roll back and try again the following week. That decision is mine and I will make it on the night.",
    2880,
    { pinnedBy: "u13" },
  ),
  m(
    "p-atlas",
    "u3",
    "Dry run finished. 41,000 stock rows migrated, 12 rejected — all of them legacy SKUs with no unit of measure.",
    2400,
  ),
  m(
    "p-atlas",
    "u13",
    "Twelve is fine. Fix them by hand before the real run rather than writing a rule for a case that will never recur.",
    2340,
    { threadRootId: "p-atlas-u3-2400" },
  ),
  m(
    "p-atlas",
    "u14",
    "Question on the finance side: do open reimbursement claims move with the cutover, or do they stay in the current system until they settle?",
    1200,
  ),
  m(
    "p-atlas",
    "u13",
    "They stay. Anything mid-approval finishes where it started — moving a claim halfway through its chain is how you lose one.",
    1140,
    { threadRootId: "p-atlas-u14-1200", reactions: { "👍": ["u14", "u10"] } },
  ),
  m(
    "p-atlas",
    "u3",
    "Rollback has been rehearsed twice now. Restore takes 40 minutes, which fits inside the window.",
    300,
  ),

  /* ------------------------------ Watercooler ------------------------------ */
  m("s-watercooler", "u12", "Canteen has samosas again. This is not a drill.", 240, {
    reactions: { "🎉": ["u1", "u4", "u11"] },
  }),
  m("s-watercooler", "u4", "On my way down.", 235),
  m(
    "s-watercooler",
    "u11",
    "Whoever left a die spanner in the meeting room — it is with security.",
    120,
  ),

  /* ------------------------------- Group DM -------------------------------- */
  m(
    "gd1",
    "u1",
    "Pulling you both in before we take the Suzlon rate structure to Deepak. I would rather we disagree here than in front of him.",
    1800,
  ),
  m(
    "gd1",
    "u2",
    "My position has not changed: fixed conversion, indexed material. Anything else and we are speculating on resin prices for three years.",
    1740,
  ),
  m(
    "gd1",
    "u4",
    "Agreed. And whatever we land on, I need it in writing before it goes in the quotation — I am not paraphrasing a pricing structure into a customer document.",
    1680,
    { reactions: { "👍": ["u1", "u2"] } },
  ),

  /* ----------------------------- Direct messages --------------------------- */
  m("d1", "u2", "Die re-run numbers are in. 4.06mm, holding across the whole lot.", 400, {
    reactions: { "🔥": ["u1"] },
  }),
  m("d1", "u1", "That is the saving then. I'll get it in front of Deepak this week.", 380),

  m("d2", "u4", "Catalogue proof is with you. I need comments by Thursday to hold the print date.", 1500),

  m("d3", "u3", "Installation sheet drafted — one page, photographs only. Have a look before it goes to print.", 800),

  m(
    "d4",
    "u7",
    "Rohan, your Pune travel claim is in my queue. Attach the hotel bill and I can clear it today — right now there is only the rail ticket.",
    120,
    { reactions: { "👍": ["u1"] } },
  ),
  m("d4", "u1", "Sending it across now.", 110),

  m(
    "d6",
    "u10",
    "Once HR clears your claims I'll pick them up in Friday's run. One transfer, one UTR, however many claims are cleared by then.",
    2880,
  ),

  m("d5", "u6", "Line 2 changeover is confirmed for Wednesday. Nothing you have quoted is affected.", 90),
];

export const SEED_AI: PrivateAIMessage[] = [];
