import type { ExpenseRate } from '../src/types';

export function selectEffectiveExpenseRate(
  rates: ExpenseRate[],
  expenseDate: string,
  categoryId: string,
  vehicleType: string
): ExpenseRate | undefined {
  return rates
    .filter(rate =>
      rate.vehicleType === vehicleType &&
      rate.categoryIds.includes(categoryId) &&
      /^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveDate) &&
      rate.effectiveDate <= expenseDate
    )
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

export function calculateKilometreExpense(kilometres: number, ratePerKm: number): number {
  return Math.round(kilometres * ratePerKm * 100) / 100;
}
