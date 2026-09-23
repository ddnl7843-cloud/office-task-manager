/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, verifyPassword, hashPassword, ALL_SYSTEM_PERMISSIONS } from './server/db';
import { emailService } from './server/email';
import { Permission, Task, UserRole, TaskStatus } from './src/types';

// Express user augmentation
declare global {
  namespace Express {
    interface Request {
      user?: ReturnType<typeof db.getUserById>;
      permissions?: Permission[];
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Request logger in dev
  app.use((req, res, next) => {
    next();
  });

  // Helper auth middleware
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Session expired or not logged in. Please log in.' });
    }
    const token = authHeader.split(' ')[1];
    const sessionData = db.getSessionUser(token);
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = sessionData.user;
    req.permissions = sessionData.permissions;
    next();
  }

  // Permission check middleware
  function requirePermission(permission: Permission) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.permissions || !req.permissions.includes(permission)) {
        return res.status(403).json({ error: `Permission denied: ${permission} required` });
      }
      next();
    };
  }

  // Overdue check utility
  function isTaskOverdue(task: Task): boolean {
    if (task.status === 'Completed' || task.status === 'Cancelled') {
      return false;
    }
    const now = new Date();
    const deadlineDate = new Date(`${task.deadline}T23:59:59`);
    return now > deadlineDate;
  }

  // -------------------------------------------------------------
  // AUTH ROUTES
  // -------------------------------------------------------------
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.getUserByEmail(email.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact your office administrator.' });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const settings = db.getData().settings;
    const token = db.createSession(user.id, settings.sessionTimeoutMinutes || 480);
    user.lastLoginAt = new Date().toISOString();
    db.save();

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      description: `User logged in from web portal`,
    });

    const permissions = db.getData().rolePermissions[user.role] || [];
    const { passwordHash, salt, ...publicUser } = user;

    res.json({
      token,
      user: publicUser,
      permissions,
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      db.revokeSession(token);
    }
    if (req.user) {
      db.logActivity({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'LOGOUT',
        description: `User logged out`,
      });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const { passwordHash, salt, ...publicUser } = req.user;
    res.json({
      user: publicUser,
      permissions: req.permissions,
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    db.save();

    res.json({ success: true, message: 'Password updated successfully' });
  });

  // -------------------------------------------------------------
  // TASKS ROUTES
  // -------------------------------------------------------------
  app.get('/api/tasks', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const permissions = req.permissions || [];
    const hasViewAll = permissions.includes('VIEW_ALL_TASKS') || user.role === 'ADMIN';

    let tasks = db.getData().tasks.map(t => ({
      ...t,
      isOverdue: isTaskOverdue(t),
    }));

    // Filter by ownership if not permitted to view all
    if (!hasViewAll) {
      tasks = tasks.filter(t => t.assignedTo === user.id || t.approver === user.id);
    }

    // Apply query filters
    const { search, status, priority, employee, category, dateFrom, dateTo } = req.query;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      tasks = tasks.filter(
        t =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      tasks = tasks.filter(t => t.status === status);
    }

    if (priority && typeof priority === 'string' && priority !== 'ALL') {
      tasks = tasks.filter(t => t.priority === priority);
    }

    if (employee && typeof employee === 'string' && employee !== 'ALL') {
      tasks = tasks.filter(t => t.assignedTo === employee);
    }

    if (category && typeof category === 'string' && category !== 'ALL') {
      tasks = tasks.filter(t => t.category === category);
    }

    if (dateFrom && typeof dateFrom === 'string') {
      tasks = tasks.filter(t => t.deadline >= dateFrom);
    }

    if (dateTo && typeof dateTo === 'string') {
      tasks = tasks.filter(t => t.deadline <= dateTo);
    }

    // Sort newest first
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(tasks);
  });

  app.get('/api/tasks/:id', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const hasViewAll = req.permissions?.includes('VIEW_ALL_TASKS') || user.role === 'ADMIN';
    if (!hasViewAll && task.assignedTo !== user.id && task.approver !== user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this task' });
    }

    const comments = db.getData().comments.filter(c => c.taskId === task.id);
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json({
      ...task,
      isOverdue: isTaskOverdue(task),
      comments,
    });
  });

  app.post('/api/tasks', requireAuth, requirePermission('CREATE_TASK'), (req: Request, res: Response) => {
    const {
      title,
      description,
      category,
      priority,
      assignedTo,
      approver,
      startDate,
      deadline,
      expectedCompletionDate,
    } = req.body;

    if (!title || !category || !priority || !assignedTo || !approver || !startDate || !deadline) {
      return res.status(400).json({ error: 'All required task fields must be provided' });
    }

    const assignedUser = db.getUserById(assignedTo);
    if (!assignedUser) {
      return res.status(400).json({ error: 'Assigned employee not found' });
    }

    const approverUser = db.getUserById(approver);
    if (!approverUser) {
      return res.status(400).json({ error: 'Approver user not found' });
    }

    const taskId = db.getNextTaskId();
    const now = new Date().toISOString();

    const newTask: Task = {
      id: taskId,
      title: title.trim(),
      description: description ? description.trim() : '',
      category: category.trim(),
      priority,
      createdBy: req.user!.id,
      createdByName: req.user!.name,
      assignedTo: assignedUser.id,
      assignedToName: assignedUser.name,
      approver: approverUser.id,
      approverName: approverUser.name,
      startDate,
      deadline,
      expectedCompletionDate: expectedCompletionDate || deadline,
      status: 'Assigned',
      progress: 0,
      needHelp: false,
      approvalStatus: 'None',
      createdAt: now,
      updatedAt: now,
    };

    db.getData().tasks.unshift(newTask);

    // Notify assigned employee
    db.addNotification({
      userId: assignedUser.id,
      title: 'New Task Assigned',
      message: `You have been assigned task: "${newTask.title}" with deadline ${newTask.deadline}.`,
      type: 'TASK_ASSIGNED',
      taskId: newTask.id,
    });

    // Notify designated approver if distinct from creator and assignee
    if (approverUser.id !== req.user!.id && approverUser.id !== assignedUser.id) {
      db.addNotification({
        userId: approverUser.id,
        title: 'Designated as Task Approver',
        message: `You have been designated as the Approver for task "${newTask.title}" assigned to ${assignedUser.name}.`,
        type: 'TASK_ASSIGNED',
        taskId: newTask.id,
      });
    }

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'TASK_CREATED',
      taskId: newTask.id,
      taskTitle: newTask.title,
      description: `Task created and assigned to ${assignedUser.name}`,
    });

    // Send email notification via Hostinger Webmail SMTP
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    emailService.sendTaskAssignedEmail(newTask, { name: assignedUser.name, email: assignedUser.email }, appUrl).catch((err) => {
      console.error('Email send failed:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: { ...newTask, isOverdue: isTaskOverdue(newTask) },
    });
  });

  app.put('/api/tasks/:id', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const permissions = req.permissions || [];
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isAdmin = user.role === 'ADMIN' || permissions.includes('EDIT_TASK');
    const isAssignee = task.assignedTo === user.id;

    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: 'Unauthorized to modify this task' });
    }

    const now = new Date().toISOString();
    const previousAssignedTo = task.assignedTo;

    // Handle Employee update vs Admin update
    if (!isAdmin) {
      // Employee restrictions: cannot alter deadline, priority, approver, assignedTo, or approval fields
      const { progress, status, expectedCompletionDate } = req.body;

      if (progress !== undefined) {
        const num = Number(progress);
        if (isNaN(num) || num < 0 || num > 100) {
          return res.status(400).json({ error: 'Progress must be a valid number between 0 and 100' });
        }
        task.progress = num;

        // Auto adjust status based on progress if currently Not Started or In Progress
        if (num === 0 && task.status === 'In Progress') {
          task.status = 'Not Started';
        } else if (num > 0 && num < 100 && (task.status === 'Not Started' || task.status === 'Assigned')) {
          task.status = 'In Progress';
        }
        // Notice rule: 100% does NOT automatically mark as Completed.
      }

      if (status !== undefined) {
        // Employee can only toggle between In Progress and On Hold
        if (status === 'In Progress' || status === 'On Hold') {
          task.status = status;
        }
      }

      if (expectedCompletionDate !== undefined) {
        task.expectedCompletionDate = expectedCompletionDate;
      }

      task.updatedAt = now;
      db.save();

      db.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'TASK_PROGRESS_UPDATED',
        taskId: task.id,
        taskTitle: task.title,
        description: `Updated progress to ${task.progress}%, status: ${task.status}`,
      });

      return res.json({
        success: true,
        message: 'Task updated successfully',
        task: { ...task, isOverdue: isTaskOverdue(task) },
      });
    }

    // Admin full update
    const {
      title,
      description,
      category,
      priority,
      assignedTo,
      approver,
      startDate,
      deadline,
      expectedCompletionDate,
      status,
      progress,
    } = req.body;

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (category) task.category = category.trim();
    if (priority) task.priority = priority;
    if (startDate) task.startDate = startDate;
    if (deadline) task.deadline = deadline;
    if (expectedCompletionDate) task.expectedCompletionDate = expectedCompletionDate;
    if (status) task.status = status;

    if (progress !== undefined) {
      const num = Number(progress);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        task.progress = num;
      }
    }

    if (assignedTo && assignedTo !== task.assignedTo) {
      const newAssignedUser = db.getUserById(assignedTo);
      if (newAssignedUser) {
        task.assignedTo = newAssignedUser.id;
        task.assignedToName = newAssignedUser.name;

        db.addNotification({
          userId: newAssignedUser.id,
          title: 'Task Reassigned',
          message: `Task "${task.title}" has been reassigned to you.`,
          type: 'TASK_REASSIGNED',
          taskId: task.id,
        });

        db.logActivity({
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          action: 'TASK_REASSIGNED',
          taskId: task.id,
          taskTitle: task.title,
          description: `Task reassigned to ${newAssignedUser.name}`,
        });

        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        emailService.sendTaskAssignedEmail(task, { name: newAssignedUser.name, email: newAssignedUser.email }, appUrl).catch((e) => console.error(e));
      }
    }

    if (approver && approver !== task.approver) {
      const newApprover = db.getUserById(approver);
      if (newApprover) {
        task.approver = newApprover.id;
        task.approverName = newApprover.name;
      }
    }

    task.updatedAt = now;
    db.save();

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'TASK_UPDATED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Task details updated by Admin`,
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: { ...task, isOverdue: isTaskOverdue(task) },
    });
  });

  // Help Request workflow
  app.post('/api/tasks/:id/request-help', requireAuth, requirePermission('REQUEST_HELP'), (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { problemDescription, helpFrom } = req.body;
    if (!problemDescription || !problemDescription.trim()) {
      return res.status(400).json({ error: 'Problem description is required for help request' });
    }

    const helperUser = helpFrom ? db.getUserById(helpFrom) : undefined;

    task.needHelp = true;
    task.helpFrom = helperUser ? helperUser.id : task.approver;
    task.helpFromName = helperUser ? helperUser.name : task.approverName;
    task.problemDescription = problemDescription.trim();
    task.updatedAt = new Date().toISOString();
    db.save();

    // Notify helper user
    if (task.helpFrom) {
      db.addNotification({
        userId: task.helpFrom,
        title: 'Help Requested on Task',
        message: `${user.name} requested help on task "${task.title}": ${task.problemDescription}`,
        type: 'HELP_REQUESTED',
        taskId: task.id,
      });
    }

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'TASK_HELP_REQUESTED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Requested help from ${task.helpFromName}: ${task.problemDescription}`,
    });

    // Send Help email via Hostinger Webmail
    if (helperUser) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      emailService.sendHelpRequestEmail(task, user.name, { name: helperUser.name, email: helperUser.email }, task.problemDescription || '', appUrl).catch((e) => console.error(e));
    }

    res.json({
      success: true,
      message: 'Help request submitted successfully',
      task: { ...task, isOverdue: isTaskOverdue(task) },
    });
  });

  app.post('/api/tasks/:id/clear-help', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isHelper = task.helpFrom === user.id;
    const isApprover = task.approver === user.id;
    const isAssignee = task.assignedTo === user.id;
    const isAdmin = user.role === 'ADMIN' || (req.permissions && req.permissions.includes('EDIT_TASK'));

    if (!isHelper && !isApprover && !isAssignee && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to resolve this help request' });
    }

    const { resolutionNote } = req.body;
    const noteText = resolutionNote && typeof resolutionNote === 'string' ? resolutionNote.trim() : '';

    task.needHelp = false;
    task.lastHelpResolution = noteText || 'Obstacle resolved';
    task.problemDescription = undefined;
    task.helpFrom = undefined;
    task.helpFromName = undefined;
    task.updatedAt = new Date().toISOString();
    db.save();

    // Add resolution comment in task discussion
    const resolutionComment = noteText
      ? `✅ [Help Request Resolved]: ${noteText}`
      : `✅ [Help Request Resolved]: Help request closed by ${user.name}.`;

    db.addComment({
      taskId: task.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      comment: resolutionComment,
    });

    // Notify assigned employee if distinct from current user
    if (task.assignedTo !== user.id) {
      db.addNotification({
        userId: task.assignedTo,
        title: 'Help Request Completed & Closed',
        message: `${user.name} has marked your help request on task "${task.title}" as resolved: ${noteText || 'Assistance provided.'}`,
        type: 'HELP_RESOLVED',
        taskId: task.id,
      });
    }

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'TASK_HELP_CLEARED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Help request resolved by ${user.name}. Note: ${noteText || 'Resolved'}`,
    });

    const comments = db.getData().comments.filter(c => c.taskId === task.id);
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json({
      success: true,
      message: 'Help request resolved and closed successfully',
      task: { ...task, isOverdue: isTaskOverdue(task), comments },
    });
  });

  // Completion Request workflow (Requires progress === 100%)
  app.post('/api/tasks/:id/request-completion', requireAuth, requirePermission('REQUEST_COMPLETION'), (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.progress < 100) {
      return res.status(400).json({ error: 'Completion can only be requested when progress reaches 100%' });
    }

    task.status = 'Completion Requested';
    task.approvalStatus = 'Pending';
    task.completionRequestedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    db.save();

    // Notify approver
    db.addNotification({
      userId: task.approver,
      title: 'Task Completion Requested',
      message: `${user.name} has requested completion for "${task.title}". Please review and approve/reject.`,
      type: 'COMPLETION_REQUESTED',
      taskId: task.id,
    });

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'TASK_COMPLETION_REQUESTED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Requested completion approval at 100% progress`,
    });

    // Send email notification to approver
    const approverUser = db.getUserById(task.approver);
    if (approverUser) {
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      emailService.sendCompletionRequestEmail(task, { name: approverUser.name, email: approverUser.email }, appUrl).catch((e) => console.error(e));
    }

    res.json({
      success: true,
      message: 'Completion approval requested successfully',
      task: { ...task, isOverdue: isTaskOverdue(task) },
    });
  });

  // Approver review (Approve or Reject)
  app.post('/api/tasks/:id/review', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const permissions = req.permissions || [];
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const isApprover = task.approver === user.id;
    const isAdmin = user.role === 'ADMIN' || permissions.includes('APPROVE_TASK');

    if (!isApprover && !isAdmin) {
      return res.status(403).json({ error: 'Only the designated approver or an administrator can review this task' });
    }

    if (task.approvalStatus !== 'Pending' && task.status !== 'Completion Requested') {
      return res.status(400).json({ error: 'This task does not have a pending completion request' });
    }

    const { decision, comment } = req.body;
    const now = new Date().toISOString();

    if (decision === 'approve') {
      task.status = 'Completed';
      task.approvalStatus = 'Approved';
      task.approvalComment = comment ? comment.trim() : 'Approved by ' + user.name;
      task.completedAt = now;
      task.updatedAt = now;
      db.save();

      // Notify assignee
      db.addNotification({
        userId: task.assignedTo,
        title: 'Task Approved & Completed',
        message: `Your task "${task.title}" has been approved as completed by ${user.name}.`,
        type: 'TASK_APPROVED',
        taskId: task.id,
      });

      db.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'TASK_APPROVED',
        taskId: task.id,
        taskTitle: task.title,
        description: `Task approved as completed. Comment: ${task.approvalComment}`,
      });

      // Send approval email via Hostinger Webmail
      const assigneeUser = db.getUserById(task.assignedTo);
      if (assigneeUser) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        emailService.sendApprovalDecisionEmail(task, 'approved', { name: assigneeUser.name, email: assigneeUser.email }, user.name, task.approvalComment, appUrl).catch((e) => console.error(e));
      }

      return res.json({
        success: true,
        message: 'Task approved and marked as Completed',
        task: { ...task, isOverdue: isTaskOverdue(task) },
      });
    } else if (decision === 'reject') {
      if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Approval rejection requires a reason / comment' });
      }

      task.status = 'Rejected';
      task.approvalStatus = 'Rejected';
      task.approvalComment = comment.trim();
      task.updatedAt = now;
      db.save();

      // Notify assignee
      db.addNotification({
        userId: task.assignedTo,
        title: 'Task Completion Rejected',
        message: `Task "${task.title}" completion was rejected by ${user.name}. Reason: ${comment.trim()}`,
        type: 'TASK_REJECTED',
        taskId: task.id,
      });

      db.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'TASK_COMPLETION_REJECTED',
        taskId: task.id,
        taskTitle: task.title,
        description: `Task completion rejected. Reason: ${comment.trim()}`,
      });

      // Send rejection/revision email via Hostinger Webmail
      const assigneeUser = db.getUserById(task.assignedTo);
      if (assigneeUser) {
        const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        emailService.sendApprovalDecisionEmail(task, 'rejected', { name: assigneeUser.name, email: assigneeUser.email }, user.name, comment.trim(), appUrl).catch((e) => console.error(e));
      }

      return res.json({
        success: true,
        message: 'Task completion request rejected. Employee can continue work and resubmit.',
        task: { ...task, isOverdue: isTaskOverdue(task) },
      });
    } else {
      return res.status(400).json({ error: 'Invalid decision. Must be "approve" or "reject"' });
    }
  });

  // Comments
  app.get('/api/tasks/:id/comments', requireAuth, (req: Request, res: Response) => {
    const comments = db.getData().comments.filter(c => c.taskId === req.params.id);
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(comments);
  });

  app.post('/api/tasks/:id/comments', requireAuth, requirePermission('ADD_COMMENT'), (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { comment } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty' });
    }

    const newComment = {
      id: `COMM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      taskId: task.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    };

    db.getData().comments.push(newComment);
    task.updatedAt = new Date().toISOString();
    db.save();

    // Notify the other party
    const targetUserId = user.id === task.assignedTo ? task.approver : task.assignedTo;
    if (targetUserId) {
      db.addNotification({
        userId: targetUserId,
        title: 'New Comment on Task',
        message: `${user.name} commented on "${task.title}": "${newComment.comment.slice(0, 60)}..."`,
        type: 'GENERAL',
        taskId: task.id,
      });
    }

    db.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'TASK_COMMENT_ADDED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Added comment: ${newComment.comment.slice(0, 80)}`,
    });

    res.status(201).json(newComment);
  });

  // Admin / Authorized delete task
  app.delete('/api/tasks/:id', requireAuth, requirePermission('DELETE_TASK'), (req: Request, res: Response) => {
    const taskId = req.params.id;
    const taskIndex = db.getData().tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = db.getData().tasks[taskIndex];

    // Remove task
    db.getData().tasks.splice(taskIndex, 1);
    // Remove associated comments
    db.getData().comments = db.getData().comments.filter((c) => c.taskId !== taskId);
    // Remove associated notifications
    db.getData().notifications = db.getData().notifications.filter((n) => n.taskId !== taskId);
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'TASK_DELETED',
      taskId: task.id,
      taskTitle: task.title,
      description: `Task "${task.title}" (${task.id}) permanently deleted by Admin ${req.user!.name}`,
    });

    res.json({ success: true, message: `Task ${taskId} deleted successfully` });
  });

  // Delete individual comment (Admin or author)
  app.delete('/api/tasks/:taskId/comments/:commentId', requireAuth, (req: Request, res: Response) => {
    const { taskId, commentId } = req.params;
    const commentIndex = db.getData().comments.findIndex((c) => c.id === commentId && c.taskId === taskId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const comment = db.getData().comments[commentIndex];
    const isAdmin = req.user!.role === 'ADMIN' || (req.permissions || []).includes('DELETE_TASK');
    if (!isAdmin && comment.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    db.getData().comments.splice(commentIndex, 1);
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'TASK_COMMENT_DELETED',
      taskId,
      description: `Comment deleted by ${req.user!.name}`,
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  });

  // -------------------------------------------------------------
  // NOTIFICATIONS ROUTES
  // -------------------------------------------------------------
  app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const notifications = db.getData().notifications.filter(n => n.userId === user.id);
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({
      notifications,
      unreadCount,
    });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const notif = db.getData().notifications.find(n => n.id === req.params.id && n.userId === user.id);
    if (notif) {
      notif.read = true;
      db.save();
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    db.getData().notifications.forEach(n => {
      if (n.userId === user.id) {
        n.read = true;
      }
    });
    db.save();
    res.json({ success: true });
  });

  // -------------------------------------------------------------
  // USERS MANAGEMENT ROUTES
  // -------------------------------------------------------------
  app.get('/api/users', requireAuth, (req: Request, res: Response) => {
    res.json(db.getPublicUsers());
  });

  app.post('/api/users', requireAuth, requirePermission('MANAGE_USERS'), (req: Request, res: Response) => {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'Name, email, role, and password are required' });
    }

    if (db.getUserByEmail(email.trim())) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    const userCount = db.getData().users.length + 1;
    const nextId = `U${String(userCount).padStart(3, '0')}`;
    const { hash, salt } = hashPassword(password);

    const newUser = {
      id: nextId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role as UserRole,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      passwordHash: hash,
      salt,
    };

    db.getData().users.push(newUser);
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_CREATED',
      description: `Created new user ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
    });

    const { passwordHash: _, salt: __, ...publicUser } = newUser;
    res.status(201).json({ success: true, user: publicUser });
  });

  app.put('/api/users/:id', requireAuth, requirePermission('MANAGE_USERS'), (req: Request, res: Response) => {
    const user = db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, role, status, newPassword } = req.body;

    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (role) user.role = role as UserRole;
    if (status) user.status = status;

    if (newPassword && newPassword.length >= 6) {
      const { hash, salt } = hashPassword(newPassword);
      user.passwordHash = hash;
      user.salt = salt;
    }

    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_UPDATED',
      description: `Updated profile for user ${user.name} (${user.id})`,
    });

    const { passwordHash, salt, ...publicUser } = user;
    res.json({ success: true, user: publicUser });
  });

  app.post('/api/users/:id/reset-password', requireAuth, requirePermission('MANAGE_USERS'), (req: Request, res: Response) => {
    const targetUser = db.getUserById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    const { hash, salt } = hashPassword(newPassword);
    targetUser.passwordHash = hash;
    targetUser.salt = salt;
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_PASSWORD_RESET',
      description: `Reset password for user ${targetUser.name} (${targetUser.id})`,
    });

    res.json({ success: true, message: 'Password reset successfully' });
  });

  // Admin delete user
  app.delete('/api/users/:id', requireAuth, requirePermission('MANAGE_USERS'), (req: Request, res: Response) => {
    const targetUserId = req.params.id;
    const userIndex = db.getData().users.findIndex((u) => u.id === targetUserId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }
    const targetUser = db.getData().users[userIndex];

    if (req.user!.id === targetUserId) {
      return res.status(400).json({ error: 'You cannot delete your own logged-in account' });
    }

    if (targetUser.role === 'ADMIN') {
      const adminCount = db.getData().users.filter((u) => u.role === 'ADMIN').length;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only administrator of the system' });
      }
    }

    // Check if user has active tasks assigned
    const activeTasks = db
      .getData()
      .tasks.filter((t) => t.assignedTo === targetUserId && t.status !== 'Completed' && t.status !== 'Cancelled');
    if (activeTasks.length > 0) {
      return res.status(400).json({
        error: `Cannot delete user: ${targetUser.name} still has ${activeTasks.length} active task(s) assigned. Please reassign them first or set status to Inactive.`,
      });
    }

    db.getData().users.splice(userIndex, 1);
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_DELETED',
      description: `Deleted user ${targetUser.name} (${targetUser.id}, ${targetUser.email})`,
    });

    res.json({ success: true, message: `User ${targetUser.name} deleted successfully` });
  });

  // -------------------------------------------------------------
  // PERMISSIONS & ROLES ROUTES
  // -------------------------------------------------------------
  app.get('/api/permissions', requireAuth, (req: Request, res: Response) => {
    res.json({
      rolePermissions: db.getData().rolePermissions,
      allPermissions: ALL_SYSTEM_PERMISSIONS,
    });
  });

  app.put('/api/permissions', requireAuth, requirePermission('MANAGE_PERMISSIONS'), (req: Request, res: Response) => {
    const { rolePermissions } = req.body;
    if (!rolePermissions || !rolePermissions.ADMIN || !rolePermissions.EMPLOYEE) {
      return res.status(400).json({ error: 'Invalid role permissions format' });
    }

    db.getData().rolePermissions = rolePermissions;
    db.save();

    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'PERMISSION_CHANGED',
      description: `System role permissions updated by Admin`,
    });

    res.json({ success: true, rolePermissions: db.getData().rolePermissions });
  });

  // -------------------------------------------------------------
  // ACTIVITY LOGS ROUTE
  // -------------------------------------------------------------
  app.get('/api/activity-log', requireAuth, requirePermission('VIEW_ACTIVITY_LOG'), (req: Request, res: Response) => {
    const { action, userId, search } = req.query;
    let logs = [...db.getData().activityLogs];

    if (action && typeof action === 'string' && action !== 'ALL') {
      logs = logs.filter(l => l.action === action);
    }
    if (userId && typeof userId === 'string' && userId !== 'ALL') {
      logs = logs.filter(l => l.userId === userId);
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      logs = logs.filter(
        l =>
          l.description.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          (l.taskTitle && l.taskTitle.toLowerCase().includes(q))
      );
    }

    res.json(logs);
  });

  // -------------------------------------------------------------
  // SETTINGS ROUTES
  // -------------------------------------------------------------
  app.get('/api/settings', requireAuth, (req: Request, res: Response) => {
    res.json(db.getData().settings);
  });

  app.put('/api/settings', requireAuth, requirePermission('MANAGE_SETTINGS'), (req: Request, res: Response) => {
    const {
      companyName,
      appName,
      defaultTaskPriority,
      defaultTaskStatus,
      sessionTimeoutMinutes,
      enableDeadlineNotifications,
      notificationAdvanceDays,
    } = req.body;

    const current = db.getData().settings;
    if (companyName) current.companyName = companyName.trim();
    if (appName) current.appName = appName.trim();
    if (defaultTaskPriority) current.defaultTaskPriority = defaultTaskPriority;
    if (defaultTaskStatus) current.defaultTaskStatus = defaultTaskStatus;
    if (sessionTimeoutMinutes) current.sessionTimeoutMinutes = Number(sessionTimeoutMinutes);
    if (enableDeadlineNotifications !== undefined) current.enableDeadlineNotifications = Boolean(enableDeadlineNotifications);
    if (notificationAdvanceDays) current.notificationAdvanceDays = Number(notificationAdvanceDays);

    db.save();
    res.json({ success: true, settings: current });
  });

  app.get('/api/database/backup', requireAuth, requirePermission('MANAGE_SETTINGS'), (req: Request, res: Response) => {
    const raw = db.getData();
    const sanitizedUsers = raw.users.map(({ passwordHash, salt, ...u }) => u);
    res.json({
      ...raw,
      users: sanitizedUsers,
      sessions: [],
    });
  });

  // -------------------------------------------------------------
  // EMAIL / SMTP STATUS & TEST ROUTES
  // -------------------------------------------------------------
  app.get('/api/email/status', requireAuth, (req: Request, res: Response) => {
    res.json({
      configured: emailService.isConfigured(),
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: process.env.SMTP_PORT || '465',
      user: process.env.SMTP_USER || null,
      fromName: process.env.SMTP_FROM_NAME || 'PaisaFin Task Management',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'notifications@paisafin.com',
    });
  });

  app.post('/api/email/test', requireAuth, requirePermission('MANAGE_SETTINGS'), async (req: Request, res: Response) => {
    const targetEmail = req.body.email || req.user!.email;
    const result = await emailService.sendTestEmail(targetEmail);
    res.json(result);
  });

  // -------------------------------------------------------------
  // REPORTS ROUTE
  // -------------------------------------------------------------
  app.get('/api/reports', requireAuth, requirePermission('VIEW_REPORTS'), (req: Request, res: Response) => {
    const tasks = db.getData().tasks.map(t => ({
      ...t,
      isOverdue: isTaskOverdue(t),
    }));

    const users = db.getPublicUsers();

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const pendingTasks = tasks.filter(t => t.status !== 'Completed' && t.status !== 'Cancelled').length;
    const overdueTasks = tasks.filter(t => t.isOverdue).length;

    // By status
    const statusCounts: Record<string, number> = {
      'Not Started': 0,
      'Assigned': 0,
      'In Progress': 0,
      'On Hold': 0,
      'Completion Requested': 0,
      'Completed': 0,
      'Rejected': 0,
      'Cancelled': 0,
    };
    tasks.forEach(t => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });

    // By priority
    const priorityCounts: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Urgent: 0,
    };
    tasks.forEach(t => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });

    // By employee
    const employeeStats = users.map(u => {
      const assigned = tasks.filter(t => t.assignedTo === u.id);
      return {
        userId: u.id,
        userName: u.name,
        total: assigned.length,
        completed: assigned.filter(t => t.status === 'Completed').length,
        inProgress: assigned.filter(t => t.status === 'In Progress').length,
        overdue: assigned.filter(t => t.isOverdue).length,
      };
    });

    res.json({
      summary: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      statusCounts,
      priorityCounts,
      employeeStats,
    });
  });

  // -------------------------------------------------------------
  // VITE / STATIC MIDDLEWARE
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Office Task Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
