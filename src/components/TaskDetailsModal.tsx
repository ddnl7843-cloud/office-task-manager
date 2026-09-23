/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskComment, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { StatusBadge, PriorityBadge, ApprovalBadge, RoleBadge } from './Badge';
import {
  X,
  Calendar,
  User as UserIcon,
  CheckCircle,
  HelpCircle,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShieldCheck,
  Edit,
  ArrowRight,
  Trash2,
} from 'lucide-react';

interface TaskDetailsModalProps {
  taskId: string;
  users: User[];
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onOpenEdit?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  taskId,
  users,
  onClose,
  onTaskUpdated,
  onOpenEdit,
  onDeleteTask,
}) => {
  const { user, isAdmin, hasPermission } = useAuth();
  const [task, setTask] = useState<(Task & { comments: TaskComment[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress update state
  const [progressInput, setProgressInput] = useState<number>(0);
  const [statusInput, setStatusInput] = useState<string>('');
  const [expectedDateInput, setExpectedDateInput] = useState<string>('');
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // Help Request state
  const [showHelpForm, setShowHelpForm] = useState(false);
  const [problemDescription, setProblemDescription] = useState('');
  const [helpFromUser, setHelpFromUser] = useState('');
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);

  // Review (Approve/Reject) state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Completion request state
  const [isRequestingCompletion, setIsRequestingCompletion] = useState(false);

  // Fetch task data
  const loadTask = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getTask(taskId);
      setTask(data);
      setProgressInput(data.progress);
      setStatusInput(data.status);
      setExpectedDateInput(data.expectedCompletionDate || data.deadline);
      setHelpFromUser(data.approver);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">Unable to Open Task</h3>
          <p className="text-xs text-rose-700 mt-1">{error || 'Task not found'}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isAssignee = user?.id === task.assignedTo;
  const isApprover = user?.id === task.approver;
  const canReview = (isApprover || isAdmin) && task.status === 'Completion Requested';
  const canUpdateProgress = isAssignee || isAdmin;

  // Handle Progress and Status update
  const handleSaveProgress = async () => {
    setIsUpdatingProgress(true);
    setError(null);
    try {
      const res = await api.updateTask(task.id, {
        progress: progressInput,
        status: statusInput as any,
        expectedCompletionDate: expectedDateInput,
      });
      setTask({ ...task, ...res.task });
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Handle Help Request
  const handleSubmitHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim()) return;
    setIsSubmittingHelp(true);
    setError(null);
    try {
      const res = await api.requestHelp(task.id, problemDescription, helpFromUser);
      setTask({ ...task, ...res.task });
      setShowHelpForm(false);
      setProblemDescription('');
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit help request');
    } finally {
      setIsSubmittingHelp(false);
    }
  };

  // Handle Clear Help Request
  const handleClearHelp = async () => {
    try {
      const res = await api.clearHelp(task.id);
      setTask({ ...task, ...res.task });
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clear help request');
    }
  };

  // Handle Request Completion (Only at 100%)
  const handleRequestCompletion = async () => {
    if (task.progress < 100) {
      setError('Progress must reach 100% before requesting completion');
      return;
    }
    setIsRequestingCompletion(true);
    setError(null);
    try {
      const res = await api.requestCompletion(task.id);
      setTask({ ...task, ...res.task });
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request completion');
    } finally {
      setIsRequestingCompletion(false);
    }
  };

  // Handle Approve
  const handleApprove = async () => {
    setIsSubmittingReview(true);
    setError(null);
    try {
      const res = await api.reviewTask(task.id, 'approve', approvalComment);
      setTask({ ...task, ...res.task });
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve task');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!approvalComment.trim()) {
      setError('Please provide a reason / comment explaining the rejection');
      return;
    }
    setIsSubmittingReview(true);
    setError(null);
    try {
      const res = await api.reviewTask(task.id, 'reject', approvalComment);
      setTask({ ...task, ...res.task });
      setShowRejectForm(false);
      setApprovalComment('');
      onTaskUpdated(res.task);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject task');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const newComment = await api.addComment(task.id, commentText);
      setTask({
        ...task,
        comments: [...(task.comments || []), newComment],
      });
      setCommentText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.deleteComment(task.id, commentId);
      setTask({
        ...task,
        comments: task.comments.filter((c) => c.id !== commentId),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto text-slate-800">
        {/* Modal Top Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {task.id}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                {task.category}
              </span>
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} isOverdue={task.isOverdue} />
              <ApprovalBadge approvalStatus={task.approvalStatus} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{task.title}</h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && onOpenEdit && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEdit(task);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit Task</span>
              </button>
            )}
            {hasPermission('DELETE_TASK') && (
              <button
                onClick={() => {
                  if (onDeleteTask) {
                    onDeleteTask(task);
                  } else {
                    if (confirm(`Permanently delete task "${task.title}" (${task.id})?`)) {
                      api.deleteTask(task.id).then(() => onClose());
                    }
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 transition-colors"
                title="Delete Task (Admin only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error message if present */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Help Request Banner if Active */}
          {task.needHelp && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Active Help Request
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    <strong>Problem:</strong> {task.problemDescription || 'Team member requested assistance'}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Assistance requested from: <strong>{task.helpFromName || 'Approver / Admin'}</strong>
                  </p>
                </div>
              </div>
              {(isAssignee || isAdmin) && (
                <button
                  onClick={handleClearHelp}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors self-start sm:self-center"
                >
                  Clear Help Request
                </button>
              )}
            </div>
          )}

          {/* Pending Approval Banner if current user is Approver or Admin */}
          {canReview && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-300 text-purple-950 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                      Approval Required &bull; Task at 100% Progress
                    </h4>
                    <p className="text-xs text-purple-800 mt-0.5">
                      {task.assignedToName} has submitted this task for your final sign-off.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {!showRejectForm ? (
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-purple-200">
                  <button
                    onClick={handleApprove}
                    disabled={isSubmittingReview}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve as Completed</span>
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={isSubmittingReview}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject & Request Changes</span>
                  </button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-purple-200 space-y-2">
                  <label className="block text-xs font-semibold text-rose-900">
                    Reason for Rejection (Required):
                  </label>
                  <textarea
                    rows={2}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Specify what work remains incomplete or needs revision..."
                    className="w-full text-xs p-2.5 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReject}
                      disabled={isSubmittingReview || !approvalComment.trim()}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rejection comment notification if task is Rejected */}
          {task.status === 'Rejected' && task.approvalComment && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Approver Feedback &bull; Revision Needed
              </h4>
              <p className="text-xs text-rose-700 mt-1">&ldquo;{task.approvalComment}&rdquo;</p>
              <p className="text-[11px] text-slate-500 mt-2">
                Employee can update progress, make modifications, and resubmit for approval once completed.
              </p>
            </div>
          )}

          {/* Task Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Assigned Employee
              </span>
              <p className="font-bold text-slate-900 mt-0.5">{task.assignedToName}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Designated Approver
              </span>
              <p className="font-bold text-slate-900 mt-0.5">{task.approverName}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Start Date
              </span>
              <p className="font-medium text-slate-800 mt-0.5">{task.startDate}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Deadline
              </span>
              <p className={`font-bold mt-0.5 ${task.isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                {task.deadline} {task.isOverdue && '(OVERDUE)'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Expected Completion
              </span>
              <p className="font-medium text-slate-800 mt-0.5">
                {task.expectedCompletionDate || task.deadline}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Created By
              </span>
              <p className="font-medium text-slate-800 mt-0.5">{task.createdByName}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Created At
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {new Date(task.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Last Updated
              </span>
              <p className="font-medium text-slate-600 mt-0.5">
                {new Date(task.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5">
              Task Description
            </h3>
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {task.description || 'No detailed description provided.'}
            </div>
          </div>

          {/* Progress & Status Management Section */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Task Progress & Workflow Status
                </h3>
                <p className="text-[11px] text-slate-500">
                  Update your completion percentage and status
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-indigo-700">{progressInput}%</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  progressInput === 100
                    ? 'bg-purple-600'
                    : progressInput > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${progressInput}%` }}
              />
            </div>

            {/* Slider & Quick percentage buttons (for Employee or Admin) */}
            {canUpdateProgress && task.status !== 'Completed' && task.status !== 'Cancelled' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={progressInput}
                    onChange={(e) => setProgressInput(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">Quick Set:</span>
                  {[0, 25, 50, 75, 90, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setProgressInput(pct)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors ${
                        progressInput === pct
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {/* Additional status selector & expected date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Status Selection
                    </label>
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    >
                      {isAdmin ? (
                        <>
                          <option value="Not Started">Not Started</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Completion Requested">Completion Requested</option>
                          <option value="Completed">Completed</option>
                          <option value="Rejected">Rejected</option>
                          <option value="Cancelled">Cancelled</option>
                        </>
                      ) : (
                        <>
                          <option value="In Progress">In Progress</option>
                          <option value="On Hold">On Hold</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Expected Completion Date
                    </label>
                    <input
                      type="date"
                      value={expectedDateInput}
                      onChange={(e) => setExpectedDateInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleSaveProgress}
                    disabled={isUpdatingProgress}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isUpdatingProgress ? 'Saving...' : 'Update Progress & Status'}
                  </button>

                  {/* 100% Completion Request Button */}
                  {task.progress === 100 &&
                    task.status !== 'Completion Requested' && (
                      <button
                        onClick={handleRequestCompletion}
                        disabled={isRequestingCompletion}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 animate-pulse"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Request Completion Approval</span>
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Help Request Section */}
          {!task.needHelp && isAssignee && task.status !== 'Completed' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {!showHelpForm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Facing a Blocker?</h4>
                    <p className="text-[11px] text-slate-500">
                      Request help from your team lead or a colleague
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHelpForm(true)}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Need Help</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitHelp} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-600" />
                      Submit Help Request
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowHelpForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                      Problem Description (Required)
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      placeholder="Describe the issue, missing access, or guidance required..."
                      className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                      Request Assistance From
                    </label>
                    <select
                      value={helpFromUser}
                      onChange={(e) => setHelpFromUser(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-900"
                    >
                      <option value={task.approver}>Approver: {task.approverName}</option>
                      {users
                        .filter((u) => u.id !== user?.id && u.id !== task.approver)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingHelp || !problemDescription.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {isSubmittingHelp ? 'Submitting...' : 'Submit Help Request'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Comments Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <span>Task Comments & Discussion ({task.comments?.length || 0})</span>
              </h3>
            </div>

            {/* Comment list */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {!task.comments || task.comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
                  No comments yet. Post an update or ask a question below.
                </p>
              ) : (
                task.comments.map((comm) => (
                  <div
                    key={comm.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{comm.userName}</span>
                        <RoleBadge role={comm.userRole} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {new Date(comm.createdAt).toLocaleString()}
                        </span>
                        {(isAdmin || user?.id === comm.userId) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comm.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{comm.comment}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment form */}
            {hasPermission('ADD_COMMENT') && (
              <form onSubmit={handleAddComment} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment or status note..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentText.trim()}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">PaisaFin Office Task Manager</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
