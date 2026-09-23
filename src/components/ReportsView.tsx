/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Task, User } from '../types';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface ReportsViewProps {
  tasks: Task[];
  users: User[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ tasks, users }) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (startDate && t.startDate < startDate) return false;
      if (endDate && t.deadline > endDate) return false;
      if (selectedUser !== 'ALL' && t.assignedTo !== selectedUser) return false;
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
      return true;
    });
  }, [tasks, startDate, endDate, selectedUser, selectedCategory]);

  const total = filteredTasks.length;
  const completed = filteredTasks.filter((t) => t.status === 'Completed').length;
  const overdue = filteredTasks.filter((t) => t.isOverdue).length;
  const inProgress = filteredTasks.filter((t) => t.status === 'In Progress').length;
  const needApproval = filteredTasks.filter((t) => t.status === 'Completion Requested').length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

  // Export to CSV functionality
  const handleExportCSV = () => {
    const headers = [
      'Task ID',
      'Title',
      'Category',
      'Priority',
      'Status',
      'Progress',
      'Assigned To',
      'Approver',
      'Start Date',
      'Deadline',
      'Expected Completion',
      'Overdue',
      'Need Help',
      'Approval Status',
      'Created At',
    ];

    const rows = filteredTasks.map((t) => [
      `"${t.id}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.progress}%"`,
      `"${t.assignedToName || t.assignedTo}"`,
      `"${t.approverName || t.approver}"`,
      `"${t.startDate}"`,
      `"${t.deadline}"`,
      `"${t.expectedCompletionDate || ''}"`,
      `"${t.isOverdue ? 'YES' : 'NO'}"`,
      `"${t.needHelp ? 'YES' : 'NO'}"`,
      `"${t.approvalStatus}"`,
      `"${t.createdAt}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `office_tasks_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Export */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Office Task Analytics & Reports</h2>
            <p className="text-xs text-slate-500">
              Generate work reports, measure employee delivery timelines, and export CSV spreadsheets
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors self-start sm:self-auto shadow-2xs"
        >
          <Download className="w-4 h-4" />
          <span>Export Filtered to CSV</span>
        </button>
      </div>

      {/* Filter Options */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
          Report Filter Parameters
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-medium mb-1">From Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">To Deadline</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Filter by Staff Member</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value="ALL">All Team Members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Filter by Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value="ALL">All Categories</option>
              <option value="Operations">Operations</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
              <option value="Documentation">Documentation</option>
              <option value="IT">IT</option>
              <option value="Customer Support">Customer Support</option>
              <option value="HR">HR</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Filtered Tasks</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Matching criteria</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <p className="text-[11px] font-semibold text-emerald-700 uppercase">Completion Rate</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{completionRate}%</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">{completed} tasks signed off</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <p className="text-[11px] font-semibold text-indigo-700 uppercase">Active In-Progress</p>
          <p className="text-2xl font-bold text-indigo-800 mt-1">{inProgress + needApproval}</p>
          <p className="text-[10px] text-indigo-600 mt-0.5">{needApproval} awaiting review</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-2xs">
          <p className="text-[11px] font-semibold text-red-700 uppercase">Overdue Rate</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{overdueRate}%</p>
          <p className="text-[10px] text-red-600 mt-0.5">{overdue} tasks past deadline</p>
        </div>
      </div>

      {/* Team Member Workload & Delivery Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Staff Workload & Performance Distribution
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Total Tasks</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4">In Progress</th>
                <th className="py-3 px-4">Overdue</th>
                <th className="py-3 px-4">Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const userTasks = filteredTasks.filter((t) => t.assignedTo === u.id);
                const userCompleted = userTasks.filter((t) => t.status === 'Completed').length;
                const userActive = userTasks.filter((t) => t.status === 'In Progress').length;
                const userOverdue = userTasks.filter((t) => t.isOverdue).length;
                const userRate =
                  userTasks.length > 0 ? Math.round((userCompleted / userTasks.length) * 100) : 0;

                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.name} <span className="text-[10px] text-slate-400 font-normal">({u.role})</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{userTasks.length}</td>
                    <td className="py-3 px-4 text-emerald-600 font-semibold">{userCompleted}</td>
                    <td className="py-3 px-4 text-indigo-600">{userActive}</td>
                    <td className="py-3 px-4">
                      {userOverdue > 0 ? (
                        <span className="font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-50">
                          {userOverdue}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 w-8">{userRate}%</span>
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${userRate}%` }}
                          />
                        </div>
                      </div>
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
