import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const LAST_CHECK_KEY = 'msg-last-check';

function getLastCheck() {
  return localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString();
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

  // When a new message arrives, show toast
  useEffect(() => {
    if (count > prevCount.current && prevCount.current >= 0 && latestMsg) {
      setToastMessage(latestMsg);
    }
    prevCount.current = count;
  }, [count, latestMsg]);

  const clearCount = useCallback(() => {
    markMessagesRead();
  }, []);

  return { newMessageCount: count, latestMessage: toastMessage, clearCount };
}
