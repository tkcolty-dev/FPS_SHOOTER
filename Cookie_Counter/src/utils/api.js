import { syncQueue } from './syncQueue';
import { storage } from './storage';

const API = '/api';

function getToken() {
  return localStorage.getItem('cc_token');
}

function setToken(token) {
  if (token) localStorage.setItem('cc_token', token);
  else localStorage.removeItem('cc_token');
}

function isNetworkError(err) {
  return err instanceof TypeError && err.message.includes('fetch');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Wrapper for read operations that falls back to cached data
async function readWithFallback(path, cacheKey, cacheFallback, options) {
  try {
    const data = await request(path, options);
    return data;
  } catch (err) {
    if (isNetworkError(err) && cacheFallback) {
      return cacheFallback();
    }
    throw err;
  }
}

export const api = {
  // Auth
  register: (name, username, password) =>
    request('/auth/register', { method: 'POST', body: { name, username, password } }),
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }).catch(() => {}),

  // Token management
  getToken,
  setToken,

  // Booths
  getBooths: () => request('/booths'),
  createBooth: (data) => request('/booths', { method: 'POST', body: data }),
  getBooth: (id) => request(`/booths/${id}`),
  updateBooth: (id, data) => request(`/booths/${id}`, { method: 'PATCH', body: data }),
  deleteBooth: (id) => request(`/booths/${id}`, { method: 'DELETE' }),
  restockBooth: (id, inventory) =>
    request(`/booths/${id}/restock`, { method: 'POST', body: { inventory } }),

  // Orders
  getOrders: (boothId) => request(`/booths/${boothId}/orders`),
  addOrder: (boothId, data) => request(`/booths/${boothId}/orders`, { method: 'POST', body: data }),
  updateOrder: (boothId, orderId, data) =>
    request(`/booths/${boothId}/orders/${orderId}`, { method: 'PUT', body: data }),
  deleteOrder: (boothId, orderId) =>
    request(`/booths/${boothId}/orders/${orderId}`, { method: 'DELETE' }),

  // Members
  getMembers: (boothId) => request(`/booths/${boothId}/members`),
  addMember: (boothId, username) =>
    request(`/booths/${boothId}/members`, { method: 'POST', body: { username } }),
  removeMember: (boothId, memberId) =>
    request(`/booths/${boothId}/members/${memberId}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: () => request('/booths/notifications'),
  markNotificationsSeen: () => request('/booths/notifications/seen', { method: 'POST' }),

  // Offline helpers
  isNetworkError,
  request,
};
