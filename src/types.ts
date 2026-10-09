/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  permissionOverrides?: Partial<Record<Permission, boolean | null>>;
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
  | 'MANAGE_SETTINGS'
  | 'VIEW_OWN_EXPENSES'
  | 'CREATE_EXPENSE'
  | 'SUBMIT_EXPENSE'
  | 'VIEW_ALL_EXPENSES'
  | 'APPROVE_EXPENSE'
  | 'REJECT_EXPENSE'
  | 'PAY_EXPENSE'
  | 'MANAGE_EXPENSE_SETTINGS'
  | 'VIEW_EXPENSE_REPORTS';

export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
export type ExpenseCalculationMode = 'AMOUNT' | 'KILOMETRE';

export interface ExpenseCategory {
  id: string;
  name: string;
  enabled: boolean;
  calculationMode: ExpenseCalculationMode;
  receiptRequired: boolean;
}

export interface ExpenseRate {
  id: string;
  vehicleType: string;
  ratePerKm: number;
  effectiveDate: string;
  categoryIds: string[];
}

export interface ExpenseSettings {
  categories: ExpenseCategory[];
  rates: ExpenseRate[];
  maxAmount: number;
  maxKilometres: number;
  approvalThreshold: number;
}

export interface Expense {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  categoryId: string;
  categoryName: string;
  description: string;
  calculationMode: ExpenseCalculationMode;
  amount: number;
  kilometres?: number;
  vehicleType?: string;
  ratePerKm?: number;
  rateEffectiveDate?: string;
  receiptFile?: string;
  receiptName?: string;
  receiptType?: string;
  travelFrom?: string;
  travelTo?: string;
  remarks?: string;
  status: ExpenseStatus;
  rejectionReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  paymentDate?: string;
  paymentReference?: string;
  paymentRemarks?: string;
  paidBy?: string;
  paidByName?: string;
  createdAt: string;
  updatedAt: string;
}

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
  logoUrl?: string | null;
  defaultTaskPriority: TaskPriority;
  defaultTaskStatus: TaskStatus;
  sessionTimeoutMinutes: number;
  enableDeadlineNotifications: boolean;
  notificationAdvanceDays: number;
}

export interface BrandingSettings {
  companyName: string;
  appName: string;
  logoUrl: string | null;
}

export interface RolePermissions {
  ADMIN: Permission[];
  EMPLOYEE: Permission[];
}
