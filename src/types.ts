/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export type Permission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_ALL_TASKS'
  | 'VIEW_OWN_TASKS'
  | 'CREATE_TASK'
  | 'EDIT_TASK'
  | 'DELETE_TASK'
  | 'ASSIGN_TASK'
  | 'REASSIGN_TASK'
  | 'CHANGE_DEADLINE'
  | 'CHANGE_PRIORITY'
  | 'UPDATE_TASK'
  | 'UPDATE_PROGRESS'
  | 'ADD_COMMENT'
  | 'REQUEST_HELP'
  | 'REQUEST_COMPLETION'
  | 'APPROVE_TASK'
  | 'REJECT_TASK'
  | 'VIEW_REPORTS'
  | 'VIEW_ACTIVITY_LOG'
  | 'MANAGE_USERS'
  | 'MANAGE_PERMISSIONS'
  | 'MANAGE_SETTINGS';

export type TaskStatus =
  | 'Not Started'
  | 'Assigned'
  | 'In Progress'
  | 'On Hold'
  | 'Completion Requested'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type ApprovalStatus = 'None' | 'Pending' | 'Approved' | 'Rejected';

export interface Task {
  id: string; // e.g. "TASK-20260922-0001"
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  createdBy: string;
  createdByName: string;
  assignedTo: string;
  assignedToName: string;
  approver: string;
  approverName: string;
  startDate: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  expectedCompletionDate: string; // YYYY-MM-DD
  status: TaskStatus;
  progress: number; // 0 to 100
  needHelp: boolean;
  helpFrom?: string;
  helpFromName?: string;
  problemDescription?: string;
  lastHelpResolution?: string;
  completionRequestedAt?: string;
  approvalStatus: ApprovalStatus;
  approvalComment?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  isOverdue?: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  comment: string;
  createdAt: string;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'DEADLINE_APPROACHING'
  | 'HELP_REQUESTED'
  | 'HELP_RESOLVED'
  | 'COMPLETION_REQUESTED'
  | 'TASK_APPROVED'
  | 'TASK_REJECTED'
  | 'TASK_REASSIGNED'
  | 'GENERAL';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  taskId?: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  taskId?: string;
  taskTitle?: string;
  description: string;
}

export type ActivityLog = ActivityLogEntry;

export type PermissionAction = Permission;

export interface OfficeSettings {
  officeName: string;
  companyCode: string;
  workingDays: string;
  overdueAlertDaysThreshold: number;
  autoNotifyAssignee: boolean;
  autoNotifyApproverOnCompletion: boolean;
}

export interface AppSettings {
  companyName: string;
  appName: string;
  defaultTaskPriority: TaskPriority;
  defaultTaskStatus: TaskStatus;
  sessionTimeoutMinutes: number;
  enableDeadlineNotifications: boolean;
  notificationAdvanceDays: number;
}

export interface RolePermissions {
  ADMIN: Permission[];
  EMPLOYEE: Permission[];
}
