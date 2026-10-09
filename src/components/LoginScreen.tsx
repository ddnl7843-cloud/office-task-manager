/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Smartphone, Download, UserRound } from 'lucide-react';
import { getDeviceType, getMobileInstallSteps, isAppInstalled } from '../utils/mobileInstall';
import { api } from '../api';
import { BrandingSettings } from '../types';
import { applyBranding, DEFAULT_BRANDING } from '../branding';
import { ShareAppButton } from './ShareAppButton';

export const LoginScreen: React.FC = () => {
  const { login, error, setError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const deviceType = getDeviceType();
  const installSteps = getMobileInstallSteps(deviceType);
  const showInstallHelp = !isAppInstalled();
  const appLink = typeof window !== 'undefined' ? window.location.origin : 'https://fintask.paisafin.com';

  useEffect(() => {
    let isMounted = true;
    api.getBranding().then((currentBranding) => {
      if (isMounted) {
        setBranding(currentBranding);
        applyBranding(currentBranding);
      }
    }).catch((brandingError: unknown) => {
      console.error('Could not load application branding', brandingError);
    });
    return () => { isMounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch {
      // Handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSignupError('');
    setSignupSuccess('');
    if (signupPassword !== signupPasswordConfirm) {
      setSignupError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.requestSignup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });
      setSignupSuccess(response.message);
      setEmail(signupEmail.trim());
      setPassword('');
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupPasswordConfirm('');
      setMode('signin');
    } catch (signupRequestError: unknown) {
      setSignupError(signupRequestError instanceof Error ? signupRequestError.message : 'Could not send signup request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <img src={branding.logoUrl || DEFAULT_BRANDING.logoUrl} alt="" className="h-12 w-auto shrink-0 object-contain" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{branding.appName}</h1>
            <p className="text-xs text-slate-500 font-medium">{branding.companyName} Team Workflow Portal</p>
          </div>
        </div>
        <h2 className="mt-6 text-center text-xl font-semibold tracking-tight text-slate-900">
          {mode === 'signin' ? 'Sign in to your workplace account' : 'Request a workplace account'}
        </h2>
        <p className="mt-1 text-center text-sm text-slate-600">
          Secure task assignment, progress tracking & review portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 flex justify-end">
          <ShareAppButton
            appName={branding.appName}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
          />
        </div>

        {showInstallHelp && (
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-slate-700 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
            <Smartphone className="w-4 h-4" />
            <span>Install from mobile link</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Open this app in your mobile browser and install it without the Play Store.
          </p>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {installSteps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <a
              href={appLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" />
              Open app link
            </a>
          </div>
        </div>
        )}

        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {signupSuccess && (
            <div role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
              {signupSuccess}
            </div>
          )}
          {mode === 'signin' && error && (
            <div className="mb-5 rounded-lg bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Authentication Error</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {mode === 'signin' ? <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@paisafin.com"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-slate-300 pl-10 pr-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-60 transition-colors"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form> : (
            <form className="space-y-4" onSubmit={handleSignup}>
              <div className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
                <p>New accounts are reviewed by an administrator. You can sign in after your request is approved.</p>
              </div>
              {signupError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{signupError}</div>}
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Full name
                <input required maxLength={100} autoComplete="name" value={signupName} onChange={event => setSignupName(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case text-slate-900" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Work email
                <input required type="email" maxLength={254} autoComplete="email" value={signupEmail} onChange={event => setSignupEmail(event.target.value)} placeholder="name@paisafin.com" className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case text-slate-900" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password
                <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={signupPassword} onChange={event => setSignupPassword(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case text-slate-900" />
                <span className="mt-1 block text-[11px] font-normal normal-case text-slate-500">Use at least 10 characters.</span>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Confirm password
                <input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={signupPasswordConfirm} onChange={event => setSignupPasswordConfirm(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm normal-case text-slate-900" />
              </label>
              <button type="submit" disabled={isSubmitting} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                {isSubmitting ? 'Sending request…' : 'Request account approval'}
              </button>
            </form>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setSignupError('');
                setSignupSuccess('');
                setError(null);
              }}
              className="font-semibold text-indigo-700 hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            {branding.companyName} &bull; {branding.appName}
          </p>
        </div>
      </div>
    </div>
  );
};
