/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, Plus, UserCircle, LogOut } from 'lucide-react';
import { RoleBadge } from './Badge';

interface HeaderProps {
  title: string;
  subtitle?: string;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenCreateTask: () => void;
  onOpenMyAccount: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenCreateTask,
  onOpenMyAccount,
  onToggleMobileMenu,
}) => {
  const { user, hasPermission, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right side: quick actions, notifications, user */}
      <div className="flex items-center gap-2 sm:gap-3">
        {hasPermission('CREATE_TASK') && (
          <button
            onClick={onOpenCreateTask}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        )}

        {/* Notifications trigger */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

        {/* User profile button */}
        {user && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMyAccount}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 text-left transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center justify-center border border-indigo-200">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-slate-900 leading-none">{user.name}</p>
                <div className="mt-1">
                  <RoleBadge role={user.role} />
                </div>
              </div>
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors hidden sm:block"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
