import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { COOKIE_TYPES, PRICE_PER_BOX } from '../data/cookies';
import { storage } from '../utils/storage';
import { syncQueue } from '../utils/syncQueue';

const BoothContext = createContext(null);

// Cache keys for offline data
const CACHE_BOOTHS = 'cc_cache_booths';
const cacheOrdersKey = (boothId) => `cc_cache_orders_${boothId}`;
const cacheBoothKey = (boothId) => `cc_cache_booth_${boothId}`;

function cacheGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[cacheSet] localStorage write failed (possibly quota exceeded):', err);
  }
}

export function BoothProvider({ children }) {
  const { user } = useAuth();
  const [booths, setBooths] = useState([]);
  const [boothsLoading, setBoothsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => syncQueue.getPending().length);
  const flushingRef = useRef(false);

  const updatePendingCount = useCallback(() => {
    setPendingCount(syncQueue.getPending().length);
  }, []);

  const refreshBooths = useCallback(async () => {
    if (!user) { setBooths([]); return; }
    setBoothsLoading(true);
    try {
      const data = await api.getBooths();
      setBooths(data);
      cacheSet(CACHE_BOOTHS, data);
    } catch (err) {
      if (api.isNetworkError(err)) {
        setBooths(cacheGet(CACHE_BOOTHS, []));
      } else {
        setBooths([]);
      }
    } finally {
      setBoothsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshBooths();
  }, [refreshBooths]);

  const createBooth = useCallback(async (name, startingCash, inventory, thumbnail) => {
    const booth = await api.createBooth({ name, startingCash, inventory, thumbnail });
    await refreshBooths();
    return booth;
  }, [refreshBooths]);

  const updateBooth = useCallback(async (boothId, data) => {
    await api.updateBooth(boothId, data);
    await refreshBooths();
  }, [refreshBooths]);

  const fetchBooth = useCallback(async (boothId) => {
    try {
      const data = await api.getBooth(boothId);
      cacheSet(cacheBoothKey(boothId), data);
      return data;
    } catch (err) {
      if (api.isNetworkError(err)) {
        return cacheGet(cacheBoothKey(boothId), null);
      }
      throw err;
    }
  }, []);

  const deleteBooth = useCallback(async (boothId) => {
    await api.deleteBooth(boothId);
    await refreshBooths();
  }, [refreshBooths]);

  const restockBooth = useCallback(async (boothId, inventory) => {
    const updated = await api.restockBooth(boothId, inventory);
    await refreshBooths();
    return updated;
  }, [refreshBooths]);

  const fetchOrders = useCallback(async (boothId) => {
    try {
      const data = await api.getOrders(boothId);
      // Merge in any pending offline orders not yet synced
      const pending = syncQueue.getPending()
        .filter((p) => p.type === 'addOrder' && p.boothId === boothId)
        .map((p) => p.optimisticOrder);
      const serverIds = new Set(data.map((o) => o.id));
      const offlineOnly = pending.filter((o) => {
        if (!o) return false;
        // Drop if server already has this temp ID
        if (serverIds.has(o.id)) return false;
        // Drop if server has a matching order (same items + timestamp) — synced copy with real ID
        return !data.some((s) =>
          s.createdAt === o.createdAt &&
          JSON.stringify(s.items) === JSON.stringify(o.items)
        );
      });
      const merged = [...offlineOnly, ...data];
      cacheSet(cacheOrdersKey(boothId), merged);
      return merged;
    } catch (err) {
      if (api.isNetworkError(err)) {
        return cacheGet(cacheOrdersKey(boothId), []);
      }
      throw err;
    }
  }, []);

  const addOrder = useCallback(async (boothId, orderData) => {
    try {
      const result = await api.addOrder(boothId, orderData);
      return result;
    } catch (err) {
      if (api.isNetworkError(err)) {
        // Create optimistic order
        const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const optimisticOrder = {
          id: tempId,
          ...orderData,
          createdAt: new Date().toISOString(),
          _pending: true,
        };

        // Enqueue for later sync
        syncQueue.enqueue({
          type: 'addOrder',
          boothId,
          data: orderData,
          optimisticOrder,
        });
        updatePendingCount();

        // Save to local cache
        const cached = cacheGet(cacheOrdersKey(boothId), []);
        cached.unshift(optimisticOrder);
        cacheSet(cacheOrdersKey(boothId), cached);

        return optimisticOrder;
      }
      throw err;
    }
  }, [updatePendingCount]);

  const updateOrder = useCallback(async (boothId, orderId, data) => {
    return api.updateOrder(boothId, orderId, data);
  }, []);

  const deleteOrder = useCallback(async (boothId, orderId) => {
    await api.deleteOrder(boothId, orderId);
  }, []);

  const fetchMembers = useCallback(async (boothId) => {
    return api.getMembers(boothId);
  }, []);

  const addMember = useCallback(async (boothId, username) => {
    return api.addMember(boothId, username);
  }, []);

  const removeMember = useCallback(async (boothId, memberId) => {
    await api.removeMember(boothId, memberId);
  }, []);

  // Flush the sync queue
  const syncNow = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      await syncQueue.flush(async (item) => {
        if (item.type === 'addOrder') {
          await api.request(`/booths/${item.boothId}/orders`, {
            method: 'POST',
            body: item.data,
          });
        }
      });
      updatePendingCount();
    } finally {
      flushingRef.current = false;
    }
  }, [updatePendingCount]);

  // Auto-flush when coming back online
  useEffect(() => {
    const handleOnline = () => {
      syncNow();
    };
    window.addEventListener('online', handleOnline);
    // Also try to flush on mount if we're online and have pending items
    if (navigator.onLine && syncQueue.getPending().length > 0) {
      syncNow();
    }
    return () => window.removeEventListener('online', handleOnline);
  }, [syncNow]);

  const computeStats = useCallback((booth, orders) => {
    if (!booth) return null;

    const stats = {
      totalBoxesSold: 0,
      totalBoxesDonated: 0,
      totalCashDonations: 0,
      totalRevenue: 0,
      orderCount: (orders || []).length,
      perCookie: {},
    };

    COOKIE_TYPES.forEach(c => {
      stats.perCookie[c.id] = {
        starting: booth.inventory[c.id] || 0,
        sold: 0,
        donated: 0,
        revenue: 0,
      };
    });

    (orders || []).forEach(order => {
      (order.items || []).forEach(item => {
        const pc = stats.perCookie[item.cookieType];
        if (item.isDonation) {
          if (pc) pc.donated += item.quantity;
          stats.totalBoxesDonated += item.quantity;
        } else {
          if (pc) pc.sold += item.quantity;
          stats.totalBoxesSold += item.quantity;
        }
        if (pc) pc.revenue += item.quantity * PRICE_PER_BOX;
      });
      stats.totalCashDonations += order.cashDonation || 0;
    });

    stats.totalRevenue =
      (stats.totalBoxesSold + stats.totalBoxesDonated) * PRICE_PER_BOX +
      stats.totalCashDonations;

    stats.cashOnHand = booth.startingCash + stats.totalRevenue;

    COOKIE_TYPES.forEach(c => {
      const pc = stats.perCookie[c.id];
      pc.totalMoved = pc.sold + pc.donated;
      pc.remaining = pc.starting - pc.totalMoved;
    });

    return stats;
  }, []);

  return (
    <BoothContext.Provider value={{
      booths,
      boothsLoading,
      refreshBooths,
      createBooth,
      updateBooth,
      fetchBooth,
      deleteBooth,
      restockBooth,
      fetchOrders,
      addOrder,
      updateOrder,
      deleteOrder,
      fetchMembers,
      addMember,
      removeMember,
      computeStats,
      pendingCount,
      syncNow,
    }}>
      {children}
    </BoothContext.Provider>
  );
}

export function useBooth() {
  const ctx = useContext(BoothContext);
  if (!ctx) throw new Error('useBooth must be inside BoothProvider');
  return ctx;
}
