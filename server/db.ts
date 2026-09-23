/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  Task,
  TaskComment,
  AppNotification,
  ActivityLogEntry,
  AppSettings,
  Permission,
  RolePermissions,
} from '../src/types';

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
  users: UserRecord[];
  tasks: Task[];
  comments: TaskComment[];
  notifications: AppNotification[];
  activityLogs: ActivityLogEntry[];
  settings: AppSettings;
  rolePermissions: RolePermissions;
  sessions: SessionRecord[];
  taskCounter: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'office_tasks_db.json');

export const ALL_SYSTEM_PERMISSIONS: Permission[] = [
  'VIEW_DASHBOARD',
  'VIEW_ALL_TASKS',
  'VIEW_OWN_TASKS',
  'CREATE_TASK',
  'EDIT_TASK',
  'DELETE_TASK',
  'ASSIGN_TASK',
  'REASSIGN_TASK',
  'CHANGE_DEADLINE',
  'CHANGE_PRIORITY',
  'UPDATE_TASK',
  'UPDATE_PROGRESS',
  'ADD_COMMENT',
  'REQUEST_HELP',
  'REQUEST_COMPLETION',
  'APPROVE_TASK',
  'REJECT_TASK',
  'VIEW_REPORTS',
  'VIEW_ACTIVITY_LOG',
  'MANAGE_USERS',
  'MANAGE_PERMISSIONS',
  'MANAGE_SETTINGS',
];

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
  ],
};

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return testHash === hash;
}

function getDefaultDatabase(): DatabaseSchema {
  const defaultPw = 'Office@123';
  const u1 = hashPassword(defaultPw);
  const u2 = hashPassword(defaultPw);
  const u3 = hashPassword(defaultPw);
  const u4 = hashPassword(defaultPw);

  const now = new Date().toISOString();
  const todayStr = '2026-09-22';

  const users: UserRecord[] = [
    {
      id: 'U001',
      name: 'Amit Bahuguna',
      email: 'amitbahuguna@paisafin.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-09-01T08:00:00.000Z',
      passwordHash: u1.hash,
      salt: u1.salt,
    },
    {
      id: 'U002',
      name: 'Rahul Petwal',
      email: 'Rahulpetwal@Paisafin.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      createdAt: '2026-09-01T08:30:00.000Z',
      passwordHash: u2.hash,
      salt: u2.salt,
    },
    {
      id: 'U003',
      name: 'Shailesh',
      email: 'shailesh@Paisafin.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      createdAt: '2026-09-01T09:00:00.000Z',
      passwordHash: u3.hash,
      salt: u3.salt,
    },
    {
      id: 'U004',
      name: 'Jitendra',
      email: 'jitendra@Paisafin.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      createdAt: '2026-09-01T09:30:00.000Z',
      passwordHash: u4.hash,
      salt: u4.salt,
    },
  ];

  const tasks: Task[] = [
    {
      id: 'TASK-20260922-0001',
      title: 'Monthly Financial Reconciliation & Audit Preparation',
      description: 'Review ledger balances, cross-verify bank statements for PaisaFin Q3, and prepare ledger reconciliation summary.',
      category: 'Finance',
      priority: 'High',
      createdBy: 'U001',
      createdByName: 'Amit Bahuguna',
      assignedTo: 'U002',
      assignedToName: 'Rahul Petwal',
      approver: 'U001',
      approverName: 'Amit Bahuguna',
      startDate: '2026-09-20',
      deadline: '2026-09-26',
      expectedCompletionDate: '2026-09-25',
      status: 'In Progress',
      progress: 65,
      needHelp: false,
      approvalStatus: 'None',
      createdAt: '2026-09-20T09:15:00.000Z',
      updatedAt: '2026-09-21T14:30:00.000Z',
    },
    {
      id: 'TASK-20260922-0002',
      title: 'Client Onboarding Documentation Verification',
      description: 'Audit uploaded KYC dossiers and corporate entity registrations for new retail merchant accounts.',
      category: 'Operations',
      priority: 'Urgent',
      createdBy: 'U001',
      createdByName: 'Amit Bahuguna',
      assignedTo: 'U003',
      assignedToName: 'Shailesh',
      approver: 'U001',
      approverName: 'Amit Bahuguna',
      startDate: '2026-09-18',
      deadline: '2026-09-22',
      expectedCompletionDate: '2026-09-22',
      status: 'Completion Requested',
      progress: 100,
      needHelp: false,
      completionRequestedAt: '2026-09-22T08:00:00.000Z',
      approvalStatus: 'Pending',
      createdAt: '2026-09-18T10:00:00.000Z',
      updatedAt: '2026-09-22T08:00:00.000Z',
    },
    {
      id: 'TASK-20260922-0003',
      title: 'Quarterly IT Security Audit & System Hardening',
      description: 'Conduct password policy checks, verify internal VPN logs, and review permissions matrix.',
      category: 'IT',
      priority: 'Medium',
      createdBy: 'U001',
      createdByName: 'Amit Bahuguna',
      assignedTo: 'U004',
      assignedToName: 'Jitendra',
      approver: 'U001',
      approverName: 'Amit Bahuguna',
      startDate: '2026-09-19',
      deadline: '2026-09-28',
      expectedCompletionDate: '2026-09-27',
      status: 'In Progress',
      progress: 40,
      needHelp: true,
      helpFrom: 'U001',
      helpFromName: 'Amit Bahuguna',
      problemDescription: 'Require elevated admin access credentials for server room rack 3 network switch.',
      approvalStatus: 'None',
      createdAt: '2026-09-19T11:00:00.000Z',
      updatedAt: '2026-09-21T16:00:00.000Z',
    },
    {
      id: 'TASK-20260922-0004',
      title: 'Update Customer KYC Compliance Checklist',
      description: 'Ensure revised regulatory guidelines are fully incorporated into the staff standard operating procedure.',
      category: 'Documentation',
      priority: 'High',
      createdBy: 'U001',
      createdByName: 'Amit Bahuguna',
      assignedTo: 'U003',
      assignedToName: 'Shailesh',
      approver: 'U001',
      approverName: 'Amit Bahuguna',
      startDate: '2026-09-10',
      deadline: '2026-09-18', // Past deadline -> triggers Overdue logic!
      expectedCompletionDate: '2026-09-23',
      status: 'On Hold',
      progress: 25,
      needHelp: false,
      approvalStatus: 'None',
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-18T12:00:00.000Z',
    },
    {
      id: 'TASK-20260922-0005',
      title: 'PaisaFin Q3 Vendor Agreement Renewals',
      description: 'Finalize terms, review non-disclosure agreements, and archive counter-signed contracts.',
      category: 'Admin',
      priority: 'Low',
      createdBy: 'U001',
      createdByName: 'Amit Bahuguna',
      assignedTo: 'U002',
      assignedToName: 'Rahul Petwal',
      approver: 'U001',
      approverName: 'Amit Bahuguna',
      startDate: '2026-09-12',
      deadline: '2026-09-20',
      expectedCompletionDate: '2026-09-19',
      status: 'Completed',
      progress: 100,
      needHelp: false,
      completionRequestedAt: '2026-09-19T14:00:00.000Z',
      approvalStatus: 'Approved',
      approvalComment: 'All vendor agreements verified and counter-signed accurately. Great job.',
      completedAt: '2026-09-20T10:30:00.000Z',
      createdAt: '2026-09-12T09:00:00.000Z',
      updatedAt: '2026-09-20T10:30:00.000Z',
    },
  ];

  const comments: TaskComment[] = [
    {
      id: 'COMM-1',
      taskId: 'TASK-20260922-0001',
      userId: 'U002',
      userName: 'Rahul Petwal',
      userRole: 'EMPLOYEE',
      comment: 'Initial 50 bank statements analyzed. Reconciling pending payments with accounts department.',
      createdAt: '2026-09-21T11:20:00.000Z',
    },
    {
      id: 'COMM-2',
      taskId: 'TASK-20260922-0001',
      userId: 'U001',
      userName: 'Amit Bahuguna',
      userRole: 'ADMIN',
      comment: 'Please check note #4 on uncredited cheques from HDFC bank as well.',
      createdAt: '2026-09-21T13:45:00.000Z',
    },
    {
      id: 'COMM-3',
      taskId: 'TASK-20260922-0003',
      userId: 'U004',
      userName: 'Jitendra',
      userRole: 'EMPLOYEE',
      comment: 'Need help with rack 3 switch access. Submitted help request.',
      createdAt: '2026-09-21T16:05:00.000Z',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'NOTIF-1',
      userId: 'U001',
      title: 'Completion Requested',
      message: 'Shailesh has requested completion for: Client Onboarding Documentation Verification',
      type: 'COMPLETION_REQUESTED',
      taskId: 'TASK-20260922-0002',
      read: false,
      createdAt: '2026-09-22T08:00:00.000Z',
    },
    {
      id: 'NOTIF-2',
      userId: 'U001',
      title: 'Help Requested',
      message: 'Jitendra requested help on: Quarterly IT Security Audit & System Hardening',
      type: 'HELP_REQUESTED',
      taskId: 'TASK-20260922-0003',
      read: false,
      createdAt: '2026-09-21T16:00:00.000Z',
    },
    {
      id: 'NOTIF-3',
      userId: 'U002',
      title: 'Task Approved',
      message: 'Your task PaisaFin Q3 Vendor Agreement Renewals has been approved and completed.',
      type: 'TASK_APPROVED',
      taskId: 'TASK-20260922-0005',
      read: true,
      createdAt: '2026-09-20T10:30:00.000Z',
    },
  ];

  const activityLogs: ActivityLogEntry[] = [
    {
      id: 'ACT-1',
      timestamp: '2026-09-20T09:15:00.000Z',
      userId: 'U001',
      userName: 'Amit Bahuguna',
      userRole: 'ADMIN',
      action: 'TASK_CREATED',
      taskId: 'TASK-20260922-0001',
      taskTitle: 'Monthly Financial Reconciliation & Audit Preparation',
      description: 'Created task and assigned to Rahul Petwal',
    },
    {
      id: 'ACT-2',
      timestamp: '2026-09-20T10:30:00.000Z',
      userId: 'U001',
      userName: 'Amit Bahuguna',
      userRole: 'ADMIN',
      action: 'TASK_APPROVED',
      taskId: 'TASK-20260922-0005',
      taskTitle: 'PaisaFin Q3 Vendor Agreement Renewals',
      description: 'Approved completion request with comment: All vendor agreements verified',
    },
    {
      id: 'ACT-3',
      timestamp: '2026-09-21T16:00:00.000Z',
      userId: 'U004',
      userName: 'Jitendra',
      userRole: 'EMPLOYEE',
      action: 'TASK_HELP_REQUESTED',
      taskId: 'TASK-20260922-0003',
      taskTitle: 'Quarterly IT Security Audit & System Hardening',
      description: 'Requested help from Amit Bahuguna: Require elevated admin access credentials',
    },
    {
      id: 'ACT-4',
      timestamp: '2026-09-22T08:00:00.000Z',
      userId: 'U003',
      userName: 'Shailesh',
      userRole: 'EMPLOYEE',
      action: 'TASK_COMPLETION_REQUESTED',
      taskId: 'TASK-20260922-0002',
      taskTitle: 'Client Onboarding Documentation Verification',
      description: 'Reached 100% progress and submitted for approval',
    },
  ];

  const settings: AppSettings = {
    companyName: 'PaisaFin',
    appName: 'Office Task Manager',
    defaultTaskPriority: 'Medium',
    defaultTaskStatus: 'Assigned',
    sessionTimeoutMinutes: 480, // 8 hours office workday
    enableDeadlineNotifications: true,
    notificationAdvanceDays: 2,
  };

  return {
    users,
    tasks,
    comments,
    notifications,
    activityLogs,
    settings,
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    sessions: [],
    taskCounter: 5,
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
        return parsed;
      }
    } catch (err) {
      console.warn('Invalid or corrupted database detected. Reinitializing application data:', err);
      if (fs.existsSync(DB_FILE)) {
        const backupPath = `${DB_FILE}.corrupt-${Date.now()}.bak`;
        try {
          fs.copyFileSync(DB_FILE, backupPath);
        } catch {
          // Ignore backup failures and continue with reset
        }
        fs.unlinkSync(DB_FILE);
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
      console.error('Failed to write database to disk:', err);
    }
  }

  public save() {
    this.persist();
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

    const permissions = this.data.rolePermissions[user.role] || [];
    return { user, permissions };
  }

  public revokeSession(token: string) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.save();
  }
}

export const db = new Database();
