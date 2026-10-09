/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, UserRole, UserStatus, Task } from '../types';
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
  Search,
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');

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
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE');
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editError, setEditError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  const startEditingUser = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditError(null);
  };

  const handleUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    setIsUpdating(true);
    setEditError(null);
    try {
      await api.updateUser(editingUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
      });
      await onRefreshUsers();
      setEditingUser(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsUpdating(false);
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

  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesQuery = !query || [user.id, user.name, user.email].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (roleFilter === 'ALL' || user.role === roleFilter) &&
      (statusFilter === 'ALL' || user.status === statusFilter);
  });

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
              Manage team accounts, approve signup requests, assign roles, reset credentials, and oversee workloads
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-2xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            All Office Staff ({filteredUsers.length} of {users.length})
          </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="relative sm:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ID" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900" />
            </label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'ALL' | UserRole)} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900">
              <option value="ALL">All roles</option><option value="ADMIN">Admin</option><option value="EMPLOYEE">Employee</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | UserStatus)} className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900">
              <option value="ALL">All statuses</option><option value="PENDING">Pending approval</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
          </div>
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
              {filteredUsers.map((u) => {
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
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : u.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-300'
                        }`}
                      >
                        {u.status === 'PENDING' ? 'PENDING APPROVAL' : u.status}
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
                          onClick={() => startEditingUser(u)}
                          className="px-2.5 py-1 rounded text-xs font-medium text-indigo-700 hover:bg-indigo-50 border border-indigo-200 flex items-center gap-1"
                          title="Edit user details and role"
                        >
                          <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                        </button>
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
                          {u.status === 'ACTIVE' ? 'Deactivate' : u.status === 'PENDING' ? 'Approve' : 'Activate'}
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

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Edit User — {editingUser.id}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close edit user dialog">&times;</button>
            </div>
            {editError && <p role="alert" className="mx-4 mt-3 rounded bg-rose-50 p-2 text-xs text-rose-700">{editError}</p>}
            <form onSubmit={handleUpdateUser} className="p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Full name
                <input required value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Email
                <input required type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Role
                <select value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Account status
                <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as UserStatus)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900">
                  <option value="ACTIVE">Active</option>
                  {editingUser.status === 'PENDING' && <option value="PENDING">Pending approval</option>}
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isUpdating} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isUpdating ? 'Saving...' : 'Save User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden text-slate-800">
            <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Add New User</span>
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
                  minLength={10}
                  placeholder="At least 10 characters"
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
                  {isSubmitting ? 'Creating...' : 'Create User'}
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
                  minLength={10}
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
