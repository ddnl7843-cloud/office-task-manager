import type { Permission } from '../src/types';

type ExpenseAccessRecord = {
  employeeId: string;
  status: string;
};

export function getAccessibleExpenseRecords<T extends ExpenseAccessRecord>(
  expenses: T[],
  userId: string,
  permissions: readonly Permission[]
): T[] | null {
  if (permissions.includes('VIEW_ALL_EXPENSES')) return expenses;
  const canViewOwn = permissions.includes('VIEW_OWN_EXPENSES') ||
    permissions.includes('CREATE_EXPENSE') || permissions.includes('VIEW_EXPENSE_REPORTS');
  const canReview = permissions.includes('APPROVE_EXPENSE') || permissions.includes('REJECT_EXPENSE');
  const canPay = permissions.includes('PAY_EXPENSE');
  if (!canViewOwn && !canReview && !canPay) return null;
  return expenses.filter(expense =>
    (canViewOwn && expense.employeeId === userId) ||
    (canReview && (expense.status === 'SUBMITTED' || expense.status === 'UNDER_REVIEW')) ||
    (canPay && (expense.status === 'APPROVED' || expense.status === 'PAID'))
  );
}
