/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RolePermissions, PermissionAction } from '../types';
import { api } from '../api';
import { ShieldAlert, Check, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export const PermissionsView: React.FC = () => {
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionList: { key: PermissionAction; label: string; desc: string }[] = [
    { key: 'CREATE_TASK', label: 'Create New Tasks', desc: 'Can create and assign office tasks to staff' },
    { key: 'EDIT_TASK', label: 'Edit Any Task', desc: 'Can modify titles, categories, priorities, and deadlines' },
    { key: 'DELETE_TASK', label: 'Delete Tasks', desc: 'Can permanently remove tasks from system' },
    { key: 'VIEW_ALL_TASKS', label: 'View All Office Tasks', desc: 'Can view tasks assigned across the entire team' },
    { key: 'ASSIGN_TASK', label: 'Assign / Reassign Tasks', desc: 'Can change who is assigned to complete work' },
    { key: 'APPROVE_TASK', label: 'Approve & Reject Tasks', desc: 'Can verify 100% completion or send back for revisions' },
    { key: 'UPDATE_PROGRESS', label: 'Update Own Progress', desc: 'Can update % progress and request completion on own tasks' },
    { key: 'REQUEST_HELP', label: 'Request Help', desc: 'Can flag task as needing assistance and specify problem' },
    { key: 'ADD_COMMENT', label: 'Add Task Comments', desc: 'Can participate in discussion threads on tasks' },
    { key: 'MANAGE_USERS', label: 'User Management', desc: 'Can create accounts, reset passwords, and toggle status' },
    { key: 'MANAGE_PERMISSIONS', label: 'Role Permissions Control', desc: 'Can modify access rights for roles' },
    { key: 'VIEW_REPORTS', label: 'View Reports & Analytics', desc: 'Can access team metrics and export CSV data' },
    { key: 'VIEW_ACTIVITY_LOG', label: 'Audit Activity Log', desc: 'Can view history log of system actions' },
    { key: 'MANAGE_SETTINGS', label: 'Office Settings', desc: 'Can modify company workspace configuration' },
  ];

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        setIsLoading(true);
        const data = await api.getPermissions();
        setPermissions(data.rolePermissions);
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
              Configure fine-grained system capabilities for ADMIN and EMPLOYEE roles
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
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors ${
                          adminHas
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
    </div>
  );
};
