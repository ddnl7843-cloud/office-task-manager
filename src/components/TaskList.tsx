/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Task, User, TaskStatus, TaskPriority } from '../types';
import { StatusBadge, PriorityBadge } from './Badge';
import {
  Search,
  Filter,
  Eye,
  Edit2,
  CheckCircle,
  HelpCircle,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  users: User[];
  isAllTasksView: boolean;
  onSelectTask: (task: Task) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onCreateTask?: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  users,
  isAllTasksView,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onCreateTask,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);
  const [onlyNeedHelp, setOnlyNeedHelp] = useState<boolean>(false);

  // Extract unique categories from tasks
  const categories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matches =
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.assignedToName && t.assignedToName.toLowerCase().includes(q)) ||
          t.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
        return false;
      }

      // Employee
      if (employeeFilter !== 'ALL' && t.assignedTo !== employeeFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) {
        return false;
      }

      // Overdue
      if (onlyOverdue && !t.isOverdue) {
        return false;
      }

      // Need Help
      if (onlyNeedHelp && !t.needHelp) {
        return false;
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter, employeeFilter, categoryFilter, onlyOverdue, onlyNeedHelp]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setEmployeeFilter('ALL');
    setCategoryFilter('ALL');
    setOnlyOverdue(false);
    setOnlyNeedHelp(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, ID, employee, category..."
              className="block w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Overdue quick toggle */}
            <button
              onClick={() => setOnlyOverdue(!onlyOverdue)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                onlyOverdue
                  ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span>Overdue Only</span>
            </button>

            {/* Need Help toggle */}
            <button
              onClick={() => setOnlyNeedHelp(!onlyNeedHelp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                onlyNeedHelp
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Help Requests</span>
            </button>

            {(searchTerm ||
              statusFilter !== 'ALL' ||
              priorityFilter !== 'ALL' ||
              employeeFilter !== 'ALL' ||
              categoryFilter !== 'ALL' ||
              onlyOverdue ||
              onlyNeedHelp) && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
                title="Reset filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            {onCreateTask && (
              <button
                onClick={onCreateTask}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ml-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completion Requested">Completion Requested</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Priority Filter
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {isAllTasksView && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Employee Filter
              </label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">All Employees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Category Filter
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isAllTasksView ? 'Office Tasks Repository' : 'My Assigned Tasks'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Click any row or &ldquo;View&rdquo; to open full task details & workflow
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-slate-500 px-4">
            <p className="text-sm font-semibold text-slate-700">No tasks match your filter criteria</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search terms or click &ldquo;Reset&rdquo; to view all tasks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold tracking-wider uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Task ID</th>
                  <th className="py-3 px-4">Title & Category</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Expected</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Task ID */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                      <span className="text-indigo-600 font-bold group-hover:underline">{task.id}</span>
                      {task.needHelp && (
                        <div className="mt-0.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            NEED HELP
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Title & Category */}
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{task.category}</p>
                    </td>

                    {/* Assigned To */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                          {task.assignedToName?.charAt(0) || 'U'}
                        </div>
                        <span className="font-medium text-slate-800">{task.assignedToName}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <PriorityBadge priority={task.priority} />
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                    </td>

                    {/* Progress */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="w-24">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-0.5">
                          <span>{task.progress}%</span>
                          {task.progress === 100 && (
                            <span className="text-purple-600 font-bold">100%</span>
                          )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              task.status === 'Completed'
                                ? 'bg-emerald-500'
                                : task.progress === 100
                                ? 'bg-purple-600'
                                : task.progress > 0
                                ? 'bg-indigo-600'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Deadline */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          task.isOverdue ? 'text-red-600 font-bold' : 'text-slate-700'
                        }`}
                      >
                        {task.deadline}
                      </span>
                    </td>

                    {/* Expected Completion */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {task.expectedCompletionDate || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div
                        className="inline-flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onSelectTask(task)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {onEditTask && (
                          <button
                            onClick={() => onEditTask(task)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            onClick={() => onDeleteTask(task)}
                            className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Delete task (Admin only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
