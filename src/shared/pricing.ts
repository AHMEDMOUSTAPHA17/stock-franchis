/**
 * Canonical Pricing Engine & Calculations
 * Single Source of Truth for G.STOCK-Franchise ERP v3.0.0
 * Pure functions, testable in node:test
 */

export interface PricingSettings {
  markupCashPercent: number; // e.g. 20.0 (%)
  markupInstallmentPercent: number; // e.g. 40.0 (%)
  roundingUnit: number; // e.g. 10, 50, 100, 500, 1000
}

/**
 * 1. Markup Formula:
 * Price_raw = Cost * (1 + MarkupPercent / 100)
 *
 * 2. Mandatory Ceiling Rounding:
 * Price_final = Math.ceil(Price_raw / RoundingUnit) * RoundingUnit
 */
export function calculateCashPrice(
  costPrice: number,
  markupCashPercent: number = 20,
  roundingUnit: number = 100
): number {
  if (costPrice <= 0) return 0;
  const markup = Math.max(0, markupCashPercent);
  const raw = costPrice * (1 + markup / 100);
  const unit = Math.max(1, roundingUnit);
  return Math.ceil(raw / unit) * unit;
}

/**
 * Calculate full 12-month installment reference price:
 * Price_facture = Cost * (1 + MarkupInstallmentPercent / 100)
 * Ceiling rounded to RoundingUnit
 */
export function calculateInstallment12mPrice(
  costPrice: number,
  markupInstallmentPercent: number = 40,
  roundingUnit: number = 100
): number {
  if (costPrice <= 0) return 0;
  const markup = Math.max(0, markupInstallmentPercent);
  const raw = costPrice * (1 + markup / 100);
  const unit = Math.max(1, roundingUnit);
  return Math.ceil(raw / unit) * unit;
}

/**
 * 3. Dynamic Installment Proration Formula (N_mois from 1 to 12 months):
 * Prix_mois = Prix_achat + [ (Prix_facture - Prix_achat) / 12 * N_mois ]
 * Followed by ceiling rounding to RoundingUnit.
 */
export function calculateInstallmentMonthPrice(
  costPrice: number,
  markupInstallmentPercent: number = 40,
  months: number = 12,
  roundingUnit: number = 100
): number {
  if (costPrice <= 0) return 0;
  const nMonths = Math.min(12, Math.max(1, Math.round(months)));
  const full12mPrice = calculateInstallment12mPrice(costPrice, markupInstallmentPercent, roundingUnit);
  
  if (nMonths === 12) {
    return full12mPrice;
  }
  
  const rawProrated = costPrice + ((full12mPrice - costPrice) / 12) * nMonths;
  const unit = Math.max(1, roundingUnit);
  return Math.ceil(rawProrated / unit) * unit;
}

/**
 * Helper to compute monthly installment quota
 */
export function calculateMonthlyPayment(totalPrice: number, months: number): number {
  if (months <= 0) return totalPrice;
  return Math.round((totalPrice / months) * 100) / 100;
}
