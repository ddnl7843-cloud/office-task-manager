/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { TaskList } from './components/TaskList';
import { PendingApprovalsView } from './components/PendingApprovalsView';
import { CreateTaskModal } from './components/CreateTaskModal';
import { EditTaskModal } from './components/EditTaskModal';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { UserManagement } from './components/UserManagement';
import { ReportsView } from './components/ReportsView';
import { NotificationsView } from './components/NotificationsView';
import { PermissionsView } from './components/PermissionsView';
import { ActivityLogView } from './components/ActivityLogView';
import { SettingsView } from './components/SettingsView';
import { BrandingSettingsView } from './components/BrandingSettingsView';
import { ExpenseManagementView } from './components/ExpenseManagementView';
import { MyAccountModal } from './components/MyAccountModal';
import { api } from './api';
import { Task, User, AppNotification, BrandingSettings } from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { applyBranding, DEFAULT_BRANDING } from './branding';

const MainApp: React.FC = () => {
  const { user, isAdmin, hasPermission, refreshUser, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Modals
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isMyAccountModalOpen, setIsMyAccountModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch all central data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingData(true);
      setDataError(null);
      await refreshUser();
      const [fetchedTasks, fetchedUsers, fetchedNotifications] = await Promise.all([
        api.getTasks(),
        api.getUsers(),
        api.getNotifications(),
      ]);

      setTasks(fetchedTasks);
      setUsers(fetchedUsers);
      setNotifications(fetchedNotifications.notifications);
    } catch (err: unknown) {
      console.error('Data fetch error:', err);
      setDataError(err instanceof Error ? err.message : 'Failed to fetch office data');
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, refreshUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  useEffect(() => {
    let isMounted = true;
    api.getBranding().then((currentBranding) => {
      if (isMounted) setBranding(currentBranding);
    }).catch((error: unknown) => {
      console.error('Could not load application branding', error);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  // Periodic refresh every 30 seconds for live collaboration
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchData]);

  useEffect(() => {
    const requiredPermission: Partial<Record<NavTab, import('./types').Permission>> = {
      dashboard: 'VIEW_DASHBOARD',
      all_tasks: 'VIEW_ALL_TASKS',
      my_tasks: 'VIEW_OWN_TASKS',
      pending_approvals: 'APPROVE_TASK',
      reports: 'VIEW_REPORTS',
      users: 'MANAGE_USERS',
      permissions: 'MANAGE_PERMISSIONS',
      activity_log: 'VIEW_ACTIVITY_LOG',
      settings: 'MANAGE_SETTINGS',
      branding: 'MANAGE_SETTINGS',
    };
    const permission = requiredPermission[currentTab];
    if (permission && !hasPermission(permission)) setCurrentTab('notifications');
    if (currentTab === 'my_tasks' && !hasPermission('VIEW_OWN_TASKS') && !hasPermission('VIEW_ALL_TASKS')) {
      setCurrentTab('notifications');
    }
    if (currentTab === 'expenses' && !hasPermission('VIEW_OWN_EXPENSES') &&
      !hasPermission('VIEW_ALL_EXPENSES') && !hasPermission('CREATE_EXPENSE') &&
      !hasPermission('APPROVE_EXPENSE') && !hasPermission('REJECT_EXPENSE') &&
      !hasPermission('PAY_EXPENSE') && !hasPermission('MANAGE_EXPENSE_SETTINGS') &&
      !hasPermission('VIEW_EXPENSE_REPORTS')) {
      setCurrentTab('notifications');
    }
  }, [currentTab, hasPermission]);

  // If not authenticated or checking token
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-300">Initializing {branding.appName}...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  // Pending approvals count for header/sidebar badge
  const pendingApprovalsCount = tasks.filter(
    (t) => (t.status === 'Completion Requested' || t.approvalStatus === 'Pending') &&
      (t.approver === user.id || hasPermission('APPROVE_TASK'))
  ).length;

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Handle task updates
  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
    fetchData();
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
    if (selectedTaskForDetails && selectedTaskForDetails.id === updatedTask.id) {
      setSelectedTaskForDetails(updatedTask);
    }
    fetchData();
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTaskForDetails(task);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTaskForEdit(task);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to permanently delete task "${task.title}" (${task.id})? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      if (selectedTaskForDetails && selectedTaskForDetails.id === task.id) {
        setSelectedTaskForDetails(null);
      }
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'create_task') {
      setIsCreateTaskModalOpen(true);
      return;
    }
    setCurrentTab(tab);
  };

  // Tab Header title and subtitle
  const getTabHeader = () => {
    switch (currentTab) {
      case 'dashboard':
        return {
          title: isAdmin ? 'Executive Office Dashboard' : 'My Work Dashboard',
          subtitle: isAdmin
            ? 'Real-time overview of office tasks, deadlines, and staff workload'
            : 'Track your assigned tasks, update work progress, and request completions',
        };
      case 'all_tasks':
        return {
          title: 'All Office Tasks',
          subtitle: 'Search, filter, and track all tasks across departments and staff',
        };
      case 'my_tasks':
        return {
          title: 'My Assigned Tasks',
          subtitle: 'Tasks assigned to you for execution and status reporting',
        };
      case 'pending_approvals':
        return {
          title: 'Pending Approvals',
          subtitle: 'Review 100% completed tasks and grant official sign-off',
        };
      case 'reports':
        return {
          title: 'Task Reports & Analytics',
          subtitle: 'Department metrics, completion percentages, and CSV exports',
        };
      case 'notifications':
        return {
          title: 'Activity Notifications',
          subtitle: 'Live alerts on assignments, reviews, comments, and blockers',
        };
      case 'users':
        return {
          title: 'Office User Management',
          subtitle: 'Manage team member accounts, roles, and access credentials',
        };
      case 'permissions':
        return {
          title: 'Role Permissions Matrix',
          subtitle: 'Configure operational capabilities for Admin and Employee roles',
        };
      case 'activity_log':
        return {
          title: 'Audit & Activity Log',
          subtitle: 'Comprehensive ledger of office task operations and changes',
        };
      case 'settings':
        return {
          title: 'Office Settings',
          subtitle: 'Configure company profile, thresholds, and zero-cost backups',
        };
      case 'branding':
        return {
          title: 'Branding Settings',
          subtitle: 'Configure the application name, company name, and logo',
        };
      case 'expenses':
        return {
          title: 'Expense Management',
          subtitle: 'Submit, review, and track employee expenses and reimbursements',
        };
      default:
        return { title: branding.appName, subtitle: `${branding.companyName} Workspace` };
    }
  };

  const headerInfo = getTabHeader();

  // Tasks assigned to logged in user
  const myTasks = tasks.filter((t) => t.assignedTo === user.id);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        pendingApprovalsCount={pendingApprovalsCount}
        isApproverOnAnyTask={tasks.some((task) => task.approver === user.id)}
        unreadNotificationsCount={unreadNotificationsCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMyAccount={() => setIsMyAccountModalOpen(true)}
        branding={branding}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          branding={branding}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setCurrentTab('notifications')}
          onOpenCreateTask={() => setIsCreateTaskModalOpen(true)}
          onOpenMyAccount={() => setIsMyAccountModalOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Global Data Error Alert */}
        {dataError && (
          <div className="m-4 sm:mx-6 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{dataError}</span>
            </div>
            <button
              onClick={fetchData}
              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* View Content Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            isAdmin ? (
              <AdminDashboard
                tasks={tasks}
                users={users}
                onSelectTask={handleSelectTask}
                onNavigateToTab={handleTabChange}
              />
            ) : (
              <EmployeeDashboard
                tasks={tasks}
                onSelectTask={handleSelectTask}
                onNavigateToTab={handleTabChange}
                onQuickProgressUpdate={async (task, newProgress) => {
                  const res = await api.updateTask(task.id, { progress: newProgress });
                  handleTaskUpdated(res.task);
                }}
              />
            )
          )}

          {currentTab === 'all_tasks' && (
            <TaskList
              tasks={tasks}
              users={users}
              isAllTasksView={true}
              onSelectTask={handleSelectTask}
              onEditTask={hasPermission('EDIT_TASK') ? handleEditTask : undefined}
              onDeleteTask={hasPermission('DELETE_TASK') ? handleDeleteTask : undefined}
              onCreateTask={hasPermission('CREATE_TASK') ? () => setIsCreateTaskModalOpen(true) : undefined}
            />
          )}

          {currentTab === 'my_tasks' && (
            <TaskList
              tasks={myTasks}
              users={users}
              isAllTasksView={false}
              onSelectTask={handleSelectTask}
              onEditTask={hasPermission('EDIT_TASK') ? handleEditTask : undefined}
              onDeleteTask={hasPermission('DELETE_TASK') ? handleDeleteTask : undefined}
            />
          )}

          {currentTab === 'pending_approvals' && (
            <PendingApprovalsView
              tasks={tasks}
              onSelectTask={handleSelectTask}
              onTaskUpdated={handleTaskUpdated}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView tasks={tasks} users={users} />
          )}

          {currentTab === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              tasks={tasks}
              onSelectTask={handleSelectTask}
              onRefreshNotifications={fetchData}
            />
          )}

          {currentTab === 'users' && (
            <UserManagement
              users={users}
              tasks={tasks}
              onRefreshUsers={fetchData}
            />
          )}

          {currentTab === 'permissions' && <PermissionsView />}

          {currentTab === 'activity_log' && <ActivityLogView />}

          {currentTab === 'settings' && <SettingsView />}
          {currentTab === 'branding' && (
            <BrandingSettingsView
              branding={branding}
              onSaved={(updatedBranding) => setBranding(updatedBranding)}
            />
          )}
          {currentTab === 'expenses' && <ExpenseManagementView users={users} />}
        </main>
      </div>

      {/* Modals */}
      {selectedTaskForDetails && (
        <TaskDetailsModal
          taskId={selectedTaskForDetails.id}
          users={users}
          onClose={() => setSelectedTaskForDetails(null)}
          onTaskUpdated={handleTaskUpdated}
          onOpenEdit={hasPermission('EDIT_TASK') ? handleEditTask : undefined}
          onDeleteTask={hasPermission('DELETE_TASK') ? handleDeleteTask : undefined}
          branding={branding}
        />
      )}

      {selectedTaskForEdit && (
        <EditTaskModal
          task={selectedTaskForEdit}
          users={users}
          onClose={() => setSelectedTaskForEdit(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {isCreateTaskModalOpen && (
        <CreateTaskModal
          users={users}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {isMyAccountModalOpen && (
        <MyAccountModal onClose={() => setIsMyAccountModalOpen(false)} />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
