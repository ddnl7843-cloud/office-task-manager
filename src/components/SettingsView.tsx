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
  Send,
  ExternalLink,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email / SMTP status & test states
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean;
    host: string;
    port: string;
    user: string | null;
    fromName: string;
    fromEmail: string;
  } | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [settingsData, emailData] = await Promise.all([
          api.getSettings(),
          api.getEmailStatus().catch(() => null),
        ]);
        setSettings(settingsData);
        if (emailData) {
          setEmailStatus(emailData);
          if (emailData.user) {
            setTestEmailRecipient(emailData.user);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) return;
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await api.sendTestEmail(testEmailRecipient.trim());
      setTestEmailResult(res);
    } catch (err: unknown) {
      setTestEmailResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to send test email',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

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
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `office_tasks_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download backup');
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

          {/* Test Email Dispatcher */}
          <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              <span>Verify & Test Webmail Dispatch</span>
            </h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter recipient email"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail || !testEmailRecipient.trim()}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
              >
                {isSendingTestEmail ? (
                  <span>Connecting & Sending...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </div>

            {testEmailResult && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testEmailResult.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testEmailResult.message}</p>
                  {!testEmailResult.success && (
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Check your Hostinger Webmail password. To configure, open the Secrets panel in AI Studio or your server environment variables and set <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">SMTP_PASS</code>.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Database Backup & Export */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Zero-Cost Local Database Persistence</span>
          </h3>

          <p className="text-xs text-slate-600">
            All office tasks, team users, comments, permissions, and audit logs are safely stored in the server file storage (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">data/office_tasks_db.json</code>). You can download an offline JSON backup snapshot at any time.
          </p>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-300"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Full Database Backup (JSON)</span>
          </button>
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
