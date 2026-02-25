const USERS_KEY = 'cc_users';
const AUTH_KEY = 'cc_auth';
const boothsKey = (userId) => `cc_booths_${userId}`;
const ordersKey = (boothId) => `cc_orders_${boothId}`;

function get(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  // Users
  getUsers() { return get(USERS_KEY, []); },
  saveUsers(users) { set(USERS_KEY, users); },
  findUser(username) { return this.getUsers().find(u => u.username === username); },
  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },

  // Auth
  getAuth() { return get(AUTH_KEY, null); },
  setAuth(auth) { set(AUTH_KEY, auth); },
  clearAuth() { localStorage.removeItem(AUTH_KEY); },

  // Booths
  getBooths(userId) { return get(boothsKey(userId), []); },
  saveBooths(userId, booths) { set(boothsKey(userId), booths); },
  getBooth(userId, boothId) {
    return this.getBooths(userId).find(b => b.id === boothId) || null;
  },
  addBooth(userId, booth) {
    const booths = this.getBooths(userId);
    booths.push(booth);
    this.saveBooths(userId, booths);
  },
  updateBooth(userId, boothId, updates) {
    const booths = this.getBooths(userId);
    const idx = booths.findIndex(b => b.id === boothId);
    if (idx !== -1) {
      booths[idx] = { ...booths[idx], ...updates };
      this.saveBooths(userId, booths);
    }
  },
  deleteBooth(userId, boothId) {
    const booths = this.getBooths(userId).filter(b => b.id !== boothId);
    this.saveBooths(userId, booths);
    localStorage.removeItem(ordersKey(boothId));
  },

  // Orders
  getOrders(boothId) { return get(ordersKey(boothId), []); },
  saveOrders(boothId, orders) { set(ordersKey(boothId), orders); },
  addOrder(boothId, order) {
    const orders = this.getOrders(boothId);
    orders.unshift(order);
    this.saveOrders(boothId, orders);
  },
  updateOrder(boothId, orderId, updatedOrder) {
    const orders = this.getOrders(boothId);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...updatedOrder };
      this.saveOrders(boothId, orders);
    }
  },
  deleteOrder(boothId, orderId) {
    const orders = this.getOrders(boothId).filter(o => o.id !== orderId);
    this.saveOrders(boothId, orders);
  },
};
