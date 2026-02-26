import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { COOKIE_TYPES, PRICE_PER_BOX } from '../data/cookies';

const BoothContext = createContext(null);

export function BoothProvider({ children }) {
  const { user } = useAuth();
  const [booths, setBooths] = useState([]);
  const [boothsLoading, setBoothsLoading] = useState(false);

  const refreshBooths = useCallback(async () => {
    if (!user) { setBooths([]); return; }
    setBoothsLoading(true);
    try {
      const data = await api.getBooths();
      setBooths(data);
    } catch {
      setBooths([]);
    } finally {
      setBoothsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshBooths();
  }, [refreshBooths]);

  const createBooth = useCallback(async (name, startingCash, inventory) => {
    const booth = await api.createBooth({ name, startingCash, inventory });
    await refreshBooths();
    return booth;
  }, [refreshBooths]);

  const fetchBooth = useCallback(async (boothId) => {
    return api.getBooth(boothId);
  }, []);

  const deleteBooth = useCallback(async (boothId) => {
    await api.deleteBooth(boothId);
    await refreshBooths();
  }, [refreshBooths]);

  const fetchOrders = useCallback(async (boothId) => {
    return api.getOrders(boothId);
  }, []);

  const addOrder = useCallback(async (boothId, orderData) => {
    return api.addOrder(boothId, orderData);
  }, []);

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
      fetchBooth,
      deleteBooth,
      fetchOrders,
      addOrder,
      updateOrder,
      deleteOrder,
      fetchMembers,
      addMember,
      removeMember,
      computeStats,
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
