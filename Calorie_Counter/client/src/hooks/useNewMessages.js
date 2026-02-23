import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const LAST_CHECK_KEY = 'msg-last-check';
const LAST_DING_KEY = 'msg-last-ding';

function getLastCheck() {
  return localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString();
}

// Preload notification sound (real audio file)
let notificationAudio = null;

function getNotificationAudio() {
  if (!notificationAudio) {
    notificationAudio = new Audio('/notification.m4a');
    notificationAudio.volume = 0.7;
    // Preload so it's ready when needed
    notificationAudio.load();
  }
  return notificationAudio;
}

// Unlock audio on first user tap/click/keydown (needed for mobile browsers)
function unlockAudio() {
  try {
    const audio = getNotificationAudio();
    // Play and immediately pause to unlock on iOS/Android
    const p = audio.play();
    if (p) p.then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  } catch {}
}

if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown'].forEach(evt =>
    document.addEventListener(evt, unlockAudio, { once: true, capture: true })
  );
}

function playDing() {
  try {
    const audio = getNotificationAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

export function markMessagesRead() {
  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
}

export function useNewMessages() {
  const { user } = useAuth();
  const prevCount = useRef(0);
  const [toastMessage, setToastMessage] = useState(null);

  const { data } = useQuery({
    queryKey: ['new-messages', getLastCheck()],
    queryFn: () => api.get('/sharing/new-messages', { params: { since: getLastCheck() } }).then(r => r.data),
    enabled: !!user,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const count = data?.count || 0;
  const latestMsg = data?.messages?.[0] || null;

  // When a new message arrives, ding and set the toast message
  useEffect(() => {
    if (count > prevCount.current && prevCount.current >= 0) {
      const lastDing = localStorage.getItem(LAST_DING_KEY);
      const latestTs = latestMsg?.created_at;
      if (latestTs && latestTs !== lastDing) {
        playDing();
        localStorage.setItem(LAST_DING_KEY, latestTs);
        setToastMessage(latestMsg);
      }
    }
    prevCount.current = count;
  }, [count, latestMsg]);

  const clearCount = useCallback(() => {
    markMessagesRead();
  }, []);

  return { newMessageCount: count, latestMessage: toastMessage, clearCount };
}
