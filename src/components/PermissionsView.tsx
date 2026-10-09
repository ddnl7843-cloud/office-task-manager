/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RolePermissions, PermissionAction, User } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Check, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export const PermissionsView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [permissionList, setPermissionList] = useState<{ key: PermissionAction; label: string; desc: string }[]>([]);
  const [protectedAdminPermissions, setProtectedAdminPermissions] = useState<PermissionAction[]>([]);
  const [users, setUsers] = useState<Array<Pick<User, 'id' | 'name' | 'role' | 'permissionOverrides'>>>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoading(true);
        const data = await api.getPermissions();
        setPermissions(data.rolePermissions);
        setProtectedAdminPermissions(data.protectedAdminPermissions);
        setUsers(data.users);
        setPermissionList(data.allPermissions.map((key) => {
          const description: Partial<Record<PermissionAction, [string, string]>> = {
            VIEW_DASHBOARD: ['View Dashboard', 'Open the role-appropriate dashboard'],
            VIEW_ALL_TASKS: ['View All Tasks', 'View tasks across the entire team'],
            VIEW_OWN_TASKS: ['View Assigned Tasks', 'View tasks assigned to or approved by the user'],
            CREATE_TASK: ['Create Tasks', 'Create new tasks'],
            EDIT_TASK: ['Edit Tasks', 'Edit task details and operational status'],
            DELETE_TASK: ['Delete Tasks', 'Permanently remove tasks and associated records'],
            ASSIGN_TASK: ['Assign Tasks', 'Assign tasks to active team members'],
            REASSIGN_TASK: ['Reassign Tasks', 'Change task assignees'],
            CHANGE_DEADLINE: ['Change Deadlines', 'Set or update expected completion dates'],
            CHANGE_PRIORITY: ['Change Priority', 'Set or update task priority'],
            UPDATE_TASK: ['Update Assigned Tasks', 'Update permitted fields on assigned tasks'],
            UPDATE_PROGRESS: ['Update Progress', 'Update task progress and status'],
            ADD_COMMENT: ['Add Comments', 'Post comments on accessible tasks'],
            REQUEST_HELP: ['Request Help', 'Request help on assigned tasks'],
            REQUEST_COMPLETION: ['Request Completion', 'Submit completed assigned tasks for review'],
            APPROVE_TASK: ['Approve Completion', 'Approve task completion requests'],
            REJECT_TASK: ['Reject Completion', 'Reject completion requests with a reason'],
            VIEW_REPORTS: ['View Reports', 'Access reports and analytics'],
            VIEW_ACTIVITY_LOG: ['View Activity Logs', 'Review the system activity log'],
            MANAGE_USERS: ['Manage Users', 'Create, edit, activate, and reset user accounts'],
            MANAGE_PERMISSIONS: ['Manage Permissions', 'Configure role and individual permissions'],
            MANAGE_SETTINGS: ['Manage Settings', 'Change application and notification settings'],
            VIEW_OWN_EXPENSES: ['View Own Expenses', 'View expense claims submitted by this user'],
            CREATE_EXPENSE: ['Create Expenses', 'Create and edit own draft or rejected expense claims'],
            SUBMIT_EXPENSE: ['Submit Expenses', 'Submit own expense claims for approval'],
            VIEW_ALL_EXPENSES: ['View All Expenses', 'View expense claims across all employees'],
            APPROVE_EXPENSE: ['Approve Expenses', 'Review and approve submitted expense claims'],
            REJECT_EXPENSE: ['Reject Expenses', 'Reject expense claims with a required reason'],
            PAY_EXPENSE: ['Mark Expenses Paid', 'Record reimbursement payment for approved claims'],
            MANAGE_EXPENSE_SETTINGS: ['Manage Expense Settings', 'Configure categories, kilometre rates, limits, and approval thresholds'],
            VIEW_EXPENSE_REPORTS: ['View Expense Reports', 'View expense summaries within the user’s data-access scope'],
          };
          const [label, desc] = description[key] || [key, 'Configure access for this capability'];
          return { key, label, desc };
        }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load permissions');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPermissions();
  }, []);

  const handleToggle = (role: 'ADMIN' | 'EMPLOYEE', action: PermissionAction) => {
    if (!permissions) return;
    if (role === 'ADMIN' && protectedAdminPermissions.includes(action)) return;
    const current = permissions[role] || [];
    const hasIt = current.includes(action);

    const updated = hasIt
      ? current.filter((a) => a !== action)
      : [...current, action];

    setPermissions({
      ...permissions,
      [role]: updated,
    });
    setSaveSuccess(false);
  };

  const handleUserOverrideChange = async (permission: PermissionAction, value: string) => {
    const target = users.find((candidate) => candidate.id === selectedUserId);
    if (!target || target.id === currentUser?.id || protectedAdminPermissions.includes(permission)) return;
    const permissionOverrides = { ...(target.permissionOverrides || {}) };
    if (value === 'inherit') {
      delete permissionOverrides[permission];
    } else {
      permissionOverrides[permission] = value === 'allow';
    }
    setIsSavingUser(true);
    setError(null);
    try {
      const result = await api.updateUserPermissions(target.id, permissionOverrides);
      setUsers((previous) => previous.map((candidate) =>
        candidate.id === target.id ? { ...candidate, permissionOverrides: result.permissionOverrides } : candidate
      ));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user permissions');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleSave = async () => {
    if (!permissions) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.updatePermissions(permissions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-semibold">Loading permission matrix...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Role-Based Access Control (RBAC)</h2>
            <p className="text-xs text-slate-500">
                Configure role access and individual user overrides. Critical admin rights are protected.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors self-start sm:self-auto disabled:opacity-50 shadow-2xs"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Permissions'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Permissions saved successfully to office database!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Permissions Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Permission Capability</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center w-28 bg-indigo-50/50">ADMIN</th>
                <th className="py-3 px-4 text-center w-28 bg-slate-50">EMPLOYEE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionList.map((perm) => {
                const adminHas = permissions?.ADMIN.includes(perm.key);
                const employeeHas = permissions?.EMPLOYEE.includes(perm.key);

                return (
                  <tr key={perm.key} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">
                      {perm.key}
                      <span className="block font-sans font-semibold text-slate-700 text-xs mt-0.5">
                        {perm.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{perm.desc}</td>

                    {/* Admin Checkbox */}
                    <td className="py-3 px-4 text-center bg-indigo-50/20">
                      <button
                        type="button"
                        onClick={() => handleToggle('ADMIN', perm.key)}
                        disabled={protectedAdminPermissions.includes(perm.key)}
                        aria-label={`${perm.label}: toggle ADMIN permission`}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                          protectedAdminPermissions.includes(perm.key)
                            ? 'bg-indigo-600 text-white opacity-60 cursor-not-allowed'
                            : adminHas
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </td>

                    {/* Employee Checkbox */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle('EMPLOYEE', perm.key)}
                        aria-label={`${perm.label}: toggle EMPLOYEE permission`}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                          employeeHas
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Individual User Overrides</h3>
          <p className="text-xs text-slate-500">Choose inherit, allow, or deny for each capability. Your own permissions and critical admin privileges cannot be changed here.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          User
          <select
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
            className="mt-1 block w-full sm:max-w-sm rounded-lg border border-slate-300 bg-white p-2 text-slate-900"
          >
            <option value="">Select a user</option>
            {users.filter((candidate) => candidate.id !== currentUser?.id).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.id}, {candidate.role})</option>
            ))}
          </select>
        </label>
        {selectedUserId && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr><th className="p-2">Permission</th><th className="p-2">Role grants</th><th className="p-2">User override</th><th className="p-2">Effective access</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissionList.map((permission) => {
                  const selectedUser = users.find((candidate) => candidate.id === selectedUserId);
                  const override = selectedUser?.permissionOverrides?.[permission.key];
                  const roleHas = Boolean(selectedUser && permissions?.[selectedUser.role].includes(permission.key));
                  const effective = override === null || override === undefined ? roleHas : override;
                  const protectedPermission = protectedAdminPermissions.includes(permission.key);
                  return (
                    <tr key={permission.key}>
                      <td className="p-2 font-medium text-slate-800">{permission.label}</td>
                      <td className="p-2 text-slate-600">{roleHas ? 'Allowed' : 'Denied'}</td>
                      <td className="p-2">
                        <select
                          value={override === null || override === undefined ? 'inherit' : override ? 'allow' : 'deny'}
                          disabled={protectedPermission || isSavingUser}
                          onChange={(event) => handleUserOverrideChange(permission.key, event.target.value)}
                          className="rounded border border-slate-300 bg-white p-1 text-slate-800 disabled:opacity-50"
                        >
                          <option value="inherit">Inherit from role</option>
                          <option value="allow">Allow</option>
                          <option value="deny">Deny</option>
                        </select>
                        {protectedPermission && <span className="ml-2 text-slate-500">Protected</span>}
                      </td>
                      <td className="p-2 font-semibold">{effective ? 'Allowed' : 'Denied'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
