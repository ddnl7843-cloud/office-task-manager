import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, ImagePlus, RotateCcw, Save } from 'lucide-react';
import { api } from '../api';
import { DEFAULT_BRANDING } from '../branding';
import { BrandingSettings } from '../types';

interface BrandingSettingsViewProps {
  branding: BrandingSettings;
  onSaved: (branding: BrandingSettings) => void;
}

const MAX_LOGO_SIZE = 1024 * 1024;

export const BrandingSettingsView: React.FC<BrandingSettingsViewProps> = ({ branding, onSaved }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [appName, setAppName] = useState(branding.appName);
  const [companyName, setCompanyName] = useState(branding.companyName);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [resetLogo, setResetLogo] = useState(false);
  const [resetBranding, setResetBranding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAppName(branding.appName);
    setCompanyName(branding.companyName);
  }, [branding.appName, branding.companyName]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSaved(false);
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type) || file.size > MAX_LOGO_SIZE) {
      setError('Choose a PNG, JPEG, or WebP image up to 1 MB. SVG files are not supported.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Could not preview this image. Choose another file.');
        return;
      }
      setLogoDataUrl(reader.result);
      setResetLogo(false);
      setResetBranding(false);
    };
    reader.onerror = () => setError('Could not read this image. Choose another file.');
    reader.readAsDataURL(file);
  };

  const saveBranding = async (resetAll = false) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await api.updateBranding({
        appName: resetAll ? DEFAULT_BRANDING.appName : appName,
        companyName: resetAll ? DEFAULT_BRANDING.companyName : companyName,
        ...(logoDataUrl && !resetAll ? { logoDataUrl } : {}),
        ...(resetLogo || resetAll ? { resetLogo: true } : {}),
        ...(resetAll ? { resetBranding: true } : {}),
      });
      onSaved(response.branding);
      setLogoDataUrl(null);
      setResetLogo(false);
      setResetBranding(false);
      if (fileInput.current) fileInput.current.value = '';
      setSaved(true);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void saveBranding();
  };

  const previewLogo = logoDataUrl || (resetLogo || resetBranding
    ? DEFAULT_BRANDING.logoUrl
    : branding.logoUrl || DEFAULT_BRANDING.logoUrl);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Branding Settings</h2>
            <p className="text-xs text-slate-500">Set the application name, company name, and logo.</p>
          </div>
        </div>
      </div>

      {saved && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Branding settings saved.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Company and application</h3>
          <label className="block text-xs font-semibold text-slate-700">
            Application name
            <input required maxLength={80} value={appName} onChange={(event) => { setAppName(event.target.value); setResetBranding(false); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-slate-900" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Company name
            <input required maxLength={80} value={companyName} onChange={(event) => { setCompanyName(event.target.value); setResetBranding(false); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-slate-900" />
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Application logo</h3>
            <p className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP; maximum 1 MB. SVG and executable formats are not accepted.</p>
          </div>
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <img src={previewLogo} alt="Brand logo preview" className="max-h-28 max-w-full object-contain" />
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="sr-only" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ImagePlus className="h-4 w-4" />
              Choose logo
            </button>
            <button type="button" onClick={() => { setLogoDataUrl(null); setResetLogo(true); setResetBranding(false); if (fileInput.current) fileInput.current.value = ''; }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" />
              Restore default logo
            </button>
          </div>
        </section>

        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" disabled={saving} onClick={() => { setAppName(DEFAULT_BRANDING.appName); setCompanyName(DEFAULT_BRANDING.companyName); setLogoDataUrl(null); setResetLogo(true); setResetBranding(true); if (fileInput.current) fileInput.current.value = ''; }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Reset to default branding
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save branding'}
          </button>
        </div>
      </form>
    </div>
  );
};
