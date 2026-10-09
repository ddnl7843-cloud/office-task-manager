import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Receipt, RefreshCw, Save, Settings2, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Expense,
  ExpenseCategory,
  ExpenseRate,
  ExpenseSettings,
  ExpenseStatus,
  User,
} from '../types';

interface ExpenseManagementViewProps {
  users: User[];
}

type ExpenseTab = 'list' | 'reports' | 'settings';
type ExpenseSummary = {
  submitted: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
  reimbursementPending: number;
  totalPaid: number;
  monthlyAmount: number;
};

const EMPTY_SUMMARY: ExpenseSummary = {
  submitted: 0,
  pendingApproval: 0,
  approved: 0,
  rejected: 0,
  reimbursementPending: 0,
  totalPaid: 0,
  monthlyAmount: 0,
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved · Payment Pending',
  REJECTED: 'Rejected',
  PAID: 'Paid',
};

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  UNDER_REVIEW: 'bg-amber-50 text-amber-800',
  APPROVED: 'bg-emerald-50 text-emerald-800',
  REJECTED: 'bg-rose-50 text-rose-800',
  PAID: 'bg-green-100 text-green-800',
};

const money = (amount: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(amount);

const today = () => new Date().toISOString().slice(0, 10);

export const ExpenseManagementView: React.FC<ExpenseManagementViewProps> = ({ users }) => {
  const { user, hasPermission } = useAuth();
  const canViewAll = hasPermission('VIEW_ALL_EXPENSES');
  const canCreate = hasPermission('CREATE_EXPENSE');
  const canSubmit = hasPermission('SUBMIT_EXPENSE');
  const canApprove = hasPermission('APPROVE_EXPENSE');
  const canReject = hasPermission('REJECT_EXPENSE');
  const canPay = hasPermission('PAY_EXPENSE');
  const canManageSettings = hasPermission('MANAGE_EXPENSE_SETTINGS');
  const canViewReports = hasPermission('VIEW_EXPENSE_REPORTS');
  const canViewOwn = hasPermission('VIEW_OWN_EXPENSES');
  const canAccessList = canViewAll || canViewOwn || canCreate || canApprove || canReject || canPay;

  const [tab, setTab] = useState<ExpenseTab>(() => canManageSettings && !canAccessList
    ? 'settings'
    : canViewReports && !canAccessList && !canManageSettings ? 'reports' : 'list');
  const [settings, setSettings] = useState<ExpenseSettings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Partial<Expense>>({});
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [receiptName, setReceiptName] = useState('');
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<{
    monthlyEmployee: Array<{ month: string; employeeId: string; employeeName: string; kilometres: number; submittedAmount: number; approvedAmount: number; paidAmount: number }>;
    categories: Array<{ category: string; count: number; amount: number; kilometres: number }>;
  } | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setSettings(await api.getExpenseSettings());
    } catch (settingsError: unknown) {
      setError(settingsError instanceof Error ? settingsError.message : 'Could not load expense settings');
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    if (!canAccessList) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await api.getExpenses({
        page,
        pageSize: 20,
        ...(categoryFilter !== 'ALL' ? { categoryId: categoryFilter } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(paymentFilter !== 'ALL' ? { paymentStatus: paymentFilter } : {}),
        ...(employeeFilter !== 'ALL' ? { employeeId: employeeFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      });
      setExpenses(response.expenses);
      setTotal(response.total);
      setSummary(response.summary);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load expenses');
    } finally {
      setLoading(false);
    }
  }, [canAccessList, categoryFilter, dateFrom, dateTo, employeeFilter, page, paymentFilter, statusFilter]);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    if (tab === 'list' && !canAccessList) setTab(canManageSettings ? 'settings' : 'reports');
  }, [canAccessList, canManageSettings, tab]);

  useEffect(() => {
    if (tab !== 'reports' || !canViewReports) return;
    api.getExpenseReports({ ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) })
      .then(setReports)
      .catch((reportError: unknown) => setError(reportError instanceof Error ? reportError.message : 'Could not load expense reports'));
  }, [canViewReports, dateFrom, dateTo, tab]);

  const enabledCategories = useMemo(
    () => settings?.categories.filter(category => category.enabled) || [],
    [settings]
  );

  const openNewExpense = () => {
    if (!settings || !user) return;
    const firstCategory = enabledCategories[0];
    setEditing(null);
    setForm({
      date: today(),
      categoryId: firstCategory?.id || '',
      description: '',
      amount: 0,
      kilometres: undefined,
      vehicleType: '',
      travelFrom: '',
      travelTo: '',
      remarks: '',
    });
    setReceiptDataUrl(undefined);
    setReceiptName('');
    setFormOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditing(expense);
    setForm({ ...expense });
    setReceiptDataUrl(undefined);
    setReceiptName('');
    setFormOpen(true);
  };

  const selectedCategory = settings?.categories.find(category => category.id === form.categoryId);
  const applicableRate = useMemo(() => {
    if (!settings || !form.categoryId || !form.date || !form.vehicleType) return undefined;
    return settings.rates.filter(rate =>
      rate.vehicleType === form.vehicleType &&
      rate.categoryIds.includes(form.categoryId!) &&
      rate.effectiveDate <= form.date!
    ).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  }, [form.categoryId, form.date, form.vehicleType, settings]);
  const calculatedAmount = selectedCategory?.calculationMode === 'KILOMETRE'
    ? Math.round(Number(form.kilometres || 0) * (applicableRate?.ratePerKm || 0) * 100) / 100
    : Number(form.amount || 0);
  const vehicleTypes = useMemo(() => [...new Set(
    settings?.rates.filter(rate => rate.categoryIds.includes(form.categoryId || '')).map(rate => rate.vehicleType) || []
  )].sort(), [form.categoryId, settings]);

  const handleReceiptSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Receipt must be a PNG, JPEG, or PDF file no larger than 5 MB');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Could not read receipt file');
        return;
      }
      setReceiptDataUrl(reader.result);
      setReceiptName(file.name);
    };
    reader.onerror = () => setError('Could not read receipt file');
    reader.readAsDataURL(file);
  };

  const saveExpense = async (submit: boolean) => {
    if (!settings || !user) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: form.date,
        categoryId: form.categoryId,
        description: form.description,
        amount: form.amount,
        kilometres: form.kilometres,
        vehicleType: form.vehicleType,
        travelFrom: form.travelFrom,
        travelTo: form.travelTo,
        remarks: form.remarks,
        submit,
        ...(receiptDataUrl ? { receiptDataUrl, receiptName } : {}),
      };
      if (editing) {
        await api.updateExpense(editing.id, payload);
        if (submit) await api.submitExpense(editing.id);
      } else {
        await api.saveExpense(payload);
      }
      setFormOpen(false);
      await fetchExpenses();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save expense');
    } finally {
      setSaving(false);
    }
  };

  const withExpenseAction = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await fetchExpenses();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'Expense action failed');
    }
  };

  const downloadReceipt = async (expense: Expense) => {
    try {
      const blob = await api.getExpenseReceipt(expense.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = expense.receiptName || `${expense.id}-receipt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (downloadError: unknown) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download receipt');
    }
  };

  const downloadCsv = () => {
    if (!reports) return;
    const columns = ['Report', 'Month', 'Employee ID', 'Employee', 'Category', 'Kilometres', 'Expense Count', 'Submitted Amount INR', 'Approved Amount INR', 'Paid Amount INR'];
    const employeeRows = reports.monthlyEmployee.map(report => [
      'Employee monthly',
      report.month,
      report.employeeId,
      report.employeeName,
      '',
      report.kilometres,
      '',
      report.submittedAmount.toFixed(2),
      report.approvedAmount.toFixed(2),
      report.paidAmount.toFixed(2),
    ]);
    const categoryRows = reports.categories.map(report => [
      'Category total',
      '',
      '',
      '',
      report.category,
      report.kilometres,
      report.count,
      report.amount.toFixed(2),
      '',
      '',
    ]);
    const csv = [columns, ...employeeRows, ...categoryRows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `paisafin-expense-report-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateCategory = (categoryId: string, changes: Partial<ExpenseCategory>) => {
    setSettings(current => {
      if (!current) return current;
      const categories = current.categories.map(category => category.id === categoryId ? { ...category, ...changes } : category);
      const rates = changes.calculationMode === 'AMOUNT'
        ? current.rates.map(rate => ({ ...rate, categoryIds: rate.categoryIds.filter(id => id !== categoryId) }))
          .filter(rate => rate.categoryIds.length > 0)
        : current.rates;
      return { ...current, categories, rates };
    });
    setSettingsSaved(false);
  };

  const addCategory = () => {
    if (!settings) return;
    const name = window.prompt('Enter the expense category name');
    if (!name?.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    if (id.length < 2 || settings.categories.some(category => category.id === id || category.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('Category names must be unique and contain at least two letters or numbers');
      return;
    }
    setSettings({ ...settings, categories: [...settings.categories, {
      id,
      name: name.trim().slice(0, 80),
      enabled: true,
      calculationMode: 'AMOUNT',
      receiptRequired: true,
    }] });
    setSettingsSaved(false);
  };

  const [rateForm, setRateForm] = useState({ vehicleType: 'Car', ratePerKm: '', effectiveDate: today(), categoryIds: [] as string[] });
  const addRate = () => {
    if (!settings || !rateForm.vehicleType.trim() || !rateForm.ratePerKm || !rateForm.categoryIds.length) return;
    const rate: ExpenseRate = {
      id: `rate-${Date.now()}`,
      vehicleType: rateForm.vehicleType.trim(),
      ratePerKm: Number(rateForm.ratePerKm),
      effectiveDate: rateForm.effectiveDate,
      categoryIds: rateForm.categoryIds,
    };
    setSettings({ ...settings, rates: [...settings.rates, rate] });
    setRateForm({ ...rateForm, ratePerKm: '', effectiveDate: today() });
    setSettingsSaved(false);
  };

  const saveExpenseSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const response = await api.updateExpenseSettings(settings);
      setSettings(response.settings);
      setSettingsSaved(true);
    } catch (settingsError: unknown) {
      setError(settingsError instanceof Error ? settingsError.message : 'Could not save expense settings');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const tabs: Array<{ id: ExpenseTab; label: string }> = [
    ...(canAccessList ? [{ id: 'list' as const, label: canViewAll ? 'All Expenses' : 'My Expenses' }] : []),
    ...(canViewReports ? [{ id: 'reports' as const, label: 'Reports' }] : []),
    ...(canManageSettings ? [{ id: 'settings' as const, label: 'Rates & Categories' }] : []),
  ];

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Submitted', summary.submitted.toLocaleString()],
          ['Pending Approval', summary.pendingApproval.toLocaleString()],
          ['Approved', summary.approved.toLocaleString()],
          ['Rejected', summary.rejected.toLocaleString()],
          ['Reimbursement Pending', money(summary.reimbursementPending)],
          ['Total Paid', money(summary.totalPaid)],
          ['This Month', money(summary.monthlyAmount)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map(item => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
              {item.label}
            </button>
          ))}
        </div>
        {canCreate && tab === 'list' && (
          <button type="button" onClick={openNewExpense} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
      {settingsSaved && tab === 'settings' && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Expense settings saved.</div>}

      {tab === 'list' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-6">
            {canViewAll && (
              <select aria-label="Filter employee" value={employeeFilter} onChange={event => { setEmployeeFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
                <option value="ALL">All employees</option>
                {users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            )}
            <select aria-label="Filter category" value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
              <option value="ALL">All categories</option>
              {(settings?.categories || []).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select aria-label="Filter approval status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
              <option value="ALL">All statuses</option>
              {(Object.keys(STATUS_LABELS) as ExpenseStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            <select aria-label="Filter payment status" value={paymentFilter} onChange={event => { setPaymentFilter(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
              <option value="ALL">All payment statuses</option>
              <option value="PENDING">Payment pending</option>
              <option value="PAID">Paid</option>
            </select>
            <input aria-label="From date" type="date" value={dateFrom} onChange={event => { setDateFrom(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <input aria-label="To date" type="date" value={dateTo} onChange={event => { setDateTo(event.target.value); setPage(1); }} className="rounded-lg border border-slate-300 p-2 text-xs" />
          </div>
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading expenses…</div>
          ) : expenses.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500"><Receipt className="mx-auto mb-2 h-8 w-8 text-slate-300" />No expenses match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>{['Date / Employee', 'Category / Reason', 'Calculation', 'Status', 'Receipt', 'Actions'].map(title => <th key={title} className="px-3 py-3">{title}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map(expense => (
                    <tr key={expense.id} className="align-top hover:bg-slate-50">
                      <td className="px-3 py-3"><div className="font-semibold text-slate-800">{expense.date}</div><div className="mt-1 text-slate-500">{expense.employeeName}</div><div className="font-mono text-[10px] text-slate-400">{expense.id}</div></td>
                      <td className="max-w-xs px-3 py-3"><div className="font-semibold text-slate-800">{expense.categoryName}</div><div className="mt-1 break-words text-slate-600">{expense.description}</div>{expense.rejectionReason && <div className="mt-1 text-rose-700">Reason: {expense.rejectionReason}</div>}{expense.travelFrom && <div className="mt-1 text-slate-500">{expense.travelFrom} → {expense.travelTo}</div>}</td>
                      <td className="px-3 py-3"><div className="font-bold text-slate-900">{money(expense.amount)}</div>{expense.kilometres !== undefined && <div className="mt-1 text-slate-500">{expense.kilometres} km × {money(expense.ratePerKm || 0)}/km</div>}{expense.rateEffectiveDate && <div className="text-[10px] text-slate-400">Rate from {expense.rateEffectiveDate}</div>}{expense.status === 'PAID' && <div className="mt-1 text-green-700">Paid {expense.paymentDate}</div>}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${STATUS_STYLES[expense.status]}`}>{STATUS_LABELS[expense.status]}</span></td>
                      <td className="px-3 py-3">{expense.receiptFile ? <button type="button" onClick={() => void downloadReceipt(expense)} className="inline-flex items-center gap-1 text-indigo-700 hover:underline"><FileText className="h-3.5 w-3.5" />Download</button> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">
                        {canCreate && expense.employeeId === user?.id && (expense.status === 'DRAFT' || expense.status === 'REJECTED') && <button type="button" onClick={() => openEditExpense(expense)} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700">Edit</button>}
                        {canSubmit && expense.employeeId === user?.id && expense.status === 'DRAFT' && <button type="button" onClick={() => void withExpenseAction(() => api.submitExpense(expense.id))} className="rounded bg-blue-600 px-2 py-1 font-semibold text-white">Submit</button>}
                        {canApprove && (expense.status === 'SUBMITTED' || expense.status === 'UNDER_REVIEW') && <button type="button" onClick={() => void withExpenseAction(() => api.reviewExpense(expense.id, expense.status === 'SUBMITTED' ? 'start_review' : 'approve'))} className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white">{expense.status === 'SUBMITTED' ? 'Start review' : 'Approve'}</button>}
                        {canReject && (expense.status === 'SUBMITTED' || expense.status === 'UNDER_REVIEW') && <button type="button" onClick={() => { const reason = window.prompt('Enter the reason for rejecting this expense'); if (reason?.trim()) void withExpenseAction(() => api.reviewExpense(expense.id, 'reject', reason)); }} className="rounded bg-rose-600 px-2 py-1 font-semibold text-white">Reject</button>}
                        {canPay && expense.status === 'APPROVED' && <button type="button" onClick={() => { const paymentReference = window.prompt('Payment reference (optional)') || ''; const paymentRemarks = window.prompt('Payment remarks (optional)') || ''; void withExpenseAction(() => api.payExpense(expense.id, { paymentDate: today(), paymentReference, paymentRemarks })); }} className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white">Mark paid</button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
            <span>{total.toLocaleString()} expenses · Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} className="rounded border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>
      )}

      {tab === 'reports' && canViewReports && (
        <section className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <input aria-label="Report from date" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <input aria-label="Report to date" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="rounded-lg border border-slate-300 p-2 text-xs" />
            <button type="button" onClick={downloadCsv} disabled={!reports} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4" />Export CSV</button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <h3 className="p-4 text-sm font-bold text-slate-900">Monthly Employee Expense Report</h3>
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{['Month', 'Employee', 'Kilometres', 'Submitted', 'Approved', 'Paid'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{(reports?.monthlyEmployee || []).map((report, index) => <tr key={`${report.month}-${report.employeeId}-${index}`}><td className="px-3 py-3">{report.month}</td><td className="px-3 py-3">{report.employeeName}</td><td className="px-3 py-3">{report.kilometres}</td><td className="px-3 py-3">{money(report.submittedAmount)}</td><td className="px-3 py-3">{money(report.approvedAmount)}</td><td className="px-3 py-3">{money(report.paidAmount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <h3 className="p-4 text-sm font-bold text-slate-900">Category Totals</h3>
            <table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{['Category', 'Count', 'Kilometres', 'Amount'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{(reports?.categories || []).map(item => <tr key={item.category}><td className="px-3 py-3">{item.category}</td><td className="px-3 py-3">{item.count}</td><td className="px-3 py-3">{item.kilometres}</td><td className="px-3 py-3">{money(item.amount)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'settings' && canManageSettings && settings && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-slate-900">Expense Categories and Rates</h3><p className="mt-1 text-xs text-slate-500">Rates are applied by expense date; each submitted claim keeps its original rate snapshot.</p></div><Settings2 className="h-5 w-5 text-indigo-600" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">Maximum amount per expense (₹)<input type="number" min="1" value={settings.maxAmount} onChange={event => setSettings({ ...settings, maxAmount: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
            <label className="text-xs font-semibold text-slate-700">Maximum kilometres<input type="number" min="1" value={settings.maxKilometres} onChange={event => setSettings({ ...settings, maxKilometres: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
            <label className="text-xs font-semibold text-slate-700">Admin approval threshold (₹)<input type="number" min="0" max={settings.maxAmount} value={settings.approvalThreshold} onChange={event => setSettings({ ...settings, approvalThreshold: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2" /></label>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><h4 className="text-xs font-bold uppercase text-slate-700">Categories</h4><button type="button" onClick={addCategory} className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold">Add category</button></div>
            {settings.categories.map(category => <div key={category.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_150px_auto_auto] sm:items-center">
              <input aria-label="Category name" value={category.name} maxLength={80} onChange={event => updateCategory(category.id, { name: event.target.value })} className="rounded border border-slate-300 p-2 text-xs" />
              <select aria-label="Calculation mode" value={category.calculationMode} onChange={event => updateCategory(category.id, { calculationMode: event.target.value as ExpenseCategory['calculationMode'] })} className="rounded border border-slate-300 bg-white p-2 text-xs"><option value="AMOUNT">Actual amount</option><option value="KILOMETRE">Per kilometre</option></select>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={category.enabled} onChange={event => updateCategory(category.id, { enabled: event.target.checked })} />Enabled</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={category.receiptRequired} onChange={event => updateCategory(category.id, { receiptRequired: event.target.checked })} />Receipt required</label>
            </div>)}
          </div>
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase text-slate-700">Per-kilometre rates</h4>
            <div className="grid gap-2 sm:grid-cols-4">
              <input aria-label="Vehicle type" value={rateForm.vehicleType} onChange={event => setRateForm({ ...rateForm, vehicleType: event.target.value })} placeholder="Vehicle type" className="rounded border border-slate-300 p-2 text-xs" />
              <input aria-label="Rate per kilometre" type="number" min="0.01" step="0.01" value={rateForm.ratePerKm} onChange={event => setRateForm({ ...rateForm, ratePerKm: event.target.value })} placeholder="₹ per km" className="rounded border border-slate-300 p-2 text-xs" />
              <input aria-label="Rate effective date" type="date" value={rateForm.effectiveDate} onChange={event => setRateForm({ ...rateForm, effectiveDate: event.target.value })} className="rounded border border-slate-300 p-2 text-xs" />
              <button type="button" disabled={!rateForm.vehicleType.trim() || !rateForm.ratePerKm || rateForm.categoryIds.length === 0} onClick={addRate} className="rounded bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add rate</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {settings.categories.filter(category => category.calculationMode === 'KILOMETRE').map(category => <label key={category.id} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={rateForm.categoryIds.includes(category.id)} onChange={event => setRateForm({
                ...rateForm,
                categoryIds: event.target.checked ? [...rateForm.categoryIds, category.id] : rateForm.categoryIds.filter(id => id !== category.id),
              })} />{category.name}</label>)}
            </div>
            {settings.rates.length === 0 ? <p className="text-xs text-amber-700">No rates configured. Kilometre claims cannot be submitted until an effective-dated rate is added.</p> : (
              <div className="space-y-2">{[...settings.rates].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).map(rate => <div key={rate.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-xs">
                <span><strong>{rate.vehicleType}</strong> · {money(rate.ratePerKm)}/km · from {rate.effectiveDate} · {rate.categoryIds.map(id => settings.categories.find(category => category.id === id)?.name || id).join(', ')}</span>
                <button type="button" onClick={() => setSettings({ ...settings, rates: settings.rates.filter(item => item.id !== rate.id) })} className="text-rose-700">Remove</button>
              </div>)}</div>
            )}
          </div>
          <div className="flex justify-end"><button type="button" disabled={saving} onClick={() => void saveExpenseSettings()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save expense settings'}</button></div>
        </section>
      )}

      {formOpen && settings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3">
          <div className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-4">
              <div><h3 className="font-bold text-slate-900">{editing ? 'Edit Expense' : 'Add Expense'}</h3><p className="text-xs text-slate-500">Save a draft or submit it for approval.</p></div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close expense form"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-4">
              {error && <div role="alert" className="rounded bg-rose-50 p-2 text-xs text-rose-800">{error}</div>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">Expense date<input required type="date" max={today()} value={form.date || ''} onChange={event => setForm({ ...form, date: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
                <label className="text-xs font-semibold text-slate-700">Category<select required value={form.categoryId || ''} onChange={event => setForm({ ...form, categoryId: event.target.value, amount: 0, kilometres: undefined, vehicleType: '' })} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900"><option value="">Select category</option>{enabledCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              </div>
              <label className="block text-xs font-semibold text-slate-700">Reason / description<textarea required maxLength={1000} value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
              {selectedCategory?.calculationMode === 'KILOMETRE' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">Vehicle type<select required value={form.vehicleType || ''} onChange={event => setForm({ ...form, vehicleType: event.target.value })} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900"><option value="">Select vehicle</option>{vehicleTypes.map(vehicle => <option key={vehicle} value={vehicle}>{vehicle}</option>)}</select></label>
                  <label className="text-xs font-semibold text-slate-700">Distance (km)<input required type="number" min="0.01" max={settings.maxKilometres} step="0.01" value={form.kilometres ?? ''} onChange={event => setForm({ ...form, kilometres: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-700">Travel from<input required maxLength={200} value={form.travelFrom || ''} onChange={event => setForm({ ...form, travelFrom: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
                  <label className="text-xs font-semibold text-slate-700">Travel to<input required maxLength={200} value={form.travelTo || ''} onChange={event => setForm({ ...form, travelTo: event.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
                  <div className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-950 sm:col-span-2"><div className="font-bold">Calculated reimbursement: {money(calculatedAmount)}</div>{applicableRate ? <div className="mt-1">{Number(form.kilometres || 0)} km × {money(applicableRate.ratePerKm)}/km · effective {applicableRate.effectiveDate}</div> : <div className="mt-1 text-amber-800">No applicable rate for this vehicle and travel date. An administrator must configure it before submission.</div>}<div className="mt-1 text-[10px]">Final amount is independently calculated by the server.</div></div>
                </div>
              ) : selectedCategory && (
                <label className="block text-xs font-semibold text-slate-700">Amount (₹)<input required type="number" min="0.01" max={settings.maxAmount} step="0.01" value={form.amount ?? ''} onChange={event => setForm({ ...form, amount: Number(event.target.value) })} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
              )}
              <label className="block text-xs font-semibold text-slate-700">Supporting receipt {selectedCategory?.receiptRequired ? '(required)' : '(optional)'}<input type="file" accept="image/png,image/jpeg,application/pdf" onChange={handleReceiptSelect} className="mt-1 block w-full rounded border border-slate-300 p-2 text-xs" />{receiptName && <span className="mt-1 block text-slate-500">{receiptName}</span>}{editing?.receiptFile && !receiptDataUrl && <span className="mt-1 block text-slate-500">An existing receipt is attached.</span>}</label>
              <label className="block text-xs font-semibold text-slate-700">Remarks<textarea maxLength={1000} value={form.remarks || ''} onChange={event => setForm({ ...form, remarks: event.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-300 p-2 text-slate-900" /></label>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
                <button type="button" disabled={saving} onClick={() => void saveExpense(false)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Save className="h-4 w-4" />Save draft</button>
                {canSubmit && <button type="button" disabled={saving} onClick={() => void saveExpense(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Submit for approval'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
