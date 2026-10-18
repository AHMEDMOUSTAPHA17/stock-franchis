import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCashPrice,
  calculateInstallment12mPrice,
  calculateInstallmentMonthPrice,
  calculateMonthlyPayment,
} from './pricing.ts';

test('calculateCashPrice applies markup and ceiling rounding', () => {
  // Cost = 1000, Markup = 20% -> raw = 1200, unit = 100 -> 1200
  assert.equal(calculateCashPrice(1000, 20, 100), 1200);

  // Cost = 1050, Markup = 20% -> raw = 1260, unit = 100 -> ceil(12.6)*100 = 1300
  assert.equal(calculateCashPrice(1050, 20, 100), 1300);

  // Cost = 500, Markup = 15% -> raw = 575, unit = 50 -> ceil(575/50)*50 = ceil(11.5)*50 = 600
  assert.equal(calculateCashPrice(500, 15, 50), 600);
});

test('calculateInstallment12mPrice applies 40% markup and ceiling rounding', () => {
  // Cost = 1000, Markup = 40% -> raw = 1400, unit = 100 -> 1400
  assert.equal(calculateInstallment12mPrice(1000, 40, 100), 1400);

  // Cost = 1025, Markup = 40% -> raw = 1435, unit = 100 -> 1500
  assert.equal(calculateInstallment12mPrice(1025, 40, 100), 1500);
});

test('calculateInstallmentMonthPrice prorates correctly for custom months (1 to 12)', () => {
  const cost = 1000;
  // full12m = 1400
  // for 6 months: cost + ((1400 - 1000) / 12) * 6 = 1000 + 200 = 1200
  assert.equal(calculateInstallmentMonthPrice(cost, 40, 6, 100), 1200);

  // for 12 months: should equal full 12m price (1400)
  assert.equal(calculateInstallmentMonthPrice(cost, 40, 12, 100), 1400);

  // for 3 months: cost + (400 / 12) * 3 = 1000 + 100 = 1100
  assert.equal(calculateInstallmentMonthPrice(cost, 40, 3, 100), 1100);
});

test('calculateMonthlyPayment computes correct monthly instalment share', () => {
  assert.equal(calculateMonthlyPayment(1200, 6), 200);
  assert.equal(calculateMonthlyPayment(1500, 10), 150);
});
