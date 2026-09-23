/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppNotification, Task } from '../types';
import { api } from '../api';
import {
  Bell,
  CheckCircle,
  Clock,
  AlertCircle,
  HelpCircle,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface NotificationsViewProps {
  notifications: AppNotification[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onRefreshNotifications: () => Promise<void>;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  tasks,
  onSelectTask,
  onRefreshNotifications,
}) => {
  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await onRefreshNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif.id);
        await onRefreshNotifications();
      } catch (err) {
        console.error(err);
      }
    }

    if (notif.taskId) {
      const matched = tasks.find((t) => t.id === notif.taskId);
      if (matched) {
        onSelectTask(matched);
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'COMPLETION_REQUESTED':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'TASK_APPROVED':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'TASK_REJECTED':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'HELP_REQUESTED':
        return <HelpCircle className="w-4 h-4 text-amber-600" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Task Notifications</h2>
            <p className="text-xs text-slate-500">
              Live alerts for task assignments, completion reviews, help requests, and comments
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-slate-500 px-4">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">No notifications yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              You will receive automatic alerts here when tasks are assigned, updated, or reviewed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  notif.read ? 'hover:bg-slate-50' : 'bg-indigo-50/30 hover:bg-indigo-50/50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    {getIcon(notif.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-xs ${
                          notif.read ? 'font-medium text-slate-800' : 'font-bold text-slate-900'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {notif.taskId && (
                  <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 flex-shrink-0">
                    <span>Open Task</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
