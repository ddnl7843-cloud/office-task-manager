import { Permission, RolePermissions, User, UserRole } from '../src/types';

export const ALL_SYSTEM_PERMISSIONS: Permission[] = [
  'VIEW_DASHBOARD',
  'VIEW_ALL_TASKS',
  'VIEW_OWN_TASKS',
  'CREATE_TASK',
  'EDIT_TASK',
  'DELETE_TASK',
  'ASSIGN_TASK',
  'REASSIGN_TASK',
  'CHANGE_DEADLINE',
  'CHANGE_PRIORITY',
  'UPDATE_TASK',
  'UPDATE_PROGRESS',
  'ADD_COMMENT',
  'REQUEST_HELP',
  'REQUEST_COMPLETION',
  'APPROVE_TASK',
  'REJECT_TASK',
  'VIEW_REPORTS',
  'VIEW_ACTIVITY_LOG',
  'MANAGE_USERS',
  'MANAGE_PERMISSIONS',
  'MANAGE_SETTINGS',
  'VIEW_OWN_EXPENSES',
  'CREATE_EXPENSE',
  'SUBMIT_EXPENSE',
  'VIEW_ALL_EXPENSES',
  'APPROVE_EXPENSE',
  'REJECT_EXPENSE',
  'PAY_EXPENSE',
  'MANAGE_EXPENSE_SETTINGS',
  'VIEW_EXPENSE_REPORTS',
];

export const PROTECTED_ADMIN_PERMISSIONS: Permission[] = [
  'MANAGE_USERS',
  'MANAGE_PERMISSIONS',
  'MANAGE_SETTINGS',
  'MANAGE_EXPENSE_SETTINGS',
];

export function resolveUserPermissions(
  role: UserRole,
  rolePermissions: RolePermissions,
  overrides?: User['permissionOverrides']
): Permission[] {
  const grantedByRole = rolePermissions[role] || [];
  return ALL_SYSTEM_PERMISSIONS.filter(permission => {
    if (PROTECTED_ADMIN_PERMISSIONS.includes(permission)) return role === 'ADMIN';
    const override = overrides?.[permission];
    return override === null || override === undefined ? grantedByRole.includes(permission) : override;
  });
}
