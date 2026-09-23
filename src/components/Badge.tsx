/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TaskStatus, TaskPriority, ApprovalStatus, UserRole } from '../types';

export const StatusBadge: React.FC<{ status: TaskStatus; isOverdue?: boolean; className?: string }> = ({
  status,
  isOverdue,
  className = '',
}) => {
  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (status) {
    case 'Not Started':
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
      dotColor = 'bg-slate-400';
      break;
    case 'Assigned':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotColor = 'bg-blue-500';
      break;
    case 'In Progress':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      dotColor = 'bg-indigo-500 animate-pulse';
      break;
    case 'On Hold':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotColor = 'bg-amber-500';
      break;
    case 'Completion Requested':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      dotColor = 'bg-purple-500';
      break;
    case 'Completed':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotColor = 'bg-emerald-500';
      break;
    case 'Rejected':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotColor = 'bg-rose-500';
      break;
    case 'Cancelled':
      colorClasses = 'bg-gray-100 text-gray-500 border-gray-200 line-through';
      dotColor = 'bg-gray-400';
      break;
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span>{status}</span>
      </span>
      {isOverdue && status !== 'Completed' && status !== 'Cancelled' && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300">
          OVERDUE
        </span>
      )}
    </div>
  );
};

export const PriorityBadge: React.FC<{ priority: TaskPriority; className?: string }> = ({
  priority,
  className = '',
}) => {
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  switch (priority) {
    case 'Low':
      color = 'bg-slate-100 text-slate-700 border-slate-200';
      break;
    case 'Medium':
      color = 'bg-blue-50 text-blue-700 border-blue-200';
      break;
    case 'High':
      color = 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
      break;
    case 'Urgent':
      color = 'bg-red-50 text-red-700 border-red-300 font-bold';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs border ${color} ${className}`}>
      {priority}
    </span>
  );
};

export const ApprovalBadge: React.FC<{ approvalStatus: ApprovalStatus }> = ({ approvalStatus }) => {
  if (approvalStatus === 'None') return null;

  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  if (approvalStatus === 'Pending') color = 'bg-amber-50 text-amber-800 border-amber-300';
  if (approvalStatus === 'Approved') color = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  if (approvalStatus === 'Rejected') color = 'bg-rose-50 text-rose-800 border-rose-300';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      Approval: {approvalStatus}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
        role === 'ADMIN' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
      }`}
    >
      {role}
    </span>
  );
};
