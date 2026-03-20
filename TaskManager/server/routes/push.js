const express = require('express');
const router = express.Router();

let webpush;
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@taskmanager.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch { webpush = null; }

async function sendPushToUser(pool, userId, title, body, data = {}) {
  if (!webpush) return;
  try {
    const subs = await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, data })
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        }
      }
    }
  } catch {}
}

module.exports = (pool) => {
  router.get('/vapid-key', (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
  });

  router.post('/subscribe', async (req, res) => {
    try {
      const { endpoint, keys } = req.body;
      if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription' });
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = $3, auth = $4`,
        [req.userId, endpoint, keys.p256dh, keys.auth]
      );
      await pool.query('UPDATE users SET push_enabled = true WHERE id = $1', [req.userId]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  router.delete('/unsubscribe', async (req, res) => {
    try {
      await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.userId]);
      await pool.query('UPDATE users SET push_enabled = false WHERE id = $1', [req.userId]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
  });

  return router;
};

module.exports.sendPushToUser = sendPushToUser;
