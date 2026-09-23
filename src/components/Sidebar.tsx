/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  Clock,
  PlusCircle,
  BarChart3,
  Bell,
  Users,
  ShieldAlert,
  History,
  Settings,
  LogOut,
  Briefcase,
  X,
} from 'lucide-react';
import { RoleBadge } from './Badge';

export type NavTab =
  | 'dashboard'
  | 'all_tasks'
  | 'my_tasks'
  | 'pending_approvals'
  | 'create_task'
  | 'reports'
  | 'notifications'
  | 'users'
  | 'permissions'
  | 'activity_log'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingApprovalsCount: number;
  unreadNotificationsCount: number;
  isApproverOnAnyTask?: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenMyAccount: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingApprovalsCount,
  unreadNotificationsCount,
  isApproverOnAnyTask,
  isOpenMobile,
  onCloseMobile,
  onOpenMyAccount,
}) => {
  const { user, isAdmin, hasPermission, logout } = useAuth();

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: isAdmin ? 'Admin Dashboard' : 'My Dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: 'all_tasks' as NavTab,
      label: 'All Office Tasks',
      icon: CheckSquare,
      show: isAdmin || hasPermission('VIEW_ALL_TASKS'),
    },
    {
      id: 'my_tasks' as NavTab,
      label: 'My Tasks',
      icon: ListTodo,
      show: true,
    },
    {
      id: 'pending_approvals' as NavTab,
      label: 'Pending Approvals',
      icon: Clock,
      badge: pendingApprovalsCount,
      show: isAdmin || hasPermission('APPROVE_TASK') || !!isApproverOnAnyTask || pendingApprovalsCount > 0,
    },
    {
      id: 'create_task' as NavTab,
      label: 'Create New Task',
      icon: PlusCircle,
      highlight: true,
      show: hasPermission('CREATE_TASK'),
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports & Export',
      icon: BarChart3,
      show: hasPermission('VIEW_REPORTS'),
    },
    {
      id: 'notifications' as NavTab,
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount,
      show: true,
    },
    {
      id: 'users' as NavTab,
      label: 'User Management',
      icon: Users,
      show: hasPermission('MANAGE_USERS'),
    },
    {
      id: 'permissions' as NavTab,
      label: 'Role Permissions',
      icon: ShieldAlert,
      show: hasPermission('MANAGE_PERMISSIONS'),
    },
    {
      id: 'activity_log' as NavTab,
      label: 'Activity Log',
      icon: History,
      show: hasPermission('VIEW_ACTIVITY_LOG'),
    },
    {
      id: 'settings' as NavTab,
      label: 'Office Settings',
      icon: Settings,
      show: hasPermission('MANAGE_SETTINGS'),
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Office Task Manager</h2>
              <p className="text-[10px] text-slate-400 font-medium">PaisaFin Workspace</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : item.highlight
                      ? 'bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 hover:text-indigo-200 border border-indigo-800/40'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </div>

        {/* User footer */}
        {user && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/50">
            <div className="p-2 rounded-lg bg-slate-800/60 mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-white truncate max-w-[130px]">{user.name}</span>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onOpenMyAccount();
                  onCloseMobile();
                }}
                className="flex-1 text-center py-1.5 px-2 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                My Account
              </button>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
