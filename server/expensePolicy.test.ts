import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExpenseRate } from '../src/types';
import { calculateKilometreExpense, selectEffectiveExpenseRate } from './expensePolicy';

const rates: ExpenseRate[] = [
  { id: 'old', vehicleType: 'Car', ratePerKm: 4, effectiveDate: '2026-01-01', categoryIds: ['petrol-fuel'] },
  { id: 'new', vehicleType: 'Car', ratePerKm: 5, effectiveDate: '2026-10-10', categoryIds: ['petrol-fuel'] },
  { id: 'bike', vehicleType: 'Bike', ratePerKm: 3, effectiveDate: '2026-01-01', categoryIds: ['petrol-fuel'] },
];

test('selects the latest applicable rate at the expense date, not a future rate', () => {
  assert.equal(selectEffectiveExpenseRate(rates, '2026-10-09', 'petrol-fuel', 'Car')?.id, 'old');
  assert.equal(selectEffectiveExpenseRate(rates, '2026-10-10', 'petrol-fuel', 'Car')?.id, 'new');
  assert.equal(selectEffectiveExpenseRate(rates, '2026-10-10', 'petrol-fuel', 'Bike')?.id, 'bike');
  assert.equal(selectEffectiveExpenseRate(rates, '2026-10-10', 'local-travel', 'Car'), undefined);
});

test('calculates reimbursement in currency precision', () => {
  assert.equal(calculateKilometreExpense(32, 5), 160);
  assert.equal(calculateKilometreExpense(1.25, 4.25), 5.31);
});
