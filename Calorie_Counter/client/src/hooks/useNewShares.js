import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const SEEN_KEY = 'seen-share-ids';

function getSeenIds() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export function markSharesSeen(shareIds) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(shareIds));
}

export function useNewShares() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['sharing'],
    queryFn: () => api.get('/sharing').then(r => r.data),
    enabled: !!user,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const sharedWithMe = data?.sharedWithMe || [];
  const pendingCount = sharedWithMe.filter(s => s.status === 'pending').length;
  const currentIds = sharedWithMe.map(s => s.id);
  const seenIds = getSeenIds();
  const unseenCount = currentIds.filter(id => !seenIds.includes(id)).length;
  const newCount = Math.max(pendingCount, unseenCount);

  return { newCount, sharedWithMe };
}
