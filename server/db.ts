/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  Task,
  TaskComment,
  AppNotification,
  ActivityLogEntry,
  AppSettings,
  Expense,
  ExpenseSettings,
  Permission,
  RolePermissions,
} from '../src/types';
import { ALL_SYSTEM_PERMISSIONS, resolveUserPermissions } from './permissions';
import { removeDemoTasks } from './demoData';

export { ALL_SYSTEM_PERMISSIONS, PROTECTED_ADMIN_PERMISSIONS } from './permissions';

export interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface DatabaseSchema {
  schemaVersion: number;
  users: UserRecord[];
  tasks: Task[];
  comments: TaskComment[];
  notifications: AppNotification[];
  activityLogs: ActivityLogEntry[];
  settings: AppSettings;
  rolePermissions: RolePermissions;
  expenses: Expense[];
  expenseSettings: ExpenseSettings;
  sessions: SessionRecord[];
  taskCounter: number;
}

export class InvalidDatabaseBackupError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const LEGACY_DATA_DIR = path.resolve(process.cwd(), 'data');
export const APP_DATA_DIR = path.resolve(
  process.env.APP_DATA_DIR || path.join(os.homedir(), '.paisafin-task-manager'),
);
const DATA_DIR = APP_DATA_DIR;
const DB_FILE = path.join(DATA_DIR, 'office_tasks_db.json');

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  ADMIN: [...ALL_SYSTEM_PERMISSIONS],
  EMPLOYEE: [
    'VIEW_DASHBOARD',
    'VIEW_OWN_TASKS',
    'UPDATE_TASK',
    'UPDATE_PROGRESS',
    'ADD_COMMENT',
    'REQUEST_HELP',
    'REQUEST_COMPLETION',
    'VIEW_OWN_EXPENSES',
    'CREATE_EXPENSE',
    'SUBMIT_EXPENSE',
  ],
};

export const DEFAULT_EXPENSE_SETTINGS: ExpenseSettings = {
  categories: [
    { id: 'petrol-fuel', name: 'Petrol/Fuel', enabled: true, calculationMode: 'KILOMETRE', receiptRequired: true },
    { id: 'local-travel', name: 'Local Travel', enabled: true, calculationMode: 'KILOMETRE', receiptRequired: false },
    { id: 'outstation-travel', name: 'Outstation Travel', enabled: true, calculationMode: 'KILOMETRE', receiptRequired: true },
    { id: 'food-meals', name: 'Food/Meals', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
    { id: 'accommodation', name: 'Accommodation', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
    { id: 'office-supplies', name: 'Office Supplies', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
    { id: 'courier', name: 'Courier', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
    { id: 'repairs-maintenance', name: 'Repairs and Maintenance', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
    { id: 'other-approved-expenses', name: 'Other Approved Expenses', enabled: true, calculationMode: 'AMOUNT', receiptRequired: true },
  ],
  rates: [],
  maxAmount: 100000,
  maxKilometres: 1000,
  approvalThreshold: 10000,
};

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 210000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expectedHash = Buffer.from(hash, 'hex');
  if (expectedHash.length !== 64) return false;

  const currentHash = crypto.pbkdf2Sync(password, salt, 210000, 64, 'sha512');
  if (crypto.timingSafeEqual(currentHash, expectedHash)) return true;

  // Existing database entries were created with 1,000 rounds.
  const legacyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
  return crypto.timingSafeEqual(legacyHash, expectedHash);
}

export function isLegacyPassword(password: string, hash: string, salt: string): boolean {
  const expectedHash = Buffer.from(hash, 'hex');
  if (expectedHash.length !== 64) return false;
  const legacyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
  return crypto.timingSafeEqual(legacyHash, expectedHash);
}

function getDefaultDatabase(): DatabaseSchema {
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  if (!initialAdminPassword || initialAdminPassword.length < 10) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be set to at least 10 characters before first database initialization');
  }
  const adminCredentials = hashPassword(initialAdminPassword);
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    users: [{
      id: 'U001',
      name: 'Amit Bahuguna',
      email: 'amitbahuguna@paisafin.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: now,
      passwordHash: adminCredentials.hash,
      salt: adminCredentials.salt,
    }],
    tasks: [],
    comments: [],
    notifications: [],
    activityLogs: [],
    settings: {
      companyName: 'PaisaFin',
      appName: 'PaisaFin Task Manager',
      logoUrl: null,
      defaultTaskPriority: 'Medium',
      defaultTaskStatus: 'Assigned',
      sessionTimeoutMinutes: 480,
      enableDeadlineNotifications: true,
      notificationAdvanceDays: 2,
    },
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    expenses: [],
    expenseSettings: DEFAULT_EXPENSE_SETTINGS,
    sessions: [],
    taskCounter: 0,
  };
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (DATA_DIR !== LEGACY_DATA_DIR && !fs.existsSync(DB_FILE) &&
        fs.existsSync(path.join(LEGACY_DATA_DIR, 'office_tasks_db.json'))) {
        fs.cpSync(LEGACY_DATA_DIR, DATA_DIR, { recursive: true, force: false });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8').trim();
        if (!raw) {
          throw new Error('Database file is empty');
        }

        const parsed = JSON.parse(raw);
        // Ensure all required fields exist
        if (!parsed.users || !parsed.tasks || !parsed.rolePermissions) {
          throw new Error('Database schema invalid, reinitializing');
        }
        parsed.comments = Array.isArray(parsed.comments) ? parsed.comments : [];
        parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
        parsed.activityLogs = Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [];
        parsed.sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        parsed.taskCounter = Number.isInteger(parsed.taskCounter) && parsed.taskCounter >= 0
          ? parsed.taskCounter
          : parsed.tasks.length;
        const needsExpensePermissionMigration = !Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1;
        parsed.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
        parsed.expenseSettings = {
          ...DEFAULT_EXPENSE_SETTINGS,
          ...(parsed.expenseSettings || {}),
          categories: Array.isArray(parsed.expenseSettings?.categories)
            ? parsed.expenseSettings.categories
            : DEFAULT_EXPENSE_SETTINGS.categories,
          rates: Array.isArray(parsed.expenseSettings?.rates) ? parsed.expenseSettings.rates : [],
        };
        if (needsExpensePermissionMigration) {
          parsed.rolePermissions.ADMIN = [...new Set([
            ...(Array.isArray(parsed.rolePermissions.ADMIN) ? parsed.rolePermissions.ADMIN : []),
            'VIEW_OWN_EXPENSES',
            'CREATE_EXPENSE',
            'SUBMIT_EXPENSE',
            'VIEW_ALL_EXPENSES',
            'APPROVE_EXPENSE',
            'REJECT_EXPENSE',
            'PAY_EXPENSE',
            'MANAGE_EXPENSE_SETTINGS',
            'VIEW_EXPENSE_REPORTS',
          ])];
          parsed.rolePermissions.EMPLOYEE = [...new Set([
            ...(Array.isArray(parsed.rolePermissions.EMPLOYEE) ? parsed.rolePermissions.EMPLOYEE : []),
            'VIEW_OWN_EXPENSES',
            'CREATE_EXPENSE',
            'SUBMIT_EXPENSE',
          ])];
        }
        parsed.schemaVersion = 1;
        if (parsed.settings?.appName === 'Office Task Manager') {
          parsed.settings.appName = 'PaisaFin Task Manager';
        }
        if (parsed.settings && parsed.settings.logoUrl === undefined) {
          parsed.settings.logoUrl = null;
        }
        if (removeDemoTasks(parsed)) {
          const cleanupBackupPath = `${DB_FILE}.before-demo-cleanup-${Date.now()}.bak`;
          fs.copyFileSync(DB_FILE, cleanupBackupPath);
          this.persist(parsed);
        }
        return parsed;
      }
    } catch (err) {
      if (fs.existsSync(DB_FILE)) {
        const backupPath = `${DB_FILE}.corrupt-${Date.now()}.bak`;
        try {
          fs.copyFileSync(DB_FILE, backupPath);
        } catch (backupError) {
          throw new Error('Application database could not be loaded, and a safety backup could not be created', {
            cause: backupError,
          });
        }
        throw new Error(`Application database could not be loaded. The original file was preserved; backup created at ${backupPath}`, {
          cause: err,
        });
      }
    }

    const defaultData = getDefaultDatabase();
    this.data = defaultData;
    this.persist(defaultData);
    return defaultData;
  }

  private persist(dataToSave?: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = dataToSave || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write application database');
      throw new Error('Failed to persist application database', { cause: err });
    }
  }

  public save() {
    this.persist();
  }

  public restoreBackup(input: unknown) {
    if (!isRecord(input)) throw new InvalidDatabaseBackupError('Backup file must contain a JSON object');
    const candidate = input as Partial<DatabaseSchema>;
    const requiredArrays: (keyof DatabaseSchema)[] = [
      'users', 'tasks', 'comments', 'notifications', 'activityLogs', 'expenses', 'sessions',
    ];
    if (requiredArrays.some(key => !Array.isArray(candidate[key])) ||
      !isRecord(candidate.settings) || !isRecord(candidate.rolePermissions) ||
      !isRecord(candidate.expenseSettings) || !Number.isInteger(candidate.taskCounter) ||
      (candidate.taskCounter as number) < 0 || candidate.schemaVersion !== 1) {
      throw new InvalidDatabaseBackupError('Backup file is incomplete or has an unsupported format');
    }

    const users = (candidate.users as unknown[]).map(user => {
      if (!isRecord(user)) throw new InvalidDatabaseBackupError('Backup contains an invalid user record');
      const existingUser = this.data.users.find(current =>
        current.id === user.id || current.email.toLowerCase() === String(user.email || '').toLowerCase());
      const hasCredentials = user.passwordHash !== undefined && user.salt !== undefined;
      if (!hasCredentials && (user.passwordHash !== undefined || user.salt !== undefined)) {
        throw new InvalidDatabaseBackupError('Backup contains incomplete user credentials');
      }
      const credentials = hasCredentials
        ? { hash: user.passwordHash, salt: user.salt }
        : existingUser
          ? { hash: existingUser.passwordHash, salt: existingUser.salt }
          : hashPassword(crypto.randomBytes(32).toString('hex'));
      return { ...user, passwordHash: credentials.hash, salt: credentials.salt } as UserRecord;
    });
    const uniqueIds = new Set<string>();
    const uniqueEmails = new Set<string>();
    for (const user of users) {
      if (!isRecord(user) || typeof user.id !== 'string' || typeof user.name !== 'string' ||
        typeof user.email !== 'string' || !['ADMIN', 'EMPLOYEE'].includes(user.role) ||
        !['ACTIVE', 'INACTIVE', 'PENDING'].includes(user.status) ||
        typeof user.passwordHash !== 'string' || !/^[a-f0-9]{128}$/i.test(user.passwordHash) ||
        typeof user.salt !== 'string' || !/^[a-f0-9]{32}$/i.test(user.salt) || uniqueIds.has(user.id) ||
        uniqueEmails.has(user.email.toLowerCase())) {
        throw new InvalidDatabaseBackupError('Backup contains an invalid or duplicate user record');
      }
      uniqueIds.add(user.id);
      uniqueEmails.add(user.email.toLowerCase());
    }
    if (!users.some(user => user.role === 'ADMIN' && user.status === 'ACTIVE')) {
      throw new InvalidDatabaseBackupError('Backup must contain at least one active administrator');
    }
    for (const role of ['ADMIN', 'EMPLOYEE'] as const) {
      if (!Array.isArray(candidate.rolePermissions[role])) {
        throw new InvalidDatabaseBackupError('Backup contains invalid role permissions');
      }
    }
    if (!Array.isArray(candidate.expenseSettings.categories) || !Array.isArray(candidate.expenseSettings.rates)) {
      throw new InvalidDatabaseBackupError('Backup contains invalid expense settings');
    }

    const restored = JSON.parse(JSON.stringify(candidate)) as DatabaseSchema;
    restored.users = users;
    restored.sessions = [];
    removeDemoTasks(restored);

    const restoreBackupPath = `${DB_FILE}.before-restore-${Date.now()}.bak`;
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, restoreBackupPath);
    this.persist(restored);
    this.data = restored;
    return restoreBackupPath;
  }

  public getData(): DatabaseSchema {
    return this.data;
  }

  // Helper methods
  public getUserById(id: string): UserRecord | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public getNextUserId(): string {
    let userCount = this.data.users.reduce((max, user) => {
      const numericId = /^U(\d+)$/i.exec(user.id);
      return numericId ? Math.max(max, Number(numericId[1])) : max;
    }, 0) + 1;
    let nextId = `U${String(userCount).padStart(3, '0')}`;
    while (this.getUserById(nextId)) {
      nextId = `U${String(++userCount).padStart(3, '0')}`;
    }
    return nextId;
  }

  public getPublicUsers(): User[] {
    return this.data.users.map(({ passwordHash, salt, ...publicUser }) => publicUser);
  }

  public getNextTaskId(): string {
    this.data.taskCounter += 1;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const seq = String(this.data.taskCounter).padStart(4, '0');
    this.save();
    return `TASK-${y}${m}${d}-${seq}`;
  }

  public logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) {
    const newEntry: ActivityLogEntry = {
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.data.activityLogs.unshift(newEntry);
    // Keep last 1000 logs
    if (this.data.activityLogs.length > 1000) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 1000);
    }
    this.save();
    return newEntry;
  }

  public addNotification(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification,
    };
    this.data.notifications.unshift(newNotif);
    // Keep last 500 notifications
    if (this.data.notifications.length > 500) {
      this.data.notifications = this.data.notifications.slice(0, 500);
    }
    this.save();
    return newNotif;
  }

  public addComment(comment: Omit<TaskComment, 'id' | 'createdAt'>) {
    const newComment: TaskComment = {
      id: `COMM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      ...comment,
    };
    this.data.comments.unshift(newComment);
    // Keep a reasonable bounded list
    if (this.data.comments.length > 2000) {
      this.data.comments = this.data.comments.slice(0, 2000);
    }
    this.save();
    return newComment;
  }

  public createSession(userId: string, timeoutMinutes = 480): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000).toISOString();

    // Clean expired sessions
    this.data.sessions = this.data.sessions.filter(s => new Date(s.expiresAt) > now);

    this.data.sessions.push({
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
    });
    this.save();
    return token;
  }

  public getSessionUser(token: string): { user: UserRecord; permissions: Permission[] } | null {
    if (!token) return null;
    const now = new Date();
    const session = this.data.sessions.find(s => s.token === token && new Date(s.expiresAt) > now);
    if (!session) return null;

    const user = this.getUserById(session.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    const permissions = resolveUserPermissions(user.role, this.data.rolePermissions, user.permissionOverrides);
    return { user, permissions };
  }

  public revokeSession(token: string) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.save();
  }
}

export const db = new Database();
