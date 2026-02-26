import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useBooth } from '../context/BoothContext';

export default function ShareToast() {
  const { user } = useAuth();
  const { refreshBooths } = useBooth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!user) return;

    async function poll() {
      try {
        const notes = await api.getNotifications();
        const unseen = notes.find(n => !seenRef.current.has(n.boothId));
        if (unseen) {
          seenRef.current.add(unseen.boothId);
          setNotification(unseen);
          setVisible(true);
          refreshBooths();
          api.markNotificationsSeen().catch(() => {});
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setVisible(false), 4000);
        }
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => { clearInterval(interval); clearTimeout(timerRef.current); };
  }, [user, refreshBooths]);

  function handleClick() {
    setVisible(false);
    clearTimeout(timerRef.current);
    if (notification) {
      navigate(`/booth/${notification.boothId}`);
    }
  }

  function handleDismiss(e) {
    e.stopPropagation();
    setVisible(false);
    clearTimeout(timerRef.current);
  }

  if (!notification) return null;

  return (
    <div
      className={`share-toast ${visible ? 'visible' : ''}`}
      onClick={handleClick}
    >
      <div className="share-toast-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <div className="share-toast-body">
        <div className="share-toast-title">{notification.ownerName} shared a booth</div>
        <div className="share-toast-text">"{notification.boothName}" — tap to view</div>
      </div>
      <button className="share-toast-close" onClick={handleDismiss}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
