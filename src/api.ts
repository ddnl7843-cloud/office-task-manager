/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Task,
  TaskComment,
  AppNotification,
  Expense,
  ExpenseSettings,
  ActivityLogEntry,
  BrandingSettings,
  Permission,
  RolePermissions,
} from './types';

const TOKEN_KEY = 'office_task_manager_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeStoredToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred');
  }

  return data as T;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User; permissions: Permission[] }> {
    const res = await apiFetch<{ token: string; user: User; permissions: Permission[] }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      removeStoredToken();
    }
  },

  async getMe(): Promise<{ user: User; permissions: Permission[] }> {
    return apiFetch<{ user: User; permissions: Permission[] }>('/api/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async changeMyPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.changePassword(currentPassword, newPassword);
  },

  // Tasks
  async getTasks(params?: Record<string, string>): Promise<Task[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<Task[]>(`/api/tasks${query}`);
  },

  async getTask(id: string): Promise<Task & { comments: TaskComment[] }> {
    return apiFetch<Task & { comments: TaskComment[] }>(`/api/tasks/${id}`);
  },

  async createTask(taskData: Partial<Task>): Promise<{ success: boolean; message: string; task: Task }> {
    return apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<{ success: boolean; message: string; task: Task }> {
    return apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  async requestHelp(id: string, problemDescription: string, helpFrom?: string): Promise<{ success: boolean; task: Task }> {
    return apiFetch(`/api/tasks/${id}/request-help`, {
      method: 'POST',
      body: JSON.stringify({ problemDescription, helpFrom }),
    });
  },

  async clearHelp(id: string, resolutionNote?: string): Promise<{ success: boolean; task: Task }> {
    return apiFetch(`/api/tasks/${id}/clear-help`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNote }),
    });
  },

  async requestCompletion(id: string): Promise<{ success: boolean; task: Task }> {
    return apiFetch(`/api/tasks/${id}/request-completion`, {
      method: 'POST',
    });
  },

  async reviewTask(id: string, decision: 'approve' | 'reject', comment?: string): Promise<{ success: boolean; task: Task }> {
    return apiFetch(`/api/tasks/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  // Comments
  async getComments(taskId: string): Promise<TaskComment[]> {
    return apiFetch<TaskComment[]>(`/api/tasks/${taskId}/comments`);
  },

  async addComment(taskId: string, comment: string): Promise<TaskComment> {
    return apiFetch<TaskComment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  async deleteComment(taskId: string, commentId: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  // Notifications
  async getNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    return apiFetch<{ notifications: AppNotification[]; unreadCount: number }>('/api/notifications');
  },

  async markNotificationRead(id: string): Promise<void> {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async markAllNotificationsRead(): Promise<void> {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
  },

  // Users
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>('/api/users');
  },

  async createUser(data: { name: string; email: string; role: string; password: string }): Promise<{ success: boolean; user: User }> {
    return apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: Partial<User> & { newPassword?: string }): Promise<{ success: boolean; user: User }> {
    return apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  },

  // Permissions
  async getPermissions(): Promise<{
    rolePermissions: RolePermissions;
    allPermissions: Permission[];
    protectedAdminPermissions: Permission[];
    users: Array<Pick<User, 'id' | 'name' | 'role' | 'permissionOverrides'>>;
  }> {
    return apiFetch('/api/permissions');
  },

  async updatePermissions(rolePermissions: RolePermissions): Promise<{ success: boolean; rolePermissions: RolePermissions }> {
    return apiFetch('/api/permissions', {
      method: 'PUT',
      body: JSON.stringify({ rolePermissions }),
    });
  },

  async updateUserPermissions(
    id: string,
    permissionOverrides: NonNullable<User['permissionOverrides']>
  ): Promise<{ success: boolean; permissionOverrides: NonNullable<User['permissionOverrides']> }> {
    return apiFetch(`/api/permissions/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ permissionOverrides }),
    });
  },

  // Activity Log
  async getActivityLogs(params?: Record<string, string>): Promise<ActivityLogEntry[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<ActivityLogEntry[]>(`/api/activity-log${query}`);
  },

  // Settings
  async getBranding(): Promise<BrandingSettings> {
    return apiFetch('/api/branding');
  },

  async updateBranding(branding: {
    appName: string;
    companyName: string;
    logoDataUrl?: string;
    resetLogo?: boolean;
    resetBranding?: boolean;
  }): Promise<{ success: boolean; branding: BrandingSettings }> {
    return apiFetch('/api/branding', {
      method: 'PUT',
      body: JSON.stringify(branding),
    });
  },

  async getExpenseSettings(): Promise<ExpenseSettings> {
    return apiFetch('/api/expenses/settings');
  },

  async updateExpenseSettings(settings: ExpenseSettings): Promise<{ success: boolean; settings: ExpenseSettings }> {
    return apiFetch('/api/expenses/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getExpenses(params: Record<string, string | number> = {}): Promise<{
    expenses: Expense[];
    total: number;
    page: number;
    pageSize: number;
    summary: {
      submitted: number;
      pendingApproval: number;
      approved: number;
      rejected: number;
      reimbursementPending: number;
      totalPaid: number;
      monthlyAmount: number;
    };
  }> {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();
    return apiFetch(`/api/expenses${query ? `?${query}` : ''}`);
  },

  async getExpenseReceipt(id: string): Promise<Blob> {
    const token = getStoredToken();
    const response = await fetch(`/api/expenses/${encodeURIComponent(id)}/receipt`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      let message = 'Could not download receipt';
      try {
        const data = await response.json();
        if (typeof data.error === 'string') message = data.error;
      } catch {
        // The server may return an empty error response.
      }
      throw new Error(message);
    }
    return response.blob();
  },

  async saveExpense(
    expense: Partial<Expense> & { receiptDataUrl?: string; submit?: boolean }
  ): Promise<{ success: boolean; expense: Expense }> {
    return apiFetch('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  },

  async updateExpense(
    id: string,
    expense: Partial<Expense> & { receiptDataUrl?: string; clearReceipt?: boolean }
  ): Promise<{ success: boolean; expense: Expense }> {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(expense),
    });
  },

  async submitExpense(id: string): Promise<{ success: boolean; expense: Expense }> {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}/submit`, { method: 'POST' });
  },

  async reviewExpense(
    id: string,
    action: 'start_review' | 'approve' | 'reject',
    reason?: string
  ): Promise<{ success: boolean; expense: Expense }> {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
  },

  async payExpense(
    id: string,
    payment: { paymentDate: string; paymentReference?: string; paymentRemarks?: string }
  ): Promise<{ success: boolean; expense: Expense }> {
    return apiFetch(`/api/expenses/${encodeURIComponent(id)}/pay`, {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  },

  async getExpenseReports(params: Record<string, string> = {}): Promise<{
    monthlyEmployee: Array<{ month: string; employeeId: string; employeeName: string; kilometres: number; submittedAmount: number; approvedAmount: number; paidAmount: number }>;
    categories: Array<{ category: string; count: number; amount: number; kilometres: number }>;
  }> {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/api/expenses/reports${query ? `?${query}` : ''}`);
  },

  async getSettings(): Promise<any> {
    return apiFetch('/api/settings');
  },

  async updateSettings(settings: any): Promise<{ success: boolean; settings: any }> {
    return apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getRawDatabase(): Promise<any> {
    return apiFetch('/api/database/backup');
  },

  // Reports
  async getReports(): Promise<{
    summary: {
      totalTasks: number;
      completedTasks: number;
      pendingTasks: number;
      overdueTasks: number;
      completionRate: number;
    };
    statusCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
    employeeStats: Array<{
      userId: string;
      userName: string;
      total: number;
      completed: number;
      inProgress: number;
      overdue: number;
    }>;
  }> {
    return apiFetch('/api/reports');
  },

  // Email / SMTP
  async getEmailStatus(): Promise<{
    configured: boolean;
    host: string;
    port: string;
    fromName: string;
    fromEmail: string;
  }> {
    return apiFetch('/api/email/status');
  },

};
