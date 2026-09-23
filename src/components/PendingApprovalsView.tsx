/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Task } from '../types';
import { api } from '../api';
import { PriorityBadge } from './Badge';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  Clock,
  User as UserIcon,
} from 'lucide-react';

interface PendingApprovalsViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onTaskUpdated: (updatedTask: Task) => void;
}

export const PendingApprovalsView: React.FC<PendingApprovalsViewProps> = ({
  tasks,
  onSelectTask,
  onTaskUpdated,
}) => {
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter pending approvals
  const pendingTasks = tasks.filter(
    (t) => t.status === 'Completion Requested' || t.approvalStatus === 'Pending'
  );

  const handleApprove = async (task: Task) => {
    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await api.reviewTask(task.id, 'approve', 'Approved by approver');
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve task');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async (task: Task) => {
    if (!rejectComment.trim()) {
      setActionError('Approval rejection comment / reason is required');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await api.reviewTask(task.id, 'reject', rejectComment.trim());
      onTaskUpdated(res.task);
      setRejectingTaskId(null);
      setRejectComment('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject task');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Task Completion Approvals</h2>
            <p className="text-xs text-slate-500">
              Tasks reached 100% progress and submitted by employees for final verification
            </p>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {pendingTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-2xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
          <h3 className="text-sm font-bold text-slate-900">No Pending Approvals</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            All submitted tasks have been reviewed. When an employee reaches 100% and clicks &ldquo;Request Completion&rdquo;, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {pendingTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-purple-200 p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {task.id}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {task.category}
                  </span>
                  <PriorityBadge priority={task.priority} />
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                    Progress: 100%
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                  <span>
                    Employee: <strong className="text-slate-800">{task.assignedToName}</strong>
                  </span>
                  <span>
                    Approver: <strong className="text-slate-800">{task.approverName}</strong>
                  </span>
                  <span>
                    Deadline: <strong className="text-slate-800">{task.deadline}</strong>
                  </span>
                  {task.completionRequestedAt && (
                    <span className="text-[11px] text-purple-700">
                      Requested:{' '}
                      {new Date(task.completionRequestedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <button
                  onClick={() => onSelectTask(task)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Details</span>
                </button>

                {rejectingTaskId !== task.id ? (
                  <>
                    <button
                      onClick={() => handleApprove(task)}
                      disabled={isProcessing}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve</span>
                    </button>

                    <button
                      onClick={() => {
                        setRejectingTaskId(task.id);
                        setRejectComment('');
                      }}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <label className="block text-[11px] font-bold text-rose-900">
                      Rejection Reason (Required):
                    </label>
                    <input
                      type="text"
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="e.g. Missing signed document attachment"
                      className="w-full text-xs p-1.5 rounded border border-rose-300 bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectConfirm(task)}
                        disabled={isProcessing || !rejectComment.trim()}
                        className="px-3 py-1 bg-rose-600 text-white text-xs font-semibold rounded disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => setRejectingTaskId(null)}
                        className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
