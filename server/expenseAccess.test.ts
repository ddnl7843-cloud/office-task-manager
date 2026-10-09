import assert from 'node:assert/strict';
import test from 'node:test';
import type { Permission } from '../src/types';
import { getAccessibleExpenseRecords } from './expenseAccess';

const records = [
  { id: 'own-draft', employeeId: 'u1', status: 'DRAFT' },
  { id: 'other-draft', employeeId: 'u2', status: 'DRAFT' },
  { id: 'pending', employeeId: 'u2', status: 'SUBMITTED' },
  { id: 'approved', employeeId: 'u2', status: 'APPROVED' },
  { id: 'paid', employeeId: 'u2', status: 'PAID' },
];

test('expense access combines own claims with only the workflow states each permission covers', () => {
  const accessible = getAccessibleExpenseRecords(records, 'u1', [
    'VIEW_OWN_EXPENSES',
    'APPROVE_EXPENSE',
    'PAY_EXPENSE',
  ] satisfies Permission[]);
  assert.deepEqual(accessible?.map(record => record.id), ['own-draft', 'pending', 'approved', 'paid']);
});

test('report-only access is limited to the requesting user', () => {
  const accessible = getAccessibleExpenseRecords(records, 'u1', ['VIEW_EXPENSE_REPORTS']);
  assert.deepEqual(accessible?.map(record => record.id), ['own-draft']);
});

test('users without expense data permissions cannot access any records', () => {
  assert.equal(getAccessibleExpenseRecords(records, 'u1', []), null);
});
