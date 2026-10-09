/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  db,
  verifyPassword,
  isLegacyPassword,
  hashPassword,
  ALL_SYSTEM_PERMISSIONS,
  PROTECTED_ADMIN_PERMISSIONS,
  DEFAULT_EXPENSE_SETTINGS,
} from './server/db';
import { emailService } from './server/email';
import { getAccessibleExpenseRecords } from './server/expenseAccess';
import { calculateKilometreExpense, selectEffectiveExpenseRate } from './server/expensePolicy';
import {
  Expense,
  ExpenseCategory,
  ExpenseRate,
  ExpenseSettings,
  Permission,
  Task,
  UserRole,
  TaskStatus,
} from './src/types';

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

  app.use(express.json({ limit: '8mb' }));

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

  function canViewTask(userId: string, permissions: Permission[], task: Task): boolean {
    if (permissions.includes('VIEW_ALL_TASKS')) return true;
    return permissions.includes('VIEW_OWN_TASKS') && (task.assignedTo === userId || task.approver === userId);
  }

  function isIsoDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  const defaultBranding = {
    appName: 'PaisaFin Task Manager',
    companyName: 'PaisaFin',
    logoUrl: '/office-task-icon.png',
  };

  function getPublicBranding() {
    const settings = db.getData().settings;
    const storedLogoUrl = settings.logoUrl;
    return {
      appName: settings.appName || defaultBranding.appName,
      companyName: settings.companyName || defaultBranding.companyName,
      logoUrl: typeof storedLogoUrl === 'string' &&
        /^\/api\/branding\/logo\/brand-[a-f0-9]{32}\.(png|jpg|webp)$/.test(storedLogoUrl)
        ? storedLogoUrl
        : defaultBranding.logoUrl,
    };
  }

  function decodeBrandLogo(value: unknown): { buffer: Buffer; extension: 'png' | 'jpg' | 'webp' } | null {
    if (typeof value !== 'string') return null;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return null;

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 1024 * 1024 || buffer.toString('base64') !== match[2]) return null;

    if (match[1] === 'png') {
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const hasPngHeader = buffer.length >= 45 && buffer.subarray(0, 8).equals(signature) &&
        buffer.readUInt32BE(8) === 13 && buffer.toString('ascii', 12, 16) === 'IHDR';
      const hasPngEnd = buffer.length >= 12 && buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND';
      if (!hasPngHeader || !hasPngEnd) return null;
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (!isSafeLogoDimensions(width, height)) return null;
      return { buffer, extension: 'png' };
    }

    if (match[1] === 'jpeg') {
      if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff ||
        buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
      let offset = 2;
      let dimensions: { width: number; height: number } | null = null;
      while (offset + 4 < buffer.length && buffer[offset] === 0xff) {
        while (offset < buffer.length && buffer[offset] === 0xff) offset++;
        const marker = buffer[offset++];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
        if (offset + 2 > buffer.length) return null;
        const segmentLength = buffer.readUInt16BE(offset);
        if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          if (segmentLength < 7) return null;
          dimensions = {
            height: buffer.readUInt16BE(offset + 3),
            width: buffer.readUInt16BE(offset + 5),
          };
          break;
        }
        offset += segmentLength;
      }
      if (!dimensions || !isSafeLogoDimensions(dimensions.width, dimensions.height)) return null;
      return { buffer, extension: 'jpg' };
    }

    const declaredWebpSize = buffer.length >= 12 ? buffer.readUInt32LE(4) + 8 : 0;
    if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP' || declaredWebpSize !== buffer.length) return null;
    let webpDimensions: { width: number; height: number } | null = null;
    if (buffer.toString('ascii', 12, 16) === 'VP8X' && buffer.length >= 30) {
      webpDimensions = {
        width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
        height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
      };
    } else if (buffer.toString('ascii', 12, 16) === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      webpDimensions = {
        width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
        height: 1 + (((buffer[22] & 0xc0) >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10)),
      };
    } else if (buffer.toString('ascii', 12, 16) === 'VP8 ' && buffer.length >= 30 &&
      buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      webpDimensions = {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (!webpDimensions || !isSafeLogoDimensions(webpDimensions.width, webpDimensions.height)) return null;
    return { buffer, extension: 'webp' };
  }

  function isSafeLogoDimensions(width: number, height: number): boolean {
    return width > 0 && height > 0 && width <= 4096 && height <= 4096 && width * height <= 16_777_216;
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
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
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
    if (isLegacyPassword(password, user.passwordHash, user.salt)) {
      const upgradedHash = hashPassword(password);
      user.passwordHash = upgradedHash.hash;
      user.salt = upgradedHash.salt;
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

    const permissions = db.getSessionUser(token)?.permissions || [];
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
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 10) {
      return res.status(400).json({ error: 'New password must be at least 10 characters' });
    }

    const user = db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    const token = req.headers.authorization!.slice('Bearer '.length);
    db.getData().sessions = db.getData().sessions.filter(session => session.userId !== user.id || session.token === token);
    db.save();

    res.json({ success: true, message: 'Password updated successfully' });
  });

  // -------------------------------------------------------------
  // TASKS ROUTES
  // -------------------------------------------------------------
  app.get('/api/tasks', requireAuth, (req: Request, res: Response) => {
    const user = req.user!;
    const permissions = req.permissions || [];
    const hasViewAll = permissions.includes('VIEW_ALL_TASKS');

    let tasks = db.getData().tasks.map(t => ({
      ...t,
      isOverdue: isTaskOverdue(t),
    }));

    // Filter by ownership if not permitted to view all
    if (!hasViewAll && !permissions.includes('VIEW_OWN_TASKS')) {
      return res.status(403).json({ error: 'Permission denied: task viewing is not enabled' });
    }
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

    if (!canViewTask(user.id, req.permissions || [], task)) {
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

    if (typeof title !== 'string' || typeof category !== 'string' || !title.trim() || !category.trim() ||
      !priority || !assignedTo || !approver || !startDate || !deadline) {
      return res.status(400).json({ error: 'All required task fields must be provided' });
    }
    if (!isIsoDate(startDate) || !isIsoDate(deadline) ||
      (expectedCompletionDate !== undefined && !isIsoDate(expectedCompletionDate))) {
      return res.status(400).json({ error: 'Task dates must use the YYYY-MM-DD format' });
    }
    if (title.length > 200 || category.length > 100 || (typeof description === 'string' && description.length > 10000)) {
      return res.status(400).json({ error: 'Task text exceeds the allowed length' });
    }
    if (!['Low', 'Medium', 'High', 'Urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid task priority' });
    }

    const assignedUser = db.getUserById(assignedTo);
    if (!assignedUser || assignedUser.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Assigned employee not found' });
    }

    const approverUser = db.getUserById(approver);
    if (!approverUser || approverUser.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Approver user not found' });
    }
    if (assignedUser.id !== req.user!.id && !req.permissions!.includes('ASSIGN_TASK')) {
      return res.status(403).json({ error: 'Permission denied: ASSIGN_TASK required' });
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
    emailService.sendTaskAssignedEmail(newTask, { name: assignedUser.name, email: assignedUser.email }, appUrl).catch(() => {
      console.error('Email send failed: task assignment notification');
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

    const canEditTask = permissions.includes('EDIT_TASK');
    const isAssignee = task.assignedTo === user.id;

    if (!canEditTask && (!isAssignee || !permissions.includes('UPDATE_TASK'))) {
      return res.status(403).json({ error: 'Unauthorized to modify this task' });
    }

    const now = new Date().toISOString();
    const previousAssignedTo = task.assignedTo;

    // Handle Employee update vs Admin update
    if (!canEditTask) {
      // Employee restrictions: cannot alter deadline, priority, approver, assignedTo, or approval fields
      const { progress, status, expectedCompletionDate } = req.body;
      const allowedFields = new Set(['progress', 'status', 'expectedCompletionDate']);
      if (Object.keys(req.body).some(field => !allowedFields.has(field))) {
        return res.status(403).json({ error: 'You may only update task progress and expected completion date' });
      }

      let updatedProgress: number | undefined;
      if (progress !== undefined) {
        if (!permissions.includes('UPDATE_PROGRESS')) {
          return res.status(403).json({ error: 'Permission denied: UPDATE_PROGRESS required' });
        }
        const num = Number(progress);
        if (isNaN(num) || num < 0 || num > 100) {
          return res.status(400).json({ error: 'Progress must be a valid number between 0 and 100' });
        }
        updatedProgress = num;
      }
      if (status !== undefined && !['In Progress', 'On Hold'].includes(status)) {
        return res.status(400).json({ error: 'Employees may only set status to In Progress or On Hold' });
      }
      if (status !== undefined && !permissions.includes('UPDATE_PROGRESS')) {
        return res.status(403).json({ error: 'Permission denied: UPDATE_PROGRESS required' });
      }
      if (expectedCompletionDate !== undefined) {
        if (!permissions.includes('CHANGE_DEADLINE')) {
          return res.status(403).json({ error: 'Permission denied: CHANGE_DEADLINE required' });
        }
        if (!isIsoDate(expectedCompletionDate)) return res.status(400).json({ error: 'Expected completion date must use YYYY-MM-DD format' });
      }

      if (updatedProgress !== undefined) {
        task.progress = updatedProgress;
        // Auto adjust status based on progress if currently Not Started or In Progress
        if (updatedProgress === 0 && task.status === 'In Progress') {
          task.status = 'Not Started';
        } else if (updatedProgress > 0 && updatedProgress < 100 && (task.status === 'Not Started' || task.status === 'Assigned')) {
          task.status = 'In Progress';
        }
        // Notice rule: 100% does NOT automatically mark as Completed.
      }

      if (status !== undefined) {
        task.status = status;
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

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) return res.status(400).json({ error: 'Title must be non-empty text' });
    if (description !== undefined && typeof description !== 'string') return res.status(400).json({ error: 'Description must be text' });
    if (category !== undefined && typeof category !== 'string') return res.status(400).json({ error: 'Category must be text' });
    if (typeof title === 'string' && title.length > 200) return res.status(400).json({ error: 'Title cannot exceed 200 characters' });
    if (typeof description === 'string' && description.length > 10000) return res.status(400).json({ error: 'Description cannot exceed 10000 characters' });
    if (typeof category === 'string' && category.length > 100) return res.status(400).json({ error: 'Category cannot exceed 100 characters' });
    if (priority !== undefined && !['Low', 'Medium', 'High', 'Urgent'].includes(priority)) return res.status(400).json({ error: 'Invalid task priority' });
    for (const [label, value] of [['Start date', startDate], ['Deadline', deadline], ['Expected completion date', expectedCompletionDate]] as const) {
      if (value !== undefined && !isIsoDate(value)) return res.status(400).json({ error: `${label} must use YYYY-MM-DD format` });
    }
    if (priority !== undefined && !permissions.includes('CHANGE_PRIORITY')) return res.status(403).json({ error: 'Permission denied: CHANGE_PRIORITY required' });
    if ((deadline !== undefined || startDate !== undefined || expectedCompletionDate !== undefined) &&
      !permissions.includes('CHANGE_DEADLINE')) {
      return res.status(403).json({ error: 'Permission denied: CHANGE_DEADLINE required' });
    }
    if (status !== undefined && !['Not Started', 'Assigned', 'In Progress', 'On Hold', 'Completion Requested', 'Completed', 'Rejected', 'Cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid task status' });
    }
    if (assignedTo !== undefined && (typeof assignedTo !== 'string' || !assignedTo)) return res.status(400).json({ error: 'Assignee ID must be non-empty text' });
    if (approver !== undefined && (typeof approver !== 'string' || !approver)) return res.status(400).json({ error: 'Approver ID must be non-empty text' });
    const reassignedUser = assignedTo && assignedTo !== task.assignedTo ? db.getUserById(assignedTo) : undefined;
    const changedApprover = approver && approver !== task.approver ? db.getUserById(approver) : undefined;
    if (reassignedUser || changedApprover) {
      if (!permissions.includes('ASSIGN_TASK') && !permissions.includes('REASSIGN_TASK')) {
        return res.status(403).json({ error: 'Permission denied: ASSIGN_TASK required' });
      }
    }
    if (assignedTo && assignedTo !== task.assignedTo && (!reassignedUser || reassignedUser.status !== 'ACTIVE')) {
      return res.status(400).json({ error: 'Assigned employee not found or inactive' });
    }
    if (approver && approver !== task.approver && (!changedApprover || changedApprover.status !== 'ACTIVE')) {
      return res.status(400).json({ error: 'Approver user not found or inactive' });
    }
    let updatedProgress: number | undefined;
    if (progress !== undefined) {
      updatedProgress = Number(progress);
      if (!Number.isFinite(updatedProgress) || updatedProgress < 0 || updatedProgress > 100) {
        return res.status(400).json({ error: 'Progress must be a valid number between 0 and 100' });
      }
    }

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (category) task.category = category.trim();
    if (priority) task.priority = priority;
    if (startDate) task.startDate = startDate;
    if (deadline) task.deadline = deadline;
    if (expectedCompletionDate) task.expectedCompletionDate = expectedCompletionDate;
    if (status) task.status = status;

    if (updatedProgress !== undefined) task.progress = updatedProgress;

    if (reassignedUser) {
      task.assignedTo = reassignedUser.id;
      task.assignedToName = reassignedUser.name;

      db.addNotification({
        userId: reassignedUser.id,
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
        description: `Task reassigned to ${reassignedUser.name}`,
      });

      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      emailService.sendTaskAssignedEmail(task, { name: reassignedUser.name, email: reassignedUser.email }, appUrl).catch(() => {
        console.error('Email send failed: task reassignment notification');
      });
    }

    if (changedApprover) {
      task.approver = changedApprover.id;
      task.approverName = changedApprover.name;
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
    if (task.assignedTo !== user.id) {
      return res.status(403).json({ error: 'Only the assigned employee can request help' });
    }

    const { problemDescription, helpFrom } = req.body;
    if (typeof problemDescription !== 'string' || !problemDescription.trim() || problemDescription.length > 2000) {
      return res.status(400).json({ error: 'Problem description is required for help request' });
    }

    const helperUser = helpFrom ? db.getUserById(helpFrom) : undefined;
    if (helpFrom && (!helperUser || helperUser.status !== 'ACTIVE')) {
      return res.status(400).json({ error: 'Selected helper is not an active user' });
    }

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
      emailService.sendHelpRequestEmail(task, user.name, { name: helperUser.name, email: helperUser.email }, task.problemDescription || '', appUrl).catch(() => {
        console.error('Email send failed: help request notification');
      });
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
    if (!canViewTask(user.id, req.permissions || [], task)) {
      return res.status(403).json({ error: 'Unauthorized to access this task' });
    }

    const isHelper = task.helpFrom === user.id;
    const isApprover = task.approver === user.id;
    const isAssignee = task.assignedTo === user.id;
    const isAdmin = (req.permissions || []).includes('EDIT_TASK');

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
    if (task.assignedTo !== user.id) {
      return res.status(403).json({ error: 'Only the assigned employee can request task completion' });
    }

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
      emailService.sendCompletionRequestEmail(task, { name: approverUser.name, email: approverUser.email }, appUrl).catch(() => {
        console.error('Email send failed: completion request notification');
      });
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
    const isAdmin = permissions.includes('APPROVE_TASK');

    if (!isApprover && !isAdmin) {
      return res.status(403).json({ error: 'Only the designated approver or an administrator can review this task' });
    }

    if (task.approvalStatus !== 'Pending' && task.status !== 'Completion Requested') {
      return res.status(400).json({ error: 'This task does not have a pending completion request' });
    }

    const { decision, comment } = req.body;
    if (decision === 'approve' && !permissions.includes('APPROVE_TASK')) {
      return res.status(403).json({ error: 'Permission denied: APPROVE_TASK required' });
    }
    if (decision === 'reject' && !permissions.includes('REJECT_TASK')) {
      return res.status(403).json({ error: 'Permission denied: REJECT_TASK required' });
    }
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
        emailService.sendApprovalDecisionEmail(task, 'approved', { name: assigneeUser.name, email: assigneeUser.email }, user.name, task.approvalComment, appUrl).catch(() => {
          console.error('Email send failed: approval notification');
        });
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
        emailService.sendApprovalDecisionEmail(task, 'rejected', { name: assigneeUser.name, email: assigneeUser.email }, user.name, comment.trim(), appUrl).catch(() => {
          console.error('Email send failed: rejection notification');
        });
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
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!canViewTask(req.user!.id, req.permissions || [], task)) {
      return res.status(403).json({ error: 'Unauthorized to view comments on this task' });
    }
    const comments = db.getData().comments.filter(c => c.taskId === req.params.id);
    comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    res.json(comments);
  });

  app.post('/api/tasks/:id/comments', requireAuth, requirePermission('ADD_COMMENT'), (req: Request, res: Response) => {
    const user = req.user!;
    const task = db.getData().tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!canViewTask(user.id, req.permissions || [], task)) {
      return res.status(403).json({ error: 'Unauthorized to comment on this task' });
    }

    const { comment } = req.body;
    if (typeof comment !== 'string' || !comment.trim() || comment.length > 4000) {
      return res.status(400).json({ error: 'Comment must contain between 1 and 4000 characters' });
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
    const task = db.getData().tasks.find(candidate => candidate.id === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!canViewTask(req.user!.id, req.permissions || [], task)) {
      return res.status(403).json({ error: 'Unauthorized to access this task' });
    }
    const commentIndex = db.getData().comments.findIndex((c) => c.id === commentId && c.taskId === taskId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const comment = db.getData().comments[commentIndex];
    const isAdmin = (req.permissions || []).includes('DELETE_TASK');
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
  // EXPENSES
  // -------------------------------------------------------------
  function accessibleExpenses(req: Request): Expense[] | null {
    return getAccessibleExpenseRecords(db.getData().expenses, req.user!.id, req.permissions || []);
  }

  function validExpenseDate(value: unknown): value is string {
    return isIsoDate(value) && value <= new Date().toISOString().slice(0, 10);
  }

  function makeExpenseFields(
    input: Record<string, unknown>,
    existing: Expense | undefined,
    submitting: boolean
  ): { fields?: Partial<Expense>; error?: string } {
    const settings = db.getData().expenseSettings;
    const date = input.date ?? existing?.date;
    const categoryId = input.categoryId ?? existing?.categoryId;
    const category = settings.categories.find(item => item.id === categoryId);
    if (!category) return { error: 'Choose a configured expense category' };
    if (submitting && !category.enabled) return { error: 'This expense category is currently disabled' };
    if (!validExpenseDate(date)) return { error: 'Expense date must be a valid date and cannot be in the future' };

    const descriptionValue = input.description ?? existing?.description ?? '';
    if (typeof descriptionValue !== 'string' || descriptionValue.length > 1000 ||
      (submitting && !descriptionValue.trim())) {
      return { error: 'Enter an expense reason of up to 1,000 characters' };
    }
    const remarksValue = input.remarks ?? existing?.remarks ?? '';
    if (typeof remarksValue !== 'string' || remarksValue.length > 1000) {
      return { error: 'Remarks must be 1,000 characters or fewer' };
    }
    const travelFrom = input.travelFrom ?? existing?.travelFrom ?? '';
    const travelTo = input.travelTo ?? existing?.travelTo ?? '';
    if (typeof travelFrom !== 'string' || travelFrom.length > 200 ||
      typeof travelTo !== 'string' || travelTo.length > 200) {
      return { error: 'Travel locations must be 200 characters or fewer' };
    }

    const fields: Partial<Expense> = {
      date,
      categoryId: category.id,
      categoryName: category.name,
      description: descriptionValue.trim(),
      calculationMode: category.calculationMode,
      remarks: remarksValue.trim(),
      travelFrom: travelFrom.trim(),
      travelTo: travelTo.trim(),
    };

    if (category.calculationMode === 'KILOMETRE') {
      const kilometresValue = input.kilometres ?? existing?.kilometres;
      const vehicleValue = input.vehicleType ?? existing?.vehicleType;
      if (kilometresValue === undefined || kilometresValue === null || kilometresValue === '') {
        if (submitting) return { error: 'Enter the distance in kilometres' };
        fields.kilometres = undefined;
        fields.amount = 0;
      } else {
        const kilometres = Number(kilometresValue);
        if (!Number.isFinite(kilometres) || kilometres < 0 || kilometres > settings.maxKilometres ||
          (submitting && kilometres === 0)) {
          return { error: `Distance must be greater than 0 and no more than ${settings.maxKilometres} km` };
        }
        if (vehicleValue !== undefined &&
          (typeof vehicleValue !== 'string' || vehicleValue.trim().length > 40)) {
          return { error: 'Choose a valid vehicle type' };
        }
        if (submitting && (typeof vehicleValue !== 'string' || !vehicleValue.trim())) {
          return { error: 'Choose a valid vehicle type' };
        }
        const rate = typeof vehicleValue === 'string' && isIsoDate(date)
          ? selectEffectiveExpenseRate(settings.rates, date, category.id, vehicleValue)
          : undefined;
        if (!rate && submitting) return { error: `No reimbursement rate is configured for ${vehicleValue} on ${date}` };
        fields.kilometres = kilometres;
        fields.vehicleType = typeof vehicleValue === 'string' ? vehicleValue.trim() : undefined;
        if (rate) {
          const amount = calculateKilometreExpense(kilometres, rate.ratePerKm);
          if (amount > settings.maxAmount) return { error: `Calculated amount cannot exceed ₹${settings.maxAmount}` };
          fields.amount = amount;
          fields.ratePerKm = rate.ratePerKm;
          fields.rateEffectiveDate = rate.effectiveDate;
        } else {
          fields.amount = 0;
          fields.ratePerKm = undefined;
          fields.rateEffectiveDate = undefined;
        }
        if (submitting && (!travelFrom.trim() || !travelTo.trim())) {
          return { error: 'Enter travel origin and destination' };
        }
      }
    } else {
      const amountValue = input.amount ?? existing?.amount;
      const amount = amountValue === undefined || amountValue === null || amountValue === '' ? 0 : Number(amountValue);
      if (!Number.isFinite(amount) || amount < 0 || amount > settings.maxAmount ||
        (submitting && amount <= 0)) {
        return { error: `Amount must be greater than 0 and no more than ₹${settings.maxAmount}` };
      }
      fields.amount = Math.round(amount * 100) / 100;
      fields.kilometres = undefined;
      fields.vehicleType = undefined;
      fields.ratePerKm = undefined;
      fields.rateEffectiveDate = undefined;
    }

    if (submitting && category.receiptRequired && !input.receiptAvailable && !existing?.receiptFile && !input.receiptFile) {
      return { error: 'A supporting receipt is required for this category' };
    }
    return { fields };
  }

  function decodeExpenseReceipt(value: unknown): { buffer: Buffer; extension: 'png' | 'jpg' | 'pdf'; contentType: string } | null {
    if (typeof value !== 'string') return null;
    const match = /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) return null;
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024 || buffer.toString('base64') !== match[2]) return null;
    if (match[1] === 'image/png') {
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (buffer.length < 45 || !buffer.subarray(0, 8).equals(signature) ||
        buffer.toString('ascii', 12, 16) !== 'IHDR' ||
        buffer.toString('ascii', buffer.length - 8, buffer.length - 4) !== 'IEND') return null;
      return { buffer, extension: 'png', contentType: 'image/png' };
    }
    if (match[1] === 'image/jpeg') {
      if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff ||
        buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
      return { buffer, extension: 'jpg', contentType: 'image/jpeg' };
    }
    if (buffer.length < 8 || buffer.toString('ascii', 0, 5) !== '%PDF-') return null;
    return { buffer, extension: 'pdf', contentType: 'application/pdf' };
  }

  async function saveExpenseReceipt(dataUrl: unknown): Promise<{ filename: string; contentType: string } | null> {
    if (dataUrl === undefined) return null;
    const receipt = decodeExpenseReceipt(dataUrl);
    if (!receipt) throw new Error('Upload a valid PNG, JPEG, or PDF receipt up to 5 MB');
    const filename = `receipt-${crypto.randomBytes(16).toString('hex')}.${receipt.extension}`;
    const receiptDir = path.join(process.cwd(), 'data', 'expense-receipts');
    await fs.mkdir(receiptDir, { recursive: true });
    await fs.writeFile(path.join(receiptDir, filename), receipt.buffer, { flag: 'wx', mode: 0o600 });
    return { filename, contentType: receipt.contentType };
  }

  function logExpenseActivity(req: Request, action: string, expense: Expense, detail: string): void {
    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action,
      description: `Expense ${expense.id}: ${detail}`,
    });
  }

  app.get('/api/expenses/settings', requireAuth, (req: Request, res: Response) => {
    const settings = db.getData().expenseSettings;
    if (req.permissions?.includes('MANAGE_EXPENSE_SETTINGS')) return res.json(settings);
    res.json({
      ...settings,
      categories: settings.categories.filter(category => category.enabled),
      rates: settings.rates,
    });
  });

  app.put('/api/expenses/settings', requireAuth, requirePermission('MANAGE_EXPENSE_SETTINGS'), (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Partial<ExpenseSettings>
      : {};
    if (!Array.isArray(body.categories) || body.categories.length < 1 || body.categories.length > 100 ||
      !Array.isArray(body.rates) || body.rates.length > 1000) {
      return res.status(400).json({ error: 'Expense categories and rates are invalid' });
    }
    const categoryIds = new Set<string>();
    const categoryNames = new Set<string>();
    const categories: ExpenseCategory[] = [];
    for (const value of body.categories) {
      if (!value || typeof value.id !== 'string' || !/^[a-z0-9-]{2,48}$/.test(value.id) ||
        typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 ||
        typeof value.enabled !== 'boolean' || typeof value.receiptRequired !== 'boolean' ||
        !['AMOUNT', 'KILOMETRE'].includes(value.calculationMode)) {
        return res.status(400).json({ error: 'Each category needs a valid ID, name, status, calculation mode, and receipt setting' });
      }
      if (categoryIds.has(value.id) || categoryNames.has(value.name.trim().toLowerCase())) {
        return res.status(400).json({ error: 'Expense category IDs and names must be unique' });
      }
      categoryIds.add(value.id);
      categoryNames.add(value.name.trim().toLowerCase());
      categories.push({ ...value, name: value.name.trim() });
    }

    const rates: ExpenseRate[] = [];
    const rateKeys = new Set<string>();
    for (const value of body.rates) {
      if (!value || typeof value.vehicleType !== 'string' || !value.vehicleType.trim() ||
        value.vehicleType.trim().length > 40 || !Number.isFinite(value.ratePerKm) ||
        value.ratePerKm <= 0 || value.ratePerKm > 10000 || !isIsoDate(value.effectiveDate) ||
        !Array.isArray(value.categoryIds) || value.categoryIds.length === 0 ||
        value.categoryIds.some(id => typeof id !== 'string' || !categoryIds.has(id) ||
          categories.find(category => category.id === id)?.calculationMode !== 'KILOMETRE')) {
        return res.status(400).json({ error: 'Each rate needs a valid vehicle, effective date, positive amount, and kilometre category' });
      }
      const categorySet = [...new Set(value.categoryIds)];
      for (const categoryId of categorySet) {
        const key = `${value.vehicleType.trim().toLowerCase()}|${value.effectiveDate}|${categoryId}`;
        if (rateKeys.has(key)) return res.status(400).json({ error: 'Duplicate vehicle rate for an effective date and category' });
        rateKeys.add(key);
      }
      rates.push({
        id: typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.id)
          ? value.id
          : crypto.randomUUID(),
        vehicleType: value.vehicleType.trim(),
        ratePerKm: Math.round(value.ratePerKm * 100) / 100,
        effectiveDate: value.effectiveDate,
        categoryIds: categorySet,
      });
    }
    const maxAmount = Number(body.maxAmount);
    const maxKilometres = Number(body.maxKilometres);
    const approvalThreshold = Number(body.approvalThreshold);
    if (!Number.isFinite(maxAmount) || maxAmount <= 0 || maxAmount > 1_000_000_000 ||
      !Number.isFinite(maxKilometres) || maxKilometres <= 0 || maxKilometres > 1_000_000 ||
      !Number.isFinite(approvalThreshold) || approvalThreshold < 0 || approvalThreshold > maxAmount) {
      return res.status(400).json({ error: 'Expense limits and approval threshold must be within valid ranges' });
    }
    db.getData().expenseSettings = {
      categories,
      rates,
      maxAmount: Math.round(maxAmount * 100) / 100,
      maxKilometres: Math.round(maxKilometres * 100) / 100,
      approvalThreshold: Math.round(approvalThreshold * 100) / 100,
    };
    db.save();
    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'EXPENSE_SETTINGS_UPDATED',
      description: 'Updated expense categories, kilometre rates, limits, and approval threshold',
    });
    res.json({ success: true, settings: db.getData().expenseSettings });
  });

  app.get('/api/expenses', requireAuth, (req: Request, res: Response) => {
    let expenses = accessibleExpenses(req);
    if (!expenses) return res.status(403).json({ error: 'Permission denied: expense viewing is not enabled' });
    const { employeeId, categoryId, status, paymentStatus, dateFrom, dateTo } = req.query;
    if (employeeId && typeof employeeId === 'string') {
      if (!req.permissions?.includes('VIEW_ALL_EXPENSES') && employeeId !== req.user!.id) {
        return res.status(403).json({ error: 'You can only view your own expenses' });
      }
      expenses = expenses.filter(expense => expense.employeeId === employeeId);
    }
    if (categoryId && typeof categoryId === 'string') expenses = expenses.filter(expense => expense.categoryId === categoryId);
    if (status && typeof status === 'string' && status !== 'ALL') expenses = expenses.filter(expense => expense.status === status);
    if (paymentStatus === 'PAID') expenses = expenses.filter(expense => expense.status === 'PAID');
    if (paymentStatus === 'PENDING') expenses = expenses.filter(expense => expense.status === 'APPROVED');
    if (dateFrom && typeof dateFrom === 'string') expenses = expenses.filter(expense => expense.date >= dateFrom);
    if (dateTo && typeof dateTo === 'string') expenses = expenses.filter(expense => expense.date <= dateTo);

    const page = Math.max(1, Math.min(1_000_000, Number(req.query.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(req.query.pageSize) || 20));
    const thisMonth = new Date().toISOString().slice(0, 7);
    const summary = {
      submitted: expenses.filter(expense => expense.status !== 'DRAFT').length,
      pendingApproval: expenses.filter(expense => expense.status === 'SUBMITTED' || expense.status === 'UNDER_REVIEW').length,
      approved: expenses.filter(expense => expense.status === 'APPROVED' || expense.status === 'PAID').length,
      rejected: expenses.filter(expense => expense.status === 'REJECTED').length,
      reimbursementPending: expenses.filter(expense => expense.status === 'APPROVED').reduce((sum, expense) => sum + expense.amount, 0),
      totalPaid: expenses.filter(expense => expense.status === 'PAID').reduce((sum, expense) => sum + expense.amount, 0),
      monthlyAmount: expenses.filter(expense => expense.date.startsWith(thisMonth) && expense.status !== 'DRAFT')
        .reduce((sum, expense) => sum + expense.amount, 0),
    };
    const sorted = [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      expenses: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
      page,
      pageSize,
      summary,
    });
  });

  app.get('/api/expenses/reports', requireAuth, requirePermission('VIEW_EXPENSE_REPORTS'), (req: Request, res: Response) => {
    const expenses = accessibleExpenses(req);
    if (!expenses) return res.status(403).json({ error: 'Permission denied: expense report access is not enabled' });
    const { dateFrom, dateTo } = req.query;
    const filtered = expenses.filter(expense => expense.status !== 'DRAFT' &&
      (!dateFrom || typeof dateFrom !== 'string' || expense.date >= dateFrom) &&
      (!dateTo || typeof dateTo !== 'string' || expense.date <= dateTo));
    const monthlyMap = new Map<string, { month: string; employeeId: string; employeeName: string; kilometres: number; submittedAmount: number; approvedAmount: number; paidAmount: number }>();
    const categoryMap = new Map<string, { category: string; count: number; amount: number; kilometres: number }>();
    for (const expense of filtered) {
      const monthKey = `${expense.date.slice(0, 7)}|${expense.employeeId}`;
      const monthly = monthlyMap.get(monthKey) || {
        month: expense.date.slice(0, 7),
        employeeId: expense.employeeId,
        employeeName: expense.employeeName,
        kilometres: 0,
        submittedAmount: 0,
        approvedAmount: 0,
        paidAmount: 0,
      };
      monthly.kilometres += expense.kilometres || 0;
      monthly.submittedAmount += expense.amount;
      if (expense.status === 'APPROVED' || expense.status === 'PAID') monthly.approvedAmount += expense.amount;
      if (expense.status === 'PAID') monthly.paidAmount += expense.amount;
      monthlyMap.set(monthKey, monthly);

      const category = categoryMap.get(expense.categoryId) || {
        category: expense.categoryName,
        count: 0,
        amount: 0,
        kilometres: 0,
      };
      category.count += 1;
      category.amount += expense.amount;
      category.kilometres += expense.kilometres || 0;
      categoryMap.set(expense.categoryId, category);
    }
    res.json({
      monthlyEmployee: [...monthlyMap.values()].sort((a, b) => b.month.localeCompare(a.month) || a.employeeName.localeCompare(b.employeeName)),
      categories: [...categoryMap.values()].sort((a, b) => b.amount - a.amount),
    });
  });

  app.get('/api/expenses/:id/receipt', requireAuth, async (req: Request, res: Response) => {
    const expense = db.getData().expenses.find(item => item.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (!accessibleExpenses(req)?.some(item => item.id === expense.id)) {
      return res.status(403).json({ error: 'You are not authorized to view this receipt' });
    }
    if (!expense.receiptFile || !/^receipt-[a-f0-9]{32}\.(png|jpg|pdf)$/.test(expense.receiptFile)) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    try {
      const receipt = await fs.readFile(path.join(process.cwd(), 'data', 'expense-receipts', expense.receiptFile));
      const contentType = expense.receiptType === 'image/png' ? 'image/png'
        : expense.receiptType === 'image/jpeg' ? 'image/jpeg' : 'application/pdf';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${expense.receiptName || 'expense-receipt'}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(receipt);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return res.status(404).json({ error: 'Receipt not found' });
      console.error('Failed to read expense receipt');
      return res.status(500).json({ error: 'Could not load expense receipt' });
    }
  });

  app.post('/api/expenses', requireAuth, requirePermission('CREATE_EXPENSE'), async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const submit = body.submit === true;
    if (submit && !req.permissions?.includes('SUBMIT_EXPENSE')) {
      return res.status(403).json({ error: 'Permission denied: expense submission is not enabled' });
    }
    const result = makeExpenseFields({ ...body, receiptAvailable: Boolean(body.receiptDataUrl) }, undefined, submit);
    if (result.error || !result.fields) return res.status(400).json({ error: result.error });
    let receipt: { filename: string; contentType: string } | null;
    try {
      receipt = await saveExpenseReceipt(body.receiptDataUrl);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid receipt upload' });
    }
    const receiptName = typeof body.receiptName === 'string'
      ? body.receiptName.replace(/[^A-Za-z0-9 ._-]/g, '_').slice(0, 120)
      : '';
    const now = new Date().toISOString();
    const expense: Expense = {
      ...result.fields,
      id: `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      employeeId: req.user!.id,
      employeeName: req.user!.name,
      date: result.fields.date!,
      categoryId: result.fields.categoryId!,
      categoryName: result.fields.categoryName!,
      description: result.fields.description!,
      calculationMode: result.fields.calculationMode!,
      amount: result.fields.amount || 0,
      receiptFile: receipt?.filename,
      receiptName: receipt ? receiptName || 'expense-receipt' : undefined,
      receiptType: receipt?.contentType,
      status: submit ? 'SUBMITTED' : 'DRAFT',
      submittedAt: submit ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.getData().expenses.unshift(expense);
    db.save();
    logExpenseActivity(req, submit ? 'EXPENSE_SUBMITTED' : 'EXPENSE_CREATED', expense, submit
      ? `submitted ${expense.categoryName} expense for ₹${expense.amount.toFixed(2)}`
      : 'saved as draft');
    res.status(201).json({ success: true, expense });
  });

  app.put('/api/expenses/:id', requireAuth, requirePermission('CREATE_EXPENSE'), async (req: Request, res: Response) => {
    const expense = db.getData().expenses.find(item => item.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.employeeId !== req.user!.id) return res.status(403).json({ error: 'You can only edit your own expense' });
    if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED') {
      return res.status(409).json({ error: 'Submitted expenses cannot be edited' });
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    const result = makeExpenseFields(body, expense, false);
    if (result.error || !result.fields) return res.status(400).json({ error: result.error });
    let receipt: { filename: string; contentType: string } | null;
    try {
      receipt = await saveExpenseReceipt(body.receiptDataUrl);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid receipt upload' });
    }
    Object.assign(expense, result.fields, {
      updatedAt: new Date().toISOString(),
      ...(receipt ? {
        receiptFile: receipt.filename,
        receiptType: receipt.contentType,
        receiptName: typeof body.receiptName === 'string'
          ? body.receiptName.replace(/[^A-Za-z0-9 ._-]/g, '_').slice(0, 120)
          : 'expense-receipt',
      } : {}),
      ...(body.clearReceipt === true ? { receiptFile: undefined, receiptType: undefined, receiptName: undefined } : {}),
    });
    db.save();
    logExpenseActivity(req, 'EXPENSE_UPDATED', expense, 'updated draft or rejected expense');
    res.json({ success: true, expense });
  });

  app.post('/api/expenses/:id/submit', requireAuth, requirePermission('SUBMIT_EXPENSE'), (req: Request, res: Response) => {
    const expense = db.getData().expenses.find(item => item.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.employeeId !== req.user!.id) return res.status(403).json({ error: 'You can only submit your own expense' });
    if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED') {
      return res.status(409).json({ error: 'Only draft or rejected expenses can be submitted' });
    }
    const result = makeExpenseFields({ receiptAvailable: !!expense.receiptFile }, expense, true);
    if (result.error || !result.fields) return res.status(400).json({ error: result.error });
    Object.assign(expense, result.fields, {
      status: 'SUBMITTED' as const,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rejectionReason: undefined,
    });
    db.save();
    logExpenseActivity(req, 'EXPENSE_SUBMITTED', expense, `submitted ${expense.categoryName} expense for ₹${expense.amount.toFixed(2)}`);
    res.json({ success: true, expense });
  });

  app.post('/api/expenses/:id/review', requireAuth, (req: Request, res: Response) => {
    const expense = db.getData().expenses.find(item => item.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const action = req.body?.action;
    if (action === 'reject' && !req.permissions?.includes('REJECT_EXPENSE')) {
      return res.status(403).json({ error: 'Permission denied: expense rejection is not enabled' });
    }
    if (action !== 'reject' && !req.permissions?.includes('APPROVE_EXPENSE')) {
      return res.status(403).json({ error: 'Permission denied: expense approval is not enabled' });
    }
    if (expense.employeeId === req.user!.id) return res.status(403).json({ error: 'You cannot review your own expense' });
    if (expense.status !== 'SUBMITTED' && expense.status !== 'UNDER_REVIEW') {
      return res.status(409).json({ error: 'Only submitted or under-review expenses can be reviewed' });
    }
    if (action === 'reject' && (typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.trim().length > 1000)) {
      return res.status(400).json({ error: 'A rejection reason of up to 1,000 characters is required' });
    }
    if (action !== 'start_review' && action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Choose start_review, approve, or reject' });
    }
    if (action === 'approve' && expense.amount > db.getData().expenseSettings.approvalThreshold && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Expenses above the configured approval threshold require an administrator' });
    }
    expense.status = action === 'reject' ? 'REJECTED' : action === 'approve' ? 'APPROVED' : 'UNDER_REVIEW';
    expense.rejectionReason = action === 'reject' ? req.body.reason.trim() : undefined;
    expense.reviewedAt = action === 'start_review' ? undefined : new Date().toISOString();
    expense.reviewedBy = action === 'start_review' ? undefined : req.user!.id;
    expense.reviewedByName = action === 'start_review' ? undefined : req.user!.name;
    expense.updatedAt = new Date().toISOString();
    db.save();
    logExpenseActivity(req, action === 'approve' ? 'EXPENSE_APPROVED' : action === 'reject' ? 'EXPENSE_REJECTED' : 'EXPENSE_UNDER_REVIEW',
      expense, action === 'reject' ? `rejected: ${expense.rejectionReason}` : action === 'approve' ? 'approved for reimbursement' : 'started review');
    res.json({ success: true, expense });
  });

  app.post('/api/expenses/:id/pay', requireAuth, requirePermission('PAY_EXPENSE'), (req: Request, res: Response) => {
    const expense = db.getData().expenses.find(item => item.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'APPROVED') return res.status(409).json({ error: 'Only approved expenses can be marked as paid' });
    const { paymentDate, paymentReference, paymentRemarks } = req.body || {};
    if (!isIsoDate(paymentDate) || paymentDate > new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Enter a valid payment date that is not in the future' });
    }
    if ((paymentReference !== undefined && (typeof paymentReference !== 'string' || paymentReference.length > 120)) ||
      (paymentRemarks !== undefined && (typeof paymentRemarks !== 'string' || paymentRemarks.length > 1000))) {
      return res.status(400).json({ error: 'Payment reference or remarks exceeds the allowed length' });
    }
    expense.status = 'PAID';
    expense.paymentDate = paymentDate;
    expense.paymentReference = paymentReference?.trim() || undefined;
    expense.paymentRemarks = paymentRemarks?.trim() || undefined;
    expense.paidBy = req.user!.id;
    expense.paidByName = req.user!.name;
    expense.updatedAt = new Date().toISOString();
    db.save();
    logExpenseActivity(req, 'EXPENSE_PAID', expense, `marked ₹${expense.amount.toFixed(2)} paid on ${paymentDate}`);
    res.json({ success: true, expense });
  });

  // -------------------------------------------------------------
  // USERS MANAGEMENT ROUTES
  // -------------------------------------------------------------
  app.get('/api/users', requireAuth, (req: Request, res: Response) => {
    const permissions = req.permissions || [];
    const publicUsers = db.getPublicUsers();
    if (permissions.includes('MANAGE_USERS')) return res.json(publicUsers);

    let visibleUsers = publicUsers;
    if (!permissions.includes('ASSIGN_TASK')) {
      const visibleTaskUserIds = new Set([req.user!.id]);
      db.getData().tasks.filter(task => canViewTask(req.user!.id, permissions, task)).forEach(task => {
        visibleTaskUserIds.add(task.assignedTo);
        visibleTaskUserIds.add(task.approver);
      });
      visibleUsers = publicUsers.filter(user => visibleTaskUserIds.has(user.id));
    }
    res.json(visibleUsers.map(({ email: _email, permissionOverrides: _overrides, ...user }) => ({
      ...user,
      email: '',
    })));
  });

  app.post('/api/users', requireAuth, requirePermission('MANAGE_USERS'), (req: Request, res: Response) => {
    const { name, email, role, password } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim() || !role || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name, email, role, and password are required' });
    }
    if (name.trim().length > 100 || email.trim().length > 254) {
      return res.status(400).json({ error: 'Name or email exceeds the allowed length' });
    }
    if (!['ADMIN', 'EMPLOYEE'].includes(role)) return res.status(400).json({ error: 'Invalid user role' });
    if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (db.getUserByEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    let userCount = db.getData().users.reduce((max, user) => {
      const numericId = /^U(\d+)$/i.exec(user.id);
      return numericId ? Math.max(max, Number(numericId[1])) : max;
    }, 0) + 1;
    let nextId = `U${String(userCount).padStart(3, '0')}`;
    while (db.getUserById(nextId)) {
      nextId = `U${String(++userCount).padStart(3, '0')}`;
    }
    const { hash, salt } = hashPassword(password);

    const newUser = {
      id: nextId,
      name: name.trim(),
      email: normalizedEmail,
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

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'Name must be a non-empty string' });
    }
    if ((typeof name === 'string' && name.trim().length > 100) ||
      (typeof email === 'string' && email.trim().length > 254)) {
      return res.status(400).json({ error: 'Name or email exceeds the allowed length' });
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }
      const duplicate = db.getUserByEmail(email.trim());
      if (duplicate && duplicate.id !== user.id) {
        return res.status(400).json({ error: 'A user with this email address already exists' });
      }
    }
    if (role !== undefined && !['ADMIN', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid user status' });
    }
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 10)) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }

    const wouldLoseAdmin = user.role === 'ADMIN' && user.status === 'ACTIVE' &&
      ((role !== undefined && role !== 'ADMIN') || (status !== undefined && status !== 'ACTIVE'));
    if (wouldLoseAdmin) {
      const activeAdmins = db.getData().users.filter(candidate => candidate.role === 'ADMIN' && candidate.status === 'ACTIVE');
      if (activeAdmins.length <= 1) {
        return res.status(400).json({ error: 'Cannot demote or deactivate the last active administrator' });
      }
    }
    if (req.user!.id === user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own active account' });
    }

    if (name !== undefined) user.name = name.trim();
    if (email !== undefined) user.email = email.trim().toLowerCase();
    if (role !== undefined) user.role = role as UserRole;
    if (status !== undefined) user.status = status;

    if (newPassword) {
      const { hash, salt } = hashPassword(newPassword);
      user.passwordHash = hash;
      user.salt = salt;
    }

    if (user.status === 'INACTIVE') {
      db.getData().sessions = db.getData().sessions.filter(session => session.userId !== user.id);
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
    if (typeof newPassword !== 'string' || newPassword.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }
    const { hash, salt } = hashPassword(newPassword);
    targetUser.passwordHash = hash;
    targetUser.salt = salt;
    db.getData().sessions = db.getData().sessions.filter(session => session.userId !== targetUser.id);
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

  // -------------------------------------------------------------
  // PERMISSIONS & ROLES ROUTES
  // -------------------------------------------------------------
  app.get('/api/permissions', requireAuth, requirePermission('MANAGE_PERMISSIONS'), (req: Request, res: Response) => {
    res.json({
      rolePermissions: db.getData().rolePermissions,
      allPermissions: ALL_SYSTEM_PERMISSIONS,
      protectedAdminPermissions: PROTECTED_ADMIN_PERMISSIONS,
      users: db.getPublicUsers().map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        permissionOverrides: user.permissionOverrides || {},
      })),
    });
  });

  app.put('/api/permissions', requireAuth, requirePermission('MANAGE_PERMISSIONS'), (req: Request, res: Response) => {
    const { rolePermissions } = req.body;
    if (!rolePermissions || !Array.isArray(rolePermissions.ADMIN) || !Array.isArray(rolePermissions.EMPLOYEE) ||
      rolePermissions.ADMIN.some((permission: unknown) => !ALL_SYSTEM_PERMISSIONS.includes(permission as Permission)) ||
      rolePermissions.EMPLOYEE.some((permission: unknown) => !ALL_SYSTEM_PERMISSIONS.includes(permission as Permission))) {
      return res.status(400).json({ error: 'Invalid role permissions format' });
    }
    if (PROTECTED_ADMIN_PERMISSIONS.some(permission => !rolePermissions.ADMIN.includes(permission))) {
      return res.status(400).json({ error: 'Critical administrator permissions cannot be disabled' });
    }
    if (PROTECTED_ADMIN_PERMISSIONS.some(permission => rolePermissions.EMPLOYEE.includes(permission))) {
      return res.status(400).json({ error: 'Critical administrator permissions cannot be granted to the employee role' });
    }

    db.getData().rolePermissions = {
      ADMIN: [...new Set(rolePermissions.ADMIN as Permission[])],
      EMPLOYEE: [...new Set(rolePermissions.EMPLOYEE as Permission[])],
    };
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

  app.put('/api/permissions/users/:id', requireAuth, requirePermission('MANAGE_PERMISSIONS'), (req: Request, res: Response) => {
    const target = db.getUserById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user!.id) {
      return res.status(400).json({ error: 'You cannot change your own individual permissions' });
    }

    const overrides = req.body.permissionOverrides;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      return res.status(400).json({ error: 'Permission overrides must be an object' });
    }
    const validatedOverrides: Partial<Record<Permission, boolean | null>> = {};
    for (const [permission, value] of Object.entries(overrides)) {
      if (!ALL_SYSTEM_PERMISSIONS.includes(permission as Permission) ||
        (value !== true && value !== false && value !== null)) {
        return res.status(400).json({ error: 'Invalid permission override value' });
      }
      if (PROTECTED_ADMIN_PERMISSIONS.includes(permission as Permission)) {
        return res.status(400).json({ error: 'Critical administrator permissions cannot be assigned as user overrides' });
      }
      validatedOverrides[permission as Permission] = value;
    }

    target.permissionOverrides = validatedOverrides;
    db.save();
    db.logActivity({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.user!.role,
      action: 'USER_PERMISSION_CHANGED',
      description: `Updated individual permission overrides for ${target.name} (${target.id})`,
    });

    res.json({ success: true, permissionOverrides: target.permissionOverrides });
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
  app.get('/api/branding', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getPublicBranding());
  });

  app.get('/api/branding/logo/:filename', async (req: Request, res: Response) => {
    const match = /^brand-[a-f0-9]{32}\.(png|jpg|webp)$/.exec(req.params.filename);
    if (!match) return res.status(404).json({ error: 'Brand logo not found' });

    const logoPath = path.join(process.cwd(), 'data', 'branding', match[0]);
    try {
      const image = await fs.readFile(logoPath);
      const contentType = match[1] === 'png' ? 'image/png' : match[1] === 'jpg' ? 'image/jpeg' : 'image/webp';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', image.length);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(image);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({ error: 'Brand logo not found' });
      }
      console.error('Failed to read saved brand logo');
      return res.status(500).json({ error: 'Could not load brand logo' });
    }
  });

  app.get('/api/branding/manifest.webmanifest', (_req: Request, res: Response) => {
    const branding = getPublicBranding();
    const isDefaultLogo = branding.logoUrl === defaultBranding.logoUrl;
    res.setHeader('Cache-Control', 'no-store');
    const manifest = {
      name: branding.appName,
      short_name: branding.appName.slice(0, 24),
      description: `${branding.companyName} task management portal`,
      start_url: '/',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#17614f',
      icons: [{
        src: isDefaultLogo ? '/paisafin-app-icon-512.png' : branding.logoUrl,
        ...(isDefaultLogo
          ? { sizes: '512x512', type: 'image/png' }
          : { type: branding.logoUrl.endsWith('.jpg') ? 'image/jpeg' : branding.logoUrl.endsWith('.webp') ? 'image/webp' : 'image/png' }),
        purpose: 'any',
      }],
    };
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.send(JSON.stringify(manifest));
  });

  app.put('/api/branding', requireAuth, requirePermission('MANAGE_SETTINGS'), async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const resetBranding = body.resetBranding === true;
    const appName = resetBranding ? defaultBranding.appName : body.appName;
    const companyName = resetBranding ? defaultBranding.companyName : body.companyName;
    if (typeof appName !== 'string' || !appName.trim() || appName.trim().length > 80 ||
      typeof companyName !== 'string' || !companyName.trim() || companyName.trim().length > 80 ||
      /[\u0000-\u001f\u007f]/.test(appName) || /[\u0000-\u001f\u007f]/.test(companyName)) {
      return res.status(400).json({ error: 'Application and company names must be 1 to 80 printable characters' });
    }
    if (body.logoDataUrl !== undefined && (body.resetLogo === true || resetBranding)) {
      return res.status(400).json({ error: 'Upload a logo or reset it, not both' });
    }

    const settings = db.getData().settings;
    let uploadedLogo: { buffer: Buffer; extension: 'png' | 'jpg' | 'webp' } | null = null;
    let uploadedLogoUrl: string | null = null;
    let uploadedLogoPath: string | null = null;
    if (body.logoDataUrl !== undefined) {
      uploadedLogo = decodeBrandLogo(body.logoDataUrl);
      if (!uploadedLogo) {
        return res.status(400).json({ error: 'Choose a valid PNG, JPEG, or WebP image up to 1 MB' });
      }
      const filename = `brand-${crypto.randomBytes(16).toString('hex')}.${uploadedLogo.extension}`;
      const brandingDir = path.join(process.cwd(), 'data', 'branding');
      uploadedLogoPath = path.join(brandingDir, filename);
      try {
        await fs.mkdir(brandingDir, { recursive: true });
        await fs.writeFile(uploadedLogoPath, uploadedLogo.buffer, { flag: 'wx', mode: 0o600 });
      } catch {
        console.error('Failed to store uploaded brand logo');
        return res.status(500).json({ error: 'Could not save brand logo' });
      }
      uploadedLogoUrl = `/api/branding/logo/${filename}`;
    }

    const previousBranding = {
      appName: settings.appName,
      companyName: settings.companyName,
      logoUrl: settings.logoUrl,
    };
    settings.appName = appName.trim();
    settings.companyName = companyName.trim();
    if (uploadedLogoUrl) settings.logoUrl = uploadedLogoUrl;
    else if (body.resetLogo === true || resetBranding) settings.logoUrl = null;
    try {
      db.save();
    } catch {
      settings.appName = previousBranding.appName;
      settings.companyName = previousBranding.companyName;
      settings.logoUrl = previousBranding.logoUrl;
      if (uploadedLogoPath) {
        try {
          await fs.unlink(uploadedLogoPath);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error('Could not remove uncommitted brand logo upload');
          }
        }
      }
      console.error('Failed to persist application branding');
      return res.status(500).json({ error: 'Could not save branding settings' });
    }
    try {
      db.logActivity({
        userId: req.user!.id,
        userName: req.user!.name,
        userRole: req.user!.role,
        action: 'BRANDING_UPDATED',
        description: `Updated application branding${uploadedLogo ? ' and logo' : ''}`,
      });
    } catch {
      console.error('Failed to record branding update in the activity log');
      return res.status(500).json({ error: 'Branding was saved, but its activity log could not be recorded' });
    }
    return res.json({ success: true, branding: getPublicBranding() });
  });

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
  // EMAIL / SMTP STATUS ROUTE
  // -------------------------------------------------------------
  app.get('/api/email/status', requireAuth, requirePermission('MANAGE_SETTINGS'), (req: Request, res: Response) => {
    res.json({
      configured: emailService.isConfigured(),
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: process.env.SMTP_PORT || '465',
      fromName: process.env.SMTP_FROM_NAME || 'PaisaFin Task Management',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'notifications@paisafin.com',
    });
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

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    console.error('Unhandled request error');
    return res.status(500).json({ error: 'An unexpected server error occurred' });
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
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'sw.js' || path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PaisaFin Task Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
