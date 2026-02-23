import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const LAST_CHECK_KEY = 'msg-last-check';
const LAST_DING_KEY = 'msg-last-ding';

function getLastCheck() {
  return localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString();
}

// Play a short notification ding using Web Audio API
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
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
