/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, User } from '../types';
import { StatusBadge, PriorityBadge } from './Badge';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  AlertCircle,
  XCircle,
  Users,
  Calendar,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface AdminDashboardProps {
  tasks: Task[];
  users: User[];
  onSelectTask: (task: Task) => void;
  onNavigateToTab: (tab: any) => void;
  onFilterStatus?: (status: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tasks,
  users,
  onSelectTask,
  onNavigateToTab,
}) => {
  const totalTasks = tasks.length;
  const notStarted = tasks.filter((t) => t.status === 'Not Started').length;
  const assigned = tasks.filter((t) => t.status === 'Assigned').length;
  const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
  const onHold = tasks.filter((t) => t.status === 'On Hold').length;
  const completionRequested = tasks.filter((t) => t.status === 'Completion Requested').length;
  const completed = tasks.filter((t) => t.status === 'Completed').length;
  const rejected = tasks.filter((t) => t.status === 'Rejected').length;
  const overdueTasks = tasks.filter((t) => t.isOverdue);
  const helpRequestedTasks = tasks.filter((t) => t.needHelp && t.status !== 'Completed');

  // Priority counts
  const urgentCount = tasks.filter((t) => t.priority === 'Urgent').length;
  const highCount = tasks.filter((t) => t.priority === 'High').length;
  const medCount = tasks.filter((t) => t.priority === 'Medium').length;
  const lowCount = tasks.filter((t) => t.priority === 'Low').length;

  // Pending approvals
  const pendingApprovals = tasks.filter((t) => t.status === 'Completion Requested');

  // Recently created tasks (last 5)
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Upcoming deadlines (next 7 days, active)
  const upcomingDeadlines = tasks
    .filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Pending Approvals Alert Banner */}
      {completionRequested > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
              {completionRequested}
            </div>
            <div>
              <h3 className="text-sm font-bold text-purple-950">Pending Completion Approvals</h3>
              <p className="text-xs text-purple-700">
                {completionRequested} {completionRequested === 1 ? 'task has' : 'tasks have'} reached 100% and await your review.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('pending_approvals')}
            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg self-start sm:self-auto transition-colors flex items-center gap-1.5"
          >
            <span>Review Approvals</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Help Requests Alert Banner */}
      {helpRequestedTasks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              {helpRequestedTasks.length}
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">Staff Help Requests Active</h3>
              <p className="text-xs text-amber-700">
                Team members have marked tasks with &ldquo;Need Help&rdquo;. Prompt review recommended.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('all_tasks')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg self-start sm:self-auto transition-colors flex items-center gap-1.5"
          >
            <span>View Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Metrics Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Office Task Overview
          </h2>
          <span className="text-xs text-slate-500">Live Team Metrics</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Tasks</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalTasks}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">All created</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Not Started</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{notStarted + assigned}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Queued / Assigned</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase">In Progress</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{inProgress}</p>
            <p className="text-[10px] text-indigo-500 mt-0.5">Active work</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-amber-700 uppercase">On Hold</p>
            <p className="text-2xl font-bold text-amber-800 mt-1">{onHold}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Paused</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-purple-700 uppercase">Need Approval</p>
            <p className="text-2xl font-bold text-purple-800 mt-1">{completionRequested}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">At 100%</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase">Completed</p>
            <p className="text-2xl font-bold text-emerald-800 mt-1">{completed}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {totalTasks > 0 ? `${Math.round((completed / totalTasks) * 100)}% done` : '0%'}
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-rose-700 uppercase">Rejected</p>
            <p className="text-2xl font-bold text-rose-800 mt-1">{rejected}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">Needs work</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-red-300 bg-red-50/40 shadow-2xs">
            <p className="text-[11px] font-semibold text-red-700 uppercase">Overdue</p>
            <p className="text-2xl font-bold text-red-800 mt-1">{overdueTasks.length}</p>
            <p className="text-[10px] text-red-600 font-semibold mt-0.5">Past deadline</p>
          </div>
        </div>
      </div>

      {/* Middle Grid: Employee Breakdown + Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks by Employee */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Tasks By Team Member</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('all_tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View Full Table
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Total Assigned</th>
                  <th className="py-2.5 px-3">In Progress</th>
                  <th className="py-2.5 px-3">Completed</th>
                  <th className="py-2.5 px-3">Overdue</th>
                  <th className="py-2.5 px-3">Workload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const userTasks = tasks.filter((t) => t.assignedTo === u.id);
                  const userCompleted = userTasks.filter((t) => t.status === 'Completed').length;
                  const userActive = userTasks.filter((t) => t.status === 'In Progress').length;
                  const userOverdue = userTasks.filter((t) => t.isOverdue).length;
                  const completionRate =
                    userTasks.length > 0 ? Math.round((userCompleted / userTasks.length) * 100) : 0;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{u.name}</p>
                          <p className="text-[10px] text-slate-400">{u.role}</p>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{userTasks.length}</td>
                      <td className="py-2.5 px-3 text-indigo-600 font-medium">{userActive}</td>
                      <td className="py-2.5 px-3 text-emerald-600 font-medium">{userCompleted}</td>
                      <td className="py-2.5 px-3">
                        {userOverdue > 0 ? (
                          <span className="font-bold text-red-600 px-1.5 py-0.5 rounded bg-red-50 border border-red-200">
                            {userOverdue}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${Math.min(userTasks.length * 20, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority & Status Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Priority Distribution</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span className="text-red-700 font-bold">Urgent</span>
                  <span>{urgentCount} ({totalTasks > 0 ? Math.round((urgentCount / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${totalTasks > 0 ? (urgentCount / totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span className="text-amber-700 font-semibold">High</span>
                  <span>{highCount} ({totalTasks > 0 ? Math.round((highCount / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{ width: `${totalTasks > 0 ? (highCount / totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span className="text-blue-700">Medium</span>
                  <span>{medCount} ({totalTasks > 0 ? Math.round((medCount / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${totalTasks > 0 ? (medCount / totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-700 mb-1">
                  <span className="text-slate-600">Low</span>
                  <span>{lowCount} ({totalTasks > 0 ? Math.round((lowCount / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-slate-400 h-2 rounded-full"
                    style={{ width: `${totalTasks > 0 ? (lowCount / totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Workplace Status Health
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] text-emerald-700 font-medium">Completion Rate</p>
                <p className="text-lg font-bold text-emerald-900">
                  {totalTasks > 0 ? `${Math.round((completed / totalTasks) * 100)}%` : '0%'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                <p className="text-[10px] text-indigo-700 font-medium">Active In Flow</p>
                <p className="text-lg font-bold text-indigo-900">{inProgress + completionRequested}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Upcoming Deadlines + Recently Created Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h3>
            </div>
            <span className="text-xs text-slate-500">Sorted by due date</span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No upcoming deadlines scheduled</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingDeadlines.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-semibold text-slate-900 truncate">{task.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Assigned to {task.assignedToName} &bull; {task.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        task.isOverdue
                          ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {task.deadline}
                    </span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Created Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Recently Created Tasks</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('all_tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              All Tasks
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No tasks created yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 p-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-semibold text-slate-900 truncate">{task.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {task.category} &bull; Assigned to {task.assignedToName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
