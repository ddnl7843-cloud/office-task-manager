import React, { useState } from 'react';
import { Share2 } from 'lucide-react';

interface ShareAppButtonProps {
  appName: string;
  className?: string;
  compact?: boolean;
}

export const ShareAppButton: React.FC<ShareAppButtonProps> = ({
  appName,
  className = '',
  compact = false,
}) => {
  const [status, setStatus] = useState('');

  const shareApp = async () => {
    const appUrl = window.location.origin;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: appName, text: `Open ${appName}`, url: appUrl });
        setStatus('Shared');
        window.setTimeout(() => setStatus(''), 2000);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(appUrl);
      setStatus('Link copied');
    } catch (error) {
      console.error('Could not share or copy the app link', error);
      setStatus('Sharing unavailable');
    }
    window.setTimeout(() => setStatus(''), 2500);
  };

  return (
    <button
      type="button"
      onClick={() => void shareApp()}
      aria-label="Share app link"
      title={`Share ${appName}`}
      className={className}
    >
      <Share2 className="h-4 w-4" />
      {!compact && <span>{status || 'Share app'}</span>}
      {compact && status && <span className="sr-only">{status}</span>}
    </button>
  );
};
