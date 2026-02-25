import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { storage } from '../utils/storage';
import { useAuth } from './AuthContext';
import { COOKIE_TYPES, PRICE_PER_BOX } from '../data/cookies';

const BoothContext = createContext(null);

export function BoothProvider({ children }) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);

  const booths = useMemo(() => {
    void version;
    return user ? storage.getBooths(user.id) : [];
  }, [user, version]);

  const createBooth = useCallback((name, startingCash, inventory) => {
    if (!user) return null;
    const booth = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      startingCash: Number(startingCash) || 0,
      inventory,
      createdAt: Date.now(),
    };
    storage.addBooth(user.id, booth);
    refresh();
    return booth;
  }, [user, refresh]);

  const getBooth = useCallback((boothId) => {
    if (!user) return null;
    return storage.getBooth(user.id, boothId);
  }, [user, version]);

  const deleteBooth = useCallback((boothId) => {
    if (!user) return;
    storage.deleteBooth(user.id, boothId);
    refresh();
  }, [user, refresh]);

  const getOrders = useCallback((boothId) => {
    return storage.getOrders(boothId);
  }, [version]);

  const addOrder = useCallback((boothId, order) => {
    storage.addOrder(boothId, order);
    refresh();
  }, [refresh]);

  const updateOrder = useCallback((boothId, orderId, updatedOrder) => {
    storage.updateOrder(boothId, orderId, updatedOrder);
    refresh();
  }, [refresh]);

  const deleteOrder = useCallback((boothId, orderId) => {
    storage.deleteOrder(boothId, orderId);
    refresh();
  }, [refresh]);

  const getBoothStats = useCallback((boothId) => {
    const booth = user ? storage.getBooth(user.id, boothId) : null;
    if (!booth) return null;

    const orders = storage.getOrders(boothId);
    const stats = {
      totalBoxesSold: 0,
      totalBoxesDonated: 0,
      totalCashDonations: 0,
      totalRevenue: 0,
      orderCount: orders.length,
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

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const pc = stats.perCookie[item.cookieType];
        if (!pc) return;
        if (item.isDonation) {
          pc.donated += item.quantity;
          stats.totalBoxesDonated += item.quantity;
        } else {
          pc.sold += item.quantity;
          stats.totalBoxesSold += item.quantity;
        }
        pc.revenue += item.quantity * PRICE_PER_BOX;
      });
      stats.totalCashDonations += order.cashDonation || 0;
    });

    stats.totalRevenue =
      (stats.totalBoxesSold + stats.totalBoxesDonated) * PRICE_PER_BOX +
      stats.totalCashDonations;

    stats.cashOnHand = booth.startingCash + stats.totalRevenue;

    // Add remaining inventory
    COOKIE_TYPES.forEach(c => {
      const pc = stats.perCookie[c.id];
      pc.totalMoved = pc.sold + pc.donated;
      pc.remaining = pc.starting - pc.totalMoved;
    });

    return stats;
  }, [user, version]);

  return (
    <BoothContext.Provider value={{
      booths,
      createBooth,
      getBooth,
      deleteBooth,
      getOrders,
      addOrder,
      updateOrder,
      deleteOrder,
      getBoothStats,
      refresh,
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
