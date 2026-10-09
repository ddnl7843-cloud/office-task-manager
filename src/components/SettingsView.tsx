/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { OfficeSettings } from '../types';
import { api } from '../api';
import {
  Settings,
  Building2,
  Bell,
  Clock,
  Save,
  Download,
  CheckCircle2,
  AlertCircle,
  Database,
  Mail,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Email service configuration status (SMTP credentials remain server-side).
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    host: string;
    port: string;
    fromName: string;
    fromEmail: string;
  } | null>(null);


  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [settingsData, emailData] = await Promise.all([
          api.getSettings(),
          api.getEmailStatus().catch(() => null),
        ]);
        setSettings(settingsData);
        if (emailData) setEmailStatus(emailData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setError(null);
    try {
      const res = await api.updateSettings(settings);
      setSettings(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const db = await api.getRawDatabase();
      const backupBlob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const backupUrl = URL.createObjectURL(backupBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = backupUrl;
      downloadAnchor.download = `paisafin_task_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(backupUrl), 1000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download backup');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile || !window.confirm('This replaces the current app data with the selected backup. Continue only if the backup is complete and trusted.')) {
      return;
    }
    setIsRestoring(true);
    try {
      const backup = JSON.parse(await restoreFile.text()) as unknown;
      const result = await api.restoreDatabase(backup);
      alert(result.message);
      window.location.reload();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-semibold">Loading office settings...</p>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Office Workspace Settings</h2>
            <p className="text-xs text-slate-500">
              Configure office profile, alert thresholds, automation policies, and database backups
            </p>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Office settings updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Office Profile */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Organization Profile</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Office / Company Name
              </label>
              <input
                type="text"
                value={settings.officeName}
                onChange={(e) => setSettings({ ...settings, officeName: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Company Code</label>
              <input
                type="text"
                value={settings.companyCode}
                onChange={(e) => setSettings({ ...settings, companyCode: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Working Schedule</label>
              <select
                value={settings.workingDays}
                onChange={(e) => setSettings({ ...settings, workingDays: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="Monday - Friday">Monday - Friday (5 Days)</option>
                <option value="Monday - Saturday">Monday - Saturday (6 Days)</option>
                <option value="All 7 Days">All 7 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Overdue Days Tolerance Threshold
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={settings.overdueAlertDaysThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    overdueAlertDaysThreshold: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                0 days means marked overdue immediately after deadline passes
              </span>
            </div>
          </div>
        </div>

        {/* System Automation & Alerts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" />
            <span>Automatic In-App Notifications</span>
          </h3>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoNotifyAssignee}
                onChange={(e) =>
                  setSettings({ ...settings, autoNotifyAssignee: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
              />
              <div>
                <span className="font-semibold text-slate-800">
                  Notify Employee upon Task Assignment
                </span>
                <p className="text-[11px] text-slate-500">
                  Automatically alert assigned staff member when an admin creates a task for them
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoNotifyApproverOnCompletion}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoNotifyApproverOnCompletion: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600"
              />
              <div>
                <span className="font-semibold text-slate-800">
                  Notify Approver when Employee Requests Completion
                </span>
                <p className="text-[11px] text-slate-500">
                  Trigger an immediate review alert when task progress reaches 100%
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Hostinger Webmail & SMTP Integration */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Hostinger Webmail Integration (paisafin.com)</span>
            </h3>
            {emailStatus?.configured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SMTP Active & Configured</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Awaiting SMTP Password in .env / Secrets</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Send automated, professional notification emails for task assignment, deadline alerts, employee help requests, and task completion approvals directly through your Hostinger <strong>@paisafin.com</strong> domain at <strong>zero additional cost</strong>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500">SMTP Server Host</span>
              <span className="font-mono font-semibold text-slate-800">
                {emailStatus?.host || 'smtp.hostinger.com'}:{emailStatus?.port || '465'} (SSL)
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500">Default Sender</span>
              <span className="font-mono font-semibold text-slate-800">
                {emailStatus?.fromEmail || 'notifications@paisafin.com'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500">Pricing / Quota</span>
              <span className="font-semibold text-emerald-700">
                100% Free (Hostinger Webmail)
              </span>
            </div>
          </div>

        </div>

        {/* Database Backup & Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Zero-Cost Local Database Persistence</span>
          </h3>

          <p className="text-xs text-slate-600">
            All office data is stored in the server data folder. Download a full JSON backup before redeploying or changing storage. It includes password hashes (never plain-text passwords), so keep the file private and do not commit or share it.
          </p>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-300"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Full Database Backup (JSON)</span>
          </button>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-xs font-semibold text-slate-700">
              Restore from a trusted backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={event => setRestoreFile(event.target.files?.[0] || null)}
                className="mt-1.5 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRestoreBackup()}
              disabled={!restoreFile || isRestoring}
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRestoring ? 'Restoring backup…' : 'Restore selected backup'}
            </button>
            <p className="text-[11px] text-rose-700">
              Restoring replaces all current app records and signs everyone out. A server-side safety copy is saved before replacement. Users from older backups without password hashes may need an admin password reset.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
