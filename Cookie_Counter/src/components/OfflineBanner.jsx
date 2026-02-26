import { useOffline } from '../hooks/useOffline';
import { useBooth } from '../context/BoothContext';

export default function OfflineBanner() {
  const { isOffline } = useOffline();
  const { pendingCount } = useBooth();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={`offline-banner ${isOffline ? 'offline' : 'syncing'}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {isOffline ? (
          <>
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0122.56 9" />
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
            <path d="M8.53 16.11a6 6 0 016.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </>
        ) : (
          <>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </>
        )}
      </svg>
      <span>
        {isOffline
          ? 'Offline — orders will sync when you reconnect'
          : `Syncing ${pendingCount} pending order${pendingCount !== 1 ? 's' : ''}...`}
      </span>
      {pendingCount > 0 && isOffline && (
        <span className="offline-banner-count">{pendingCount}</span>
      )}
    </div>
  );
}
