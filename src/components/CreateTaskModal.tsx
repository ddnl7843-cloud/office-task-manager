/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Task, TaskPriority } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { X, PlusCircle, AlertCircle, Calendar } from 'lucide-react';

interface CreateTaskModalProps {
  users: User[];
  onClose: () => void;
  onTaskCreated: (newTask: Task) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  users,
  onClose,
  onTaskCreated,
}) => {
  const { user } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Operations');
  const [customCategory, setCustomCategory] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assignedTo, setAssignedTo] = useState<string>(users[1]?.id || users[0]?.id || '');
  const [approver, setApprover] = useState<string>(user?.id || users[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [deadline, setDeadline] = useState<string>(todayStr);
  const [expectedCompletionDate, setExpectedCompletionDate] = useState<string>(todayStr);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCategories = [
    'Operations',
    'Finance',
    'Sales',
    'Documentation',
    'IT',
    'Customer Support',
    'HR',
    'Admin',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalCategory = category === 'Other' && customCategory ? customCategory : category;

    if (!title.trim() || !assignedTo || !approver || !startDate || !deadline) {
      setError('Please fill in all required task fields');
      return;
    }

    if (new Date(deadline) < new Date(startDate)) {
      setError('Deadline cannot be earlier than start date');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createTask({
        title: title.trim(),
        description: description.trim(),
        category: finalCategory,
        priority,
        assignedTo,
        approver,
        startDate,
        deadline,
        expectedCompletionDate: expectedCompletionDate || deadline,
      });

      onTaskCreated(res.task);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto text-slate-800">
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Create New Office Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly Reconciliation of Vendor Accounts"
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Description / Instructions
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, required deliverable, and reference documents..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {defaultCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {category === 'Other' && (
                <input
                  type="text"
                  placeholder="Specify custom category"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="mt-2 w-full text-xs p-2 rounded-lg border border-slate-300 text-slate-900"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Priority Level <span className="text-rose-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Assign To Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {users
                  .filter((u) => u.status === 'ACTIVE')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role} - {u.email})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Designated Approver <span className="text-rose-500">*</span>
              </label>
              <select
                value={approver}
                onChange={(e) => setApprover(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {users
                  .filter((u) => u.status === 'ACTIVE')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Expected Completion
              </label>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Task...' : 'Create & Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
