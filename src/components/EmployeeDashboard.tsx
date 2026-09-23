/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task } from '../types';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, PriorityBadge } from './Badge';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
  HelpCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface EmployeeDashboardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onNavigateToTab: (tab: any) => void;
  onQuickProgressUpdate: (task: Task, newProgress: number) => Promise<void>;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  tasks,
  onSelectTask,
  onNavigateToTab,
}) => {
  const { user } = useAuth();

  // Employee only sees tasks assigned to them
  const myTasks = tasks.filter((t) => t.assignedTo === user?.id);

  // Tasks where this employee is designated as Approver
  const approverTasks = tasks.filter((t) => t.approver === user?.id && t.assignedTo !== user?.id);
  const pendingApproverTasks = approverTasks.filter(
    (t) => t.status === 'Completion Requested' || t.approvalStatus === 'Pending'
  );

  const total = myTasks.length;
  const notStarted = myTasks.filter((t) => t.status === 'Not Started' || t.status === 'Assigned').length;
  const inProgress = myTasks.filter((t) => t.status === 'In Progress').length;
  const onHold = myTasks.filter((t) => t.status === 'On Hold').length;
  const completionRequested = myTasks.filter((t) => t.status === 'Completion Requested').length;
  const completed = myTasks.filter((t) => t.status === 'Completed').length;
  const overdue = myTasks.filter((t) => t.isOverdue).length;

  // Tasks requiring immediate attention: Overdue, Rejected, or Need Help
  const attentionTasks = myTasks.filter(
    (t) => (t.isOverdue || t.status === 'Rejected' || t.needHelp) && t.status !== 'Completed' && t.status !== 'Cancelled'
  );

  // Active tasks currently in flow
  const activeTasks = myTasks.filter(
    (t) => t.status !== 'Completed' && t.status !== 'Cancelled'
  );

  // Upcoming deadlines
  const upcomingDeadlines = [...activeTasks]
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome greeting banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
            Employee Workspace
          </span>
          <h2 className="text-xl font-bold mt-0.5">Welcome back, {user?.name}</h2>
          <p className="text-xs text-slate-300 mt-1">
            You currently have <strong className="text-white">{activeTasks.length} active</strong> assigned{' '}
            {activeTasks.length === 1 ? 'task' : 'tasks'} to work on.
            {approverTasks.length > 0 && (
              <span className="ml-1 text-purple-300">
                You are also the Designated Approver for <strong className="text-white">{approverTasks.length}</strong> team {approverTasks.length === 1 ? 'task' : 'tasks'}.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => onNavigateToTab('my_tasks')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>View My Tasks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          {approverTasks.length > 0 && (
            <button
              onClick={() => onNavigateToTab('pending_approvals')}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Approver Desk ({pendingApproverTasks.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Urgent Approver Alert if employees have submitted work for your review */}
      {pendingApproverTasks.length > 0 && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-300 text-purple-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Action Required: {pendingApproverTasks.length} {pendingApproverTasks.length === 1 ? 'Task Awaiting' : 'Tasks Awaiting'} Your Official Approval
              </h4>
              <p className="text-xs text-purple-800 mt-0.5">
                You are designated as the Approver. An employee has submitted 100% completed work for your sign-off.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('pending_approvals')}
            className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-center flex-shrink-0"
          >
            <span>Review &amp; Sign-off</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Rejection / Resubmission alert */}
      {myTasks.some((t) => t.status === 'Rejected') && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Task Completion Rejected &bull; Action Required
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              One or more tasks were rejected during review. Click to inspect approver comments, adjust work, and resubmit.
            </p>
          </div>
          <button
            onClick={() => {
              const rejectedTask = myTasks.find((t) => t.status === 'Rejected');
              if (rejectedTask) onSelectTask(rejectedTask);
            }}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg self-center"
          >
            Review Rejection
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            My Task Performance
          </h3>
          <span className="text-xs text-slate-500">Live Task Status</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">My Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Assigned to me</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Not Started</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{notStarted}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">0% progress</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase">In Progress</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{inProgress}</p>
            <p className="text-[10px] text-indigo-500 mt-0.5">1 - 99% progress</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-amber-700 uppercase">On Hold</p>
            <p className="text-2xl font-bold text-amber-800 mt-1">{onHold}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Temporarily paused</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-purple-700 uppercase">Awaiting Approval</p>
            <p className="text-2xl font-bold text-purple-800 mt-1">{completionRequested}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">100% submitted</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase">Completed</p>
            <p className="text-2xl font-bold text-emerald-800 mt-1">{completed}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Approved</p>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-red-300 bg-red-50/40 shadow-2xs">
            <p className="text-[11px] font-semibold text-red-700 uppercase">Overdue</p>
            <p className="text-2xl font-bold text-red-800 mt-1">{overdue}</p>
            <p className="text-[10px] text-red-600 font-semibold mt-0.5">Past deadline</p>
          </div>
        </div>
      </div>

      {/* Priority Attention Tasks */}
      {attentionTasks.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-950">Tasks Requiring Attention</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-200 text-amber-800">
              {attentionTasks.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="bg-white p-3.5 rounded-lg border border-amber-200 hover:border-amber-400 hover:shadow-xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-mono text-slate-500 font-medium">{task.id}</span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{task.title}</h4>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                    {task.needHelp && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Help Requested
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Deadline: <strong className="text-slate-800">{task.deadline}</strong></span>
                  <span className="font-semibold text-indigo-600 flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Bottom Section: Active Tasks List + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tasks with Progress */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">My Active Assigned Tasks</h3>
            </div>
            <button
              onClick={() => onNavigateToTab('my_tasks')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Manage in Table
            </button>
          </div>

          {activeTasks.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-800">You are all caught up!</p>
              <p className="text-xs text-slate-500 mt-0.5">No active pending tasks assigned to you right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className="py-3 hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">{task.id}</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {task.category}
                        </span>
                        <PriorityBadge priority={task.priority} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 mt-1">{task.title}</h4>
                    </div>
                    <StatusBadge status={task.status} isOverdue={task.isOverdue} />
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex justify-between items-center text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">Work Progress</span>
                      <span className="font-bold text-indigo-700">{task.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          task.progress === 100
                            ? 'bg-purple-600'
                            : task.progress > 0
                            ? 'bg-indigo-600'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Approver: <strong className="text-slate-700">{task.approverName}</strong></span>
                    <span>Due: <strong className={task.isOverdue ? 'text-red-600 font-bold' : 'text-slate-800'}>{task.deadline}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines Side Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Upcoming Deadlines</h3>
            </div>
            <span className="text-xs text-slate-400">Nearest first</span>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No upcoming deadlines</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingDeadlines.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer hover:shadow-xs transition-all ${
                    task.isOverdue
                      ? 'bg-red-50/60 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <p className="font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className={task.isOverdue ? 'text-red-700 font-bold' : 'text-slate-600'}>
                      Due: {task.deadline}
                    </span>
                    <span className="font-semibold text-indigo-600">{task.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
            <p className="font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              Workflow Tip
            </p>
            <p className="mt-1 text-[11px] text-indigo-700 leading-relaxed">
              When your progress reaches 100%, click &ldquo;Request Completion&rdquo; to submit the task to your approver for final sign-off.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
