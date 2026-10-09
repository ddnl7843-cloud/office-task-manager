import { BrandingSettings } from './types';

export const DEFAULT_BRANDING: Omit<BrandingSettings, 'logoUrl'> & { logoUrl: string } = {
  appName: 'PaisaFin Task Manager',
  companyName: 'PaisaFin',
  logoUrl: '/office-task-icon.png',
};

export function applyBranding(branding: BrandingSettings): void {
  document.title = branding.appName;
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', branding.appName);
  document.querySelector('meta[name="description"]')?.setAttribute(
    'content',
    `${branding.companyName} task management and workflow portal.`
  );
  document.querySelector('meta[property="og:description"]')?.setAttribute(
    'content',
    `${branding.companyName} task management and workflow portal.`
  );
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = branding.logoUrl || DEFAULT_BRANDING.logoUrl;
  });
}
