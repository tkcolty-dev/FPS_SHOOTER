import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const LAST_CHECK_KEY = 'msg-last-check';
const LAST_DING_KEY = 'msg-last-ding';

function getLastCheck() {
  return localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString();
}

// Shared AudioContext — unlocked on first user interaction
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Unlock audio on first user tap/click/keydown
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

if (typeof window !== 'undefined') {
  ['click', 'touchstart', 'keydown'].forEach(evt =>
    document.addEventListener(evt, unlockAudio, { once: true, capture: true })
  );
}

// Play Apple iMessage-style tri-tone notification
function playDing() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const notes = [
      { freq: 988, start: 0, dur: 0.12 },
      { freq: 1319, start: 0.14, dur: 0.12 },
      { freq: 1661, start: 0.28, dur: 0.18 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, t + n.start);
      gain.gain.setValueAtTime(0, t + n.start);
      gain.gain.linearRampToValueAtTime(0.25, t + n.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t + n.start + n.dur);
      osc.start(t + n.start);
      osc.stop(t + n.start + n.dur + 0.05);
    }
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
