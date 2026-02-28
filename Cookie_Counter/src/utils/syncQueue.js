const QUEUE_KEY = 'cc_sync_queue';
const DEAD_LETTER_KEY = 'cc_sync_dead_letter';
const MAX_RETRIES = 5;

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

function getDeadLetters() {
  try {
    return JSON.parse(localStorage.getItem(DEAD_LETTER_KEY)) || [];
  } catch {
    return [];
  }
}

function addDeadLetter(item) {
  const deadLetters = getDeadLetters();
  deadLetters.push({ ...item, failedAt: new Date().toISOString() });
  localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(deadLetters));
}

export const syncQueue = {
  enqueue(action) {
    const entry = {
      id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...action,
      createdAt: new Date().toISOString(),
      retryCount: 0,
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

  getDeadLetters,

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
      } catch (err) {
        item.retryCount = (item.retryCount || 0) + 1;
        console.warn(`[syncQueue] Failed to sync item ${item.id} (attempt ${item.retryCount}):`, err);

        if (item.retryCount >= MAX_RETRIES) {
          console.error(`[syncQueue] Item ${item.id} exceeded ${MAX_RETRIES} retries, moving to dead letter queue`);
          addDeadLetter(item);
          syncQueue.dequeue(item.id);
        } else {
          // Update retry count in queue
          const updated = getQueue().map((q) =>
            q.id === item.id ? { ...q, retryCount: item.retryCount } : q
          );
          saveQueue(updated);
        }
        failed++;
      }
    }

    return { synced, failed };
  },
};
