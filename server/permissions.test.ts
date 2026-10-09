import assert from 'node:assert/strict';
import test from 'node:test';
import type { Permission, RolePermissions } from '../src/types';
import { ALL_SYSTEM_PERMISSIONS, resolveUserPermissions } from './permissions';

const defaultRoles: RolePermissions = {
  ADMIN: [...ALL_SYSTEM_PERMISSIONS],
  EMPLOYEE: [
    'VIEW_DASHBOARD',
    'VIEW_OWN_TASKS',
    'UPDATE_TASK',
    'UPDATE_PROGRESS',
    'ADD_COMMENT',
    'REQUEST_HELP',
    'REQUEST_COMPLETION',
  ],
};

test('individual overrides take effect over role grants', () => {
  const overrides = {
    VIEW_REPORTS: true,
    ADD_COMMENT: false,
  } satisfies Partial<Record<Permission, boolean | null>>;

  const permissions = resolveUserPermissions('EMPLOYEE', defaultRoles, overrides);

  assert.equal(permissions.includes('VIEW_REPORTS'), true);
  assert.equal(permissions.includes('ADD_COMMENT'), false);
  assert.equal(permissions.includes('VIEW_OWN_TASKS'), true);
});

test('employee overrides cannot grant critical administrator permissions', () => {
  const rolePermissions: RolePermissions = {
    ADMIN: [...ALL_SYSTEM_PERMISSIONS],
    EMPLOYEE: ['MANAGE_USERS', 'MANAGE_PERMISSIONS', 'MANAGE_SETTINGS'],
  };
  const overrides = {
    MANAGE_USERS: true,
    MANAGE_PERMISSIONS: true,
    MANAGE_SETTINGS: true,
  } satisfies Partial<Record<Permission, boolean | null>>;

  const permissions = resolveUserPermissions('EMPLOYEE', rolePermissions, overrides);

  assert.equal(permissions.includes('MANAGE_USERS'), false);
  assert.equal(permissions.includes('MANAGE_PERMISSIONS'), false);
  assert.equal(permissions.includes('MANAGE_SETTINGS'), false);
});

test('admin retains critical management permissions regardless of an override', () => {
  const overrides = {
    MANAGE_USERS: false,
    MANAGE_PERMISSIONS: false,
    MANAGE_SETTINGS: false,
  } satisfies Partial<Record<Permission, boolean | null>>;

  const permissions = resolveUserPermissions('ADMIN', defaultRoles, overrides);

  assert.equal(permissions.includes('MANAGE_USERS'), true);
  assert.equal(permissions.includes('MANAGE_PERMISSIONS'), true);
  assert.equal(permissions.includes('MANAGE_SETTINGS'), true);
});
