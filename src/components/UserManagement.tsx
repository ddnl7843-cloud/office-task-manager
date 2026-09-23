/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, UserRole, Task } from '../types';
import { api } from '../api';
import { RoleBadge } from './Badge';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Lock,
  Trash2,
} from 'lucide-react';

interface UserManagementProps {
  users: User[];
  tasks: Task[];
  onRefreshUsers: () => Promise<void>;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  tasks,
  onRefreshUsers,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<User | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('EMPLOYEE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset password form state
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Please fill all fields');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        role: newRole,
      });

      await onRefreshUsers();
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.updateUser(user.id, { status: nextStatus });
      await onRefreshUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleToggleRole = async (user: User) => {
    const nextRole: UserRole = user.role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN';
    if (confirm(`Change role of ${user.name} to ${nextRole}?`)) {
      try {
        await api.updateUser(user.id, { role: nextRole });
        await onRefreshUsers();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to change role');
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPasswordModal || !resetPasswordVal.trim()) return;

    setIsResetting(true);
    setResetMessage(null);
    try {
      await api.resetUserPassword(showPasswordModal.id, resetPasswordVal.trim());
      setResetMessage(`Password successfully updated for ${showPasswordModal.name}`);
      setTimeout(() => {
        setShowPasswordModal(null);
        setResetPasswordVal('');
        setResetMessage(null);
      }, 1500);
    } catch (err: unknown) {
      setResetMessage(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!confirm(`Are you sure you want to permanently delete user "${u.name}" (${u.email})?`)) {
      return;
    }
    try {
      await api.deleteUser(u.id);
      await onRefreshUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Office User Management</h2>
            <p className="text-xs text-slate-500">
              Manage team accounts, assign roles, reset credentials, and oversee member workloads
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-2xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Employee</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            All Office Staff ({users.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Initial seed users: Amit (Admin), Rahul, Shailesh, Jitendra
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Tasks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const userTasks = tasks.filter((t) => t.assignedTo === u.id);
                const activeTasks = userTasks.filter(
                  (t) => t.status !== 'Completed' && t.status !== 'Cancelled'
                );

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-600">
                      {u.id}
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                          {u.name.charAt(0)}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">{u.email}</td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <RoleBadge role={u.role} />
                        <button
                          onClick={() => handleToggleRole(u)}
                          className="text-[10px] text-indigo-600 hover:underline"
                          title="Switch between ADMIN and EMPLOYEE"
                        >
                          Change
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800">
                        <strong className="font-semibold">{userTasks.length}</strong> total
                        <span className="text-slate-400 mx-1">&bull;</span>
                        <span className="text-indigo-600 font-semibold">{activeTasks.length}</span> active
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setShowPasswordModal(u)}
                          className="px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 transition-colors"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset Pass</span>
                        </button>

                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            u.status === 'ACTIVE'
                              ? 'text-rose-600 hover:bg-rose-50 border-rose-200'
                              : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1 rounded text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 transition-colors"
                          title="Delete User (Admin only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Add New Office Employee</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikas Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Office Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vikas@paisafin.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                >
                  <option value="EMPLOYEE">EMPLOYEE (Standard office task access)</option>
                  <option value="ADMIN">ADMIN (Full administrative access)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden text-slate-800">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Reset Password for {showPasswordModal.name}</span>
              </h3>
              <button
                onClick={() => setShowPasswordModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                &times;
              </button>
            </div>

            {resetMessage && (
              <div className="mx-4 mt-3 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-900">
                {resetMessage}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(null)}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetPasswordVal.trim()}
                  className="px-4 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isResetting ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
