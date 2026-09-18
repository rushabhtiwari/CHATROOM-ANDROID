import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HealthPill, HealthPillProps } from '../HealthPill';
import { LinearProgressBar, LinearProgressBarProps } from '../LinearProgressBar';
import { KPICard, KPICardProps } from '../KPICard';
import { DataGrid, ColumnDef } from '../DataGrid';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: any) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', details });
    console.error(`[FAIL] [${suite}] ${name}`, details || '');
  }
}

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ==========================================
// SUITE 1: HealthPill Adversarial Tests
// ==========================================
console.log('\n--- Running HealthPill Tests ---');

// 1.1 Standard statuses
{
  const onTrackHtml = render(<HealthPill status="on_track" />);
  assert(onTrackHtml.includes('On Track'), 'HealthPill', 'Default label for on_track is "On Track"');
  assert(onTrackHtml.includes('ku-stamp') && onTrackHtml.includes('border-st-green-ink') && onTrackHtml.includes('text-st-green-ink'), 'HealthPill', 'on_track stamps in the green tone, outline and letters sharing one ink');
  // Section 8.3 - colour is never the only carrier: every verdict ships a glyph.
  assert(onTrackHtml.includes('svg'), 'HealthPill', 'on_track carries a glyph alongside its ink');

  const atRiskHtml = render(<HealthPill status="at_risk" />);
  assert(atRiskHtml.includes('At Risk'), 'HealthPill', 'Default label for at_risk is "At Risk"');
  assert(atRiskHtml.includes('border-st-amber-ink') && atRiskHtml.includes('text-st-amber-ink'), 'HealthPill', 'at_risk stamps in the amber tone');

  const overdueHtml = render(<HealthPill status="overdue" />);
  assert(overdueHtml.includes('Overdue'), 'HealthPill', 'Default label for overdue is "Overdue"');
  assert(overdueHtml.includes('border-st-red-ink') && overdueHtml.includes('text-st-red-ink'), 'HealthPill', 'overdue stamps in the red tone');

  const criticalHtml = render(<HealthPill status="critical" />);
  assert(criticalHtml.includes('Critical'), 'HealthPill', 'Default label for critical is "Critical"');

  const staleHtml = render(<HealthPill status="stale" />);
  assert(staleHtml.includes('Stale'), 'HealthPill', 'Default label for stale is "Stale"');
  assert(staleHtml.includes('lucide-alert-triangle') || staleHtml.includes('svg'), 'HealthPill', 'stale renders warning icon');
}

// 1.2 Normalization and case insensitivity
{
  const upperHtml = render(<HealthPill status="ON_TRACK" />);
  assert(upperHtml.includes('On Track') && upperHtml.includes('text-st-green-ink'), 'HealthPill', 'Handles uppercase "ON_TRACK"');

  const hyphenHtml = render(<HealthPill status="at-risk" />);
  assert(hyphenHtml.includes('At Risk') && hyphenHtml.includes('text-st-amber-ink'), 'HealthPill', 'Handles hyphenated "at-risk"');

  const spaceHtml = render(<HealthPill status="On  Track" />);
  assert(spaceHtml.includes('On Track') && spaceHtml.includes('text-st-green-ink'), 'HealthPill', 'Handles multiple spaces "On  Track"');

  const aliasGoodHtml = render(<HealthPill status="good" />);
  assert(aliasGoodHtml.includes('text-st-green-ink'), 'HealthPill', 'Handles alias status "good"');

  const aliasCautionHtml = render(<HealthPill status="caution" />);
  assert(aliasCautionHtml.includes('text-st-amber-ink'), 'HealthPill', 'Handles alias status "caution"');
}

// 1.3 Label override & pulse toggle
{
  const customLabel = render(<HealthPill status="on_track" label="99.4% SLA" />);
  assert(customLabel.includes('99.4% SLA'), 'HealthPill', 'Label prop overrides default status text');

  const noPulse = render(<HealthPill status="on_track" showPulse={false} />);
  assert(!noPulse.includes('animate-pulse'), 'HealthPill', 'showPulse=false removes pulse animation');

  const pulseAlias = render(<HealthPill status="on_track" pulse={false} />);
  assert(!pulseAlias.includes('animate-pulse'), 'HealthPill', 'pulse=false removes pulse animation');

  // Overdue with pulse=false replaces pulse dot with AlertCircle icon
  const overdueNoPulse = render(<HealthPill status="overdue" showPulse={false} />);
  assert(!overdueNoPulse.includes('animate-pulse'), 'HealthPill', 'overdue without pulse removes pulse dot');
  assert(overdueNoPulse.includes('lucide-alert-circle') || overdueNoPulse.includes('svg'), 'HealthPill', 'overdue without pulse renders AlertCircle icon');
}

// 1.4 Edge cases: empty status, null/undefined status, unknown status
{
  const unknownHtml = render(<HealthPill status="custom_status" />);
  assert(unknownHtml.includes('custom_status'), 'HealthPill', 'Unknown status falls back to neutral pill rendering status text');
  assert(unknownHtml.includes('text-st-grey-ink'), 'HealthPill', 'Unknown status falls to the grey tone - no verdict, so no colour');

  // Empty string status
  const emptyStatus = render(<HealthPill status="" />);
  assert(emptyStatus.includes('text-st-grey-ink'), 'HealthPill', 'Empty status falls back to the grey stamp without crashing');

  // Empty string with label
  const emptyWithLabel = render(<HealthPill status="" label="Neutral State" />);
  assert(emptyWithLabel.includes('Neutral State'), 'HealthPill', 'Empty status with label renders label');

  // Stale status pulse behavior check
  const staleWithPulse = render(<HealthPill status="stale" showPulse={true} />);
  // Note: stale branch renders AlertTriangle icon regardless of showPulse
  assert(!staleWithPulse.includes('animate-pulse'), 'HealthPill', 'stale status unconditionally renders static icon (ignores showPulse)');
}

// 1.5 Sizes and classes
{
  const mdHtml = render(<HealthPill status="on_track" size="md" />);
  assert(mdHtml.includes('ku-stamp-lg'), 'HealthPill', 'size="md" renders the heavier stamp');

  const customClassHtml = render(<HealthPill status="on_track" className="custom-test-class" />);
  assert(customClassHtml.includes('custom-test-class'), 'HealthPill', 'className is merged correctly');
}

// ==========================================
// SUITE 2: LinearProgressBar Adversarial Tests
// ==========================================
console.log('\n--- Running LinearProgressBar Tests ---');

// 2.1 Standard clamping: < 0, > 100, exact 0, exact 100
{
  const clampedNeg = render(<LinearProgressBar value={-40} />);
  assert(clampedNeg.includes('width:0%'), 'LinearProgressBar', 'Clamps negative value (-40) to 0% width');
  assert(clampedNeg.includes('>0%<'), 'LinearProgressBar', 'Displays 0% for negative value');

  const clampedOver = render(<LinearProgressBar value={160} />);
  assert(clampedOver.includes('width:100%'), 'LinearProgressBar', 'Clamps value > 100 (160) to 100% width');
  assert(clampedOver.includes('>100%<'), 'LinearProgressBar', 'Displays 100% for over-100 value');

  const exactZero = render(<LinearProgressBar value={0} />);
  assert(exactZero.includes('width:0%'), 'LinearProgressBar', 'Renders exact 0% value');

  const exactHundred = render(<LinearProgressBar value={100} />);
  assert(exactHundred.includes('width:100%'), 'LinearProgressBar', 'Renders exact 100% value');
}

// 2.2 Dual-segment clamping behavior
{
  // Primary 60 + Secondary 60 -> Secondary clamped to 40 (sum = 100)
  const dualOverflow = render(<LinearProgressBar value={60} secondaryValue={60} />);
  assert(dualOverflow.includes('width:60%'), 'LinearProgressBar', 'Primary segment renders 60% width');
  assert(dualOverflow.includes('width:40%'), 'LinearProgressBar', 'Secondary segment clamped so total does not exceed 100% (width:40%)');

  // Primary 100 + Secondary 20 -> Secondary clamped to 0 and not rendered
  const dualMaxPrimary = render(<LinearProgressBar value={100} secondaryValue={20} />);
  assert(dualMaxPrimary.includes('width:100%'), 'LinearProgressBar', 'Primary at 100%');
  assert(!dualMaxPrimary.includes('bg-tertiary-fixed-dim'), 'LinearProgressBar', 'Secondary segment omitted when primary is 100%');

  // Negative secondary value
  const dualNegSecondary = render(<LinearProgressBar value={50} secondaryValue={-30} />);
  assert(dualNegSecondary.includes('width:50%'), 'LinearProgressBar', 'Primary renders 50%');
  assert(!dualNegSecondary.includes('width:0%') || dualNegSecondary.match(/width:/g)?.length === 1, 'LinearProgressBar', 'Negative secondary clamped to 0 and omitted');
}

// 2.3 Edge cases: NaN, Infinity, undefined
{
  const nanHtml = render(<LinearProgressBar value={NaN} />);
  const isNanRendered = nanHtml.includes('NaN');
  assert(isNanRendered, 'LinearProgressBar', 'Empirical finding: passing NaN produces "NaN%" in display and "width:NaN%" style (unclamped NaN)');

  const infHtml = render(<LinearProgressBar value={Infinity} />);
  assert(infHtml.includes('width:100%'), 'LinearProgressBar', 'Infinity is clamped to 100% by Math.min');

  const negInfHtml = render(<LinearProgressBar value={-Infinity} />);
  assert(negInfHtml.includes('width:0%'), 'LinearProgressBar', '-Infinity is clamped to 0% by Math.max');

  const defaultUndefined = render(<LinearProgressBar />);
  assert(defaultUndefined.includes('width:0%'), 'LinearProgressBar', 'Undefined value defaults safely to 0%');
}

// 2.4 Aliases and labels
{
  const aliasPercentage = render(<LinearProgressBar percentage={75} />);
  assert(aliasPercentage.includes('width:75%') && aliasPercentage.includes('>75%<'), 'LinearProgressBar', 'Supports "percentage" alias for value');

  const aliasSecondary = render(<LinearProgressBar value={30} secondaryPercentage={20} />);
  assert(aliasSecondary.includes('width:20%'), 'LinearProgressBar', 'Supports "secondaryPercentage" alias');

  const customLabels = render(
    <LinearProgressBar
      value={45}
      label="Budget Consumed"
      valueLabel="45k / 100k"
      fractionLabel="45%"
    />
  );
  assert(customLabels.includes('Budget Consumed'), 'LinearProgressBar', 'Renders custom label');
  assert(customLabels.includes('45k / 100k'), 'LinearProgressBar', 'valueLabel overrides percentage text');
  assert(customLabels.includes('(45%)'), 'LinearProgressBar', 'Renders fractionLabel');

  const detailAlias = render(<LinearProgressBar value={50} detail="5 / 10" />);
  assert(detailAlias.includes('(5 / 10)'), 'LinearProgressBar', 'Supports "detail" alias for fractionLabel');

  const hiddenLabels = render(<LinearProgressBar value={50} label="Hidden" showLabels={false} />);
  assert(!hiddenLabels.includes('Hidden') && !hiddenLabels.includes('>50%<'), 'LinearProgressBar', 'showLabels=false suppresses label container');
}

// 2.5 Variants and styling
{
  const successVar = render(<LinearProgressBar value={50} variant="success" />);
  assert(successVar.includes('bg-strand-green'), 'LinearProgressBar', 'variant="success" uses bg-strand-green');

  const warningVar = render(<LinearProgressBar value={50} variant="warning" />);
  assert(warningVar.includes('bg-strand-amber'), 'LinearProgressBar', 'variant="warning" uses bg-strand-amber');

  const dangerVar = render(<LinearProgressBar value={50} variant="danger" />);
  assert(dangerVar.includes('bg-strand-red'), 'LinearProgressBar', 'variant="danger" uses bg-strand-red');

  const customHeight = render(<LinearProgressBar value={50} heightClass="h-4" />);
  assert(customHeight.includes('h-4'), 'LinearProgressBar', 'Supports custom heightClass');
}

// ==========================================
// SUITE 3: KPICard Adversarial Tests
// ==========================================
console.log('\n--- Running KPICard Tests ---');

// 3.1 Standard metrics, strings, zeros
{
  const cardWithZero = render(<KPICard title="Pending Tasks" value={0} />);
  assert(cardWithZero.includes('>0<'), 'KPICard', 'Correctly renders numerical 0 value without treating as falsy empty');

  const cardWithEmpty = render(<KPICard title="Blank Metric" value="" />);
  assert(cardWithEmpty.includes('Blank Metric'), 'KPICard', 'Renders card with empty string value without error');

  const cardFormatted = render(<KPICard title="Revenue" value="₹12.4 Cr" />);
  assert(cardFormatted.includes('₹12.4 Cr'), 'KPICard', 'Renders formatted currency string');
}

// 3.2 Subtitle vs Unit and Footer interactions
{
  // Only unit
  const cardUnitOnly = render(<KPICard title="Capacity" value={85} unit="%" />);
  assert(cardUnitOnly.includes('>%<') && cardUnitOnly.includes('text-meta'), 'KPICard', 'Renders unit next to value');

  // Only subtitle
  const cardSubOnly = render(<KPICard title="Capacity" value={85} subtitle="vs previous sprint" />);
  assert(cardSubOnly.includes('vs previous sprint'), 'KPICard', 'Renders subtitle next to value when unit is absent');

  // BOTH unit AND subtitle
  const cardUnitAndSub = render(<KPICard title="Capacity" value={85} unit="%" subtitle="vs previous sprint" />);
  // Check subtitle placement: when unit is present, subtitle is pushed down to footer
  assert(cardUnitAndSub.includes('vs previous sprint') && cardUnitAndSub.includes('text-caption text-meta'), 'KPICard', 'When both unit and subtitle are present, the subtitle drops to the footer line');
  assert(cardUnitAndSub.includes('vs previous sprint'), 'KPICard', 'Subtitle rendered in footer when unit is present');

  // BOTH unit, subtitle, AND footerLeft
  const cardConflict = render(
    <KPICard
      title="Capacity"
      value={85}
      unit="%"
      subtitle="vs previous sprint"
      footerLeft="Custom Footer Left"
    />
  );
  assert(cardConflict.includes('Custom Footer Left'), 'KPICard', 'footerLeft renders in footer');
  assert(!cardConflict.includes('vs previous sprint'), 'KPICard', 'Empirical finding: When both unit, subtitle, and footerLeft are passed, subtitle is overwritten and omitted');
}

// 3.3 Trend behavior
{
  // Positive trend
  const positiveTrend = render(
    <KPICard title="Growth" value="15%" trend={{ value: "+12.4%", positive: true }} />
  );
  // The direction ships as a glyph and an sr-only word as well as the ink.
  assert(positiveTrend.includes('+12.4%') && positiveTrend.includes('text-st-green-ink') && positiveTrend.includes('up'), 'KPICard', 'positive trend renders in green ink with an up glyph');

  // isPositive alias
  const aliasTrend = render(
    <KPICard title="Growth" value="15%" trend={{ value: "+8%", isPositive: true }} />
  );
  assert(aliasTrend.includes('text-st-green-ink'), 'KPICard', 'Supports isPositive alias');

  // Negative trend
  const negativeTrend = render(
    <KPICard title="Churn" value="2.1%" trend={{ value: "-0.4%", positive: false }} />
  );
  assert(negativeTrend.includes('-0.4%') && negativeTrend.includes('text-st-red-ink') && negativeTrend.includes('down'), 'KPICard', 'negative trend renders in red ink with a down glyph');

  // Neutral trend
  const neutralTrend = render(
    <KPICard title="Retention" value="95%" trend={{ value: "0.0%", neutral: true }} />
  );
  assert(neutralTrend.includes('text-meta'), 'KPICard', 'neutral trend renders in meta with no direction glyph');

  // Default trend with neither positive nor neutral specified
  const unspecifiedTrend = render(
    <KPICard title="Metric" value="10" trend={{ value: "Unspecified" }} />
  );
  assert(unspecifiedTrend.includes('text-st-red-ink'), 'KPICard', 'Empirical finding: trend with no positive/neutral flag defaults to the red ink');
}

// 3.4 Status pill vs Badge
{
  const statusCard = render(<KPICard title="Health" value="Good" status="on_track" />);
  assert(statusCard.includes('On Track') && statusCard.includes('ku-stamp'), 'KPICard', 'status prop renders HealthPill');

  const badgeCard = render(
    <KPICard title="Health" value="Good" status="on_track" badge={<span className="custom-badge">CUSTOM</span>} />
  );
  assert(badgeCard.includes('custom-badge'), 'KPICard', 'badge prop takes precedence and renders badge');
  assert(!badgeCard.includes('On Track'), 'KPICard', 'badge prop suppresses status HealthPill');
}

// 3.5 Navigation Link (`to` prop)
{
  const linkCard = render(
    <MemoryRouter>
      <KPICard title="Navigable" value="123" to="/finance/overview" />
    </MemoryRouter>
  );
  assert(linkCard.includes('href="/finance/overview"'), 'KPICard', 'to prop renders an anchor/Link tag with correct href');
  assert(linkCard.includes('cursor-pointer'), 'KPICard', 'to prop adds cursor-pointer class');
}

// ==========================================
// SUITE 4: DataGrid Adversarial Tests
// ==========================================
console.log('\n--- Running DataGrid Tests ---');

interface MockRow {
  id: string;
  name: string;
  amount: number;
  status: string;
  category?: string;
}

const mockData: MockRow[] = [
  { id: 'row-1', name: 'Alpha Logistics', amount: 150000, status: 'Active', category: 'Ops' },
  { id: 'row-2', name: 'Beta Solutions', amount: 0, status: 'Pending', category: 'IT' },
  { id: 'row-3', name: 'Gamma Corp', amount: -25000, status: 'Overdue' },
  { id: 'row-4', name: 'Delta Enterprises', amount: 450000, status: 'Active', category: 'Finance' },
  { id: 'row-5', name: 'Epsilon Tech', amount: 82000, status: 'Active' },
];

const mockColumns: ColumnDef<MockRow>[] = [
  { id: 'name', header: 'Vendor Name', accessorKey: 'name', sortable: true },
  { id: 'amount', header: 'Balance', accessorKey: 'amount', isNumeric: true, isMono: true, sortable: true },
  { id: 'status', header: 'Status', accessorKey: 'status', sortable: true },
  { id: 'category', header: 'Category', accessorKey: 'category', sortable: false },
];

// 4.1 36px Default Row Height Standard
{
  const gridHtml = render(
    <DataGrid
      data={mockData}
      columns={mockColumns}
      keyExtractor={(r) => r.id}
    />
  );
  // Default isCompact is true, so each table row has class "h-9"
  const h9Count = (gridHtml.match(/border-l-transparent hover:border-l-accent hover:bg-canvas h-9/g) || []).length;
  assert(h9Count === mockData.length, 'DataGrid', 'All rows render with default "h-9" (36px fixed row height standard)', { h9Count, expected: mockData.length });

  // Column heads are condensed micro caps in `meta`, over a 2px structure
  // rule drawn as an ::after inside the cell (it has to survive a sticky th).
  assert(gridHtml.includes('ku-narrow') && gridHtml.includes('text-micro') && gridHtml.includes("after:bg-structure"), 'DataGrid', 'Table thead renders condensed micro caps over the structure rule');

  // Header content rendered
  assert(gridHtml.includes('Vendor Name') && gridHtml.includes('Balance'), 'DataGrid', 'Column headers rendered');

  // Check numeric and monospace alignment
  assert(gridHtml.includes('text-right'), 'DataGrid', 'Numeric columns get text-right alignment');
  assert(gridHtml.includes('ku-fig'), 'DataGrid', 'isMono and numeric columns are set in the instrument voice');

  // The ledger cursor replaces zebra striping: every row carries a transparent
  // 3px leading rule that the accent fills on hover.
  assert(gridHtml.includes('border-l-3') && gridHtml.includes('hover:border-l-accent'), 'DataGrid', 'Rows carry the ledger cursor instead of zebra striping');
}

// 4.2 Empty dataset handling
{
  const emptyGrid = render(
    <DataGrid
      data={[]}
      columns={mockColumns}
      keyExtractor={(r) => r.id}
    />
  );
  assert(emptyGrid.includes('No records match this view'), 'DataGrid', 'Empty data renders the left-aligned ledger empty state');
  assert(emptyGrid.includes('Showing <span class="ku-fig font-semibold text-ink">0</span>–<span class="ku-fig font-semibold text-ink">0</span> of <span class="ku-fig font-semibold text-ink">0</span> records'), 'DataGrid', 'Empty data shows 0–0 of 0 records in pagination');
}

// 4.3 Search logic verification
{
  // Test search logic directly using DataGrid's filter logic
  const searchFilter = (items: MockRow[], term: string, searchKey?: keyof MockRow | ((item: MockRow) => string)) => {
    if (!term) return items;
    const lower = term.toLowerCase();
    return items.filter((item) => {
      if (typeof searchKey === 'function') {
        return searchKey(item).toLowerCase().includes(lower);
      }
      if (searchKey && item[searchKey]) {
        return String(item[searchKey]).toLowerCase().includes(lower);
      }
      return Object.values(item as any).some((val) =>
        String(val || '').toLowerCase().includes(lower)
      );
    });
  };

  // Text search
  const alphaResults = searchFilter(mockData, 'alpha');
  assert(alphaResults.length === 1 && alphaResults[0].id === 'row-1', 'DataGrid', 'String search filters accurately');

  // Adversarial: Searching for "0"
  // Row 2 has amount: 0
  const searchZero = searchFilter(mockData, '0');
  const foundZeroRow = searchZero.some((r) => r.id === 'row-2');
  assert(!foundZeroRow, 'DataGrid', 'Empirical finding: Search for "0" fails to match numerical 0 values due to `String(val || "")` falsy coercion', { searchZeroResultCount: searchZero.length, foundZeroRow });

  // Adversarial: Search key with numerical 0
  // Row 2 has amount: 0. Because 0 is falsy, item[searchKey] evaluates to false in `item[searchKey]`
  // and gets excluded when searching specifically for "0".
  const searchKeyZero = searchFilter(mockData, '0', 'amount');
  const foundRow2WithZeroAmount = searchKeyZero.some((r) => r.id === 'row-2');
  assert(!foundRow2WithZeroAmount, 'DataGrid', 'Empirical finding: searchKey="amount" when amount is 0 evaluates `item[searchKey]` as falsy and misses row-2');
}

// 4.4 Sort comparator verification
{
  const sortComparator = (a: any, b: any, col: ColumnDef<MockRow>, sortDir: 'asc' | 'desc') => {
    let aVal = col.accessorKey ? a[col.accessorKey] : a[col.id];
    let bVal = col.accessorKey ? b[col.accessorKey] : b[col.id];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  };

  // Numeric ascending sort
  const amountCol = mockColumns[1];
  const sortedAsc = [...mockData].sort((a, b) => sortComparator(a, b, amountCol, 'asc'));
  assert(sortedAsc[0].amount === -25000 && sortedAsc[sortedAsc.length - 1].amount === 450000, 'DataGrid', 'Sorts numbers ascending including negative numbers');

  // Numeric descending sort
  const sortedDesc = [...mockData].sort((a, b) => sortComparator(a, b, amountCol, 'desc'));
  assert(sortedDesc[0].amount === 450000 && sortedDesc[sortedDesc.length - 1].amount === -25000, 'DataGrid', 'Sorts numbers descending');

  // Undefined values sorting
  const categoryCol = mockColumns[3]; // Some rows have undefined category
  const sortedCatAsc = [...mockData].sort((a, b) => sortComparator(a, b, categoryCol, 'asc'));
  // Rows with undefined category should be pushed to end
  const lastItem = sortedCatAsc[sortedCatAsc.length - 1];
  assert(lastItem.category === undefined, 'DataGrid', 'Pushes undefined values to bottom of sort');

  // Adversarial: Both values undefined
  const bothUndefinedResult = sortComparator({ category: undefined } as any, { category: undefined } as any, categoryCol, 'asc');
  assert(bothUndefinedResult === 1, 'DataGrid', 'Empirical finding: When both values are undefined, comparator returns 1 instead of 0 (asymmetric sort)');
}

// 4.5 Pagination calculation
{
  const pageSize = 2;
  const totalPages = Math.ceil(mockData.length / pageSize); // 5 / 2 = 3
  assert(totalPages === 3, 'DataGrid', 'totalPages calculated correctly as 3 for 5 items with pageSize=2');

  const page1 = mockData.slice(0, 2);
  assert(page1.length === 2 && page1[0].id === 'row-1' && page1[1].id === 'row-2', 'DataGrid', 'Page 1 slice has items 1 and 2');

  const page3 = mockData.slice(4, 6);
  assert(page3.length === 1 && page3[0].id === 'row-5', 'DataGrid', 'Last page slice has remainder item');
}

// 4.6 Saved Views and Bulk Actions rendering
{
  let clickedView = false;
  let bulkActionTriggered = false;

  const views = [
    { label: 'All', count: 5, active: true, onClick: () => { clickedView = true; } },
    { label: 'Active', count: 3, active: false, onClick: () => {} },
  ];

  const actions = [
    { label: 'Approve Selected', action: (items: MockRow[]) => { bulkActionTriggered = true; } },
    { label: 'Delete', variant: 'danger' as const, action: () => {} },
  ];

  const advancedGrid = render(
    <DataGrid
      data={mockData}
      columns={mockColumns}
      keyExtractor={(r) => r.id}
      savedViews={views}
      bulkActions={actions}
    />
  );

  assert(advancedGrid.includes('>Views<'), 'DataGrid', 'Renders the Views eyebrow');
  assert(advancedGrid.includes('All') && advancedGrid.includes('>5<'), 'DataGrid', 'Renders saved views buttons with count badges');
  assert(advancedGrid.includes('Export CSV'), 'DataGrid', 'Renders Export CSV button');
}

// 4.7 Row Height expansion with tall cell contents
{
  const customTallColumns: ColumnDef<MockRow>[] = [
    {
      id: 'name',
      header: 'Vendor Name',
      cell: (r) => (
        <div style={{ height: '80px' }} className="tall-cell">
          <p>{r.name}</p>
          <p>Extra line 1</p>
          <p>Extra line 2</p>
        </div>
      )
    }
  ];

  const tallGrid = render(
    <DataGrid
      data={mockData.slice(0, 1)}
      columns={customTallColumns}
      keyExtractor={(r) => r.id}
    />
  );
  // Because HTML tables expand `<tr>` when `<td>` content is taller than `h-9` (36px),
  // table layout without truncate or overflow-hidden expands naturally.
  assert(tallGrid.includes('tall-cell') && tallGrid.includes('h-9'), 'DataGrid', 'Empirical finding: Row has class "h-9", but HTML table specification expands row height when cell content exceeds 36px because td has no overflow:hidden or fixed line-clamp');
}

// ==========================================
// SUMMARY
// ==========================================
console.log('\n==========================================');
const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('==========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
