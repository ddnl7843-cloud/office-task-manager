import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export const PwaUpdatePrompt: React.FC = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const applyingUpdate = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let checkForUpdate: (() => void) | undefined;
    let updateInterval: number | undefined;
    const updateAvailable = () => {
      if (!disposed && registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
    };
    const watchInstallingWorker = () => {
      const installingWorker = registration?.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') updateAvailable();
      });
    };
    const handleControllerChange = () => {
      if (applyingUpdate.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((newRegistration) => {
        registration = newRegistration;
        if (disposed) return;
        updateAvailable();
        registration.addEventListener('updatefound', watchInstallingWorker);

        checkForUpdate = () => {
          if (!registration || document.visibilityState !== 'visible') return;
          void registration.update().catch((error: unknown) => {
            console.warn('Could not check for an app update', error);
          });
        };
        window.addEventListener('focus', checkForUpdate);
        window.addEventListener('online', checkForUpdate);
        updateInterval = window.setInterval(checkForUpdate, 5 * 60 * 1000);
        checkForUpdate();
      })
      .catch((error: unknown) => {
        console.error('Could not register app update support', error);
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      registration?.removeEventListener('updatefound', watchInstallingWorker);
      if (checkForUpdate) {
        window.removeEventListener('focus', checkForUpdate);
        window.removeEventListener('online', checkForUpdate);
      }
      if (updateInterval !== undefined) window.clearInterval(updateInterval);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    applyingUpdate.current = true;
    setUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!waitingWorker) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-3 shadow-xl sm:bottom-5">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">A new app update is ready</p>
        <p className="mt-0.5 text-xs text-slate-600">Your current version stays active until you update.</p>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        disabled={updating}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
        {updating ? 'Updating…' : 'Update now'}
      </button>
    </div>
  );
};
