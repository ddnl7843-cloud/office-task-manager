/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  User,
  Task,
  TaskComment,
  AppNotification,
  ActivityLogEntry,
  AppSettings,
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

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Permissions
  async getPermissions(): Promise<{ rolePermissions: RolePermissions; allPermissions: Permission[] }> {
    return apiFetch('/api/permissions');
  },

  async updatePermissions(rolePermissions: RolePermissions): Promise<{ success: boolean; rolePermissions: RolePermissions }> {
    return apiFetch('/api/permissions', {
      method: 'PUT',
      body: JSON.stringify({ rolePermissions }),
    });
  },

  // Activity Log
  async getActivityLogs(params?: Record<string, string>): Promise<ActivityLogEntry[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<ActivityLogEntry[]>(`/api/activity-log${query}`);
  },

  // Settings
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
    user: string | null;
    fromName: string;
    fromEmail: string;
  }> {
    return apiFetch('/api/email/status');
  },

  async sendTestEmail(email?: string): Promise<{ success: boolean; message: string }> {
    return apiFetch('/api/email/test', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};
