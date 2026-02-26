const QUEUE_KEY = 'cc_sync_queue';

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const syncQueue = {
  enqueue(action) {
    const entry = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...action,
      createdAt: new Date().toISOString(),
    };
    const queue = getQueue();
    queue.push(entry);
    saveQueue(queue);
    return entry;
  },

  dequeue(id) {
    const queue = getQueue().filter((item) => item.id !== id);
    saveQueue(queue);
  },

  getPending() {
    return getQueue();
  },

  async flush(apiRequest) {
    const queue = getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        await apiRequest(item);
        syncQueue.dequeue(item.id);
        synced++;
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  },
};
