import { calculateDebitNoteAmount, getDebitNoteAmount } from '../GRNThreeWayMatch';
import { mockThreeWayMatchRecords } from '../../../data/purchase';

interface TestAssertion {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const assertions: TestAssertion[] = [];

function assertEqual(actual: string, expected: string, name: string) {
  const passed = actual === expected;
  assertions.push({ name, passed, expected, actual });
  if (!passed) {
    console.error(`[FAIL] ${name}: expected "${expected}", got "${actual}"`);
  } else {
    console.log(`[PASS] ${name}: "${actual}"`);
  }
}

console.log('\n--- Running GRN Dynamic Variance Calculation Test Suite ---');

// Test 1: GRN-2026-0419 - Quantity Shortfall (200 kg @ ₹165/kg)
{
  const rec = {
    poQty: 4000,
    deliveredQty: 3800,
    poRate: 165.0,
    invoiceRate: 165.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹33,000', 'GRN-2026-0419 quantity shortfall variance equals ₹33,000');
  assertEqual(getDebitNoteAmount(rec), '₹33,000', 'getDebitNoteAmount alias matches calculateDebitNoteAmount');
}

// Test 2: GRN-2026-0412 - Rate Surcharge (+₹420 on 20 drums)
{
  const rec = {
    poQty: 20,
    deliveredQty: 20,
    poRate: 12500.0,
    invoiceRate: 12920.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹8,400', 'GRN-2026-0412 rate surcharge variance equals ₹8,400');
}

// Test 3: GRN-2026-0408 - Exact Match (Zero variance)
{
  const rec = {
    poQty: 3000,
    deliveredQty: 3000,
    poRate: 140.0,
    invoiceRate: 140.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹0', 'GRN-2026-0408 exact match variance equals ₹0');
}

// Test 4: Combined Variance (Shortfall + Surcharge)
{
  const rec = {
    poQty: 1000,
    deliveredQty: 800,
    poRate: 100.0,
    invoiceRate: 120.0
  };
  // Shortfall: 200 * 100 = 20,000. Surcharge: 20 * 800 = 16,000. Total = 36,000
  assertEqual(calculateDebitNoteAmount(rec), '₹36,000', 'Combined quantity shortfall and rate surcharge');
}

// Test 5: Over-delivery (Delivered > PO Qty => Shortfall clamped to 0)
{
  const rec = {
    poQty: 500,
    deliveredQty: 550,
    poRate: 200.0,
    invoiceRate: 200.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹0', 'Over-delivery clamps quantity shortfall to ₹0');
}

// Test 6: Rate Discount (Invoice Rate < PO Rate => Surcharge clamped to 0)
{
  const rec = {
    poQty: 100,
    deliveredQty: 100,
    poRate: 500.0,
    invoiceRate: 480.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹0', 'Rate discount clamps surcharge to ₹0');
}

// Test 7: Fallback to grnQty when deliveredQty is omitted
{
  const rec = {
    poQty: 500,
    grnQty: 400,
    poRate: 50.0,
    invoiceRate: 50.0
  };
  assertEqual(calculateDebitNoteAmount(rec), '₹5,000', 'Fallback to grnQty when deliveredQty is omitted');
}

// Test 8: Integration check directly against mockThreeWayMatchRecords
{
  const [rec1, rec2, rec3] = mockThreeWayMatchRecords;
  assertEqual(calculateDebitNoteAmount(rec1), '₹33,000', 'mockThreeWayMatchRecords[0] (Saint-Gobain) equals ₹33,000');
  assertEqual(calculateDebitNoteAmount(rec2), '₹8,400', 'mockThreeWayMatchRecords[1] (PolyChem) equals ₹8,400');
  assertEqual(calculateDebitNoteAmount(rec3), '₹0', 'mockThreeWayMatchRecords[2] (Reliance) equals ₹0');
}

console.log('\n==========================================');
const total = assertions.length;
const passed = assertions.filter((a) => a.passed).length;
const failed = assertions.filter((a) => !a.passed).length;
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('==========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
