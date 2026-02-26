const { Router } = require('express');
const authenticate = require('../middleware');
const { getPool } = require('../db');

const router = Router();
router.use(authenticate);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Check if user owns or is a member of the booth. Returns { booth, isOwner } or null.
async function getBoothWithAccess(db, boothId, userId) {
  const result = await db.query(
    `SELECT b.*, u.name AS owner_name,
       CASE WHEN b.user_id = $2 THEN true ELSE false END AS is_owner
     FROM booths b
     JOIN users u ON u.id = b.user_id
     WHERE b.id = $1
       AND (b.user_id = $2 OR EXISTS (
         SELECT 1 FROM booth_members bm WHERE bm.booth_id = b.id AND bm.user_id = $2
       ))`,
    [boothId, userId]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    booth: {
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail || null,
      startingCash: Number(r.starting_cash),
      inventory: r.inventory,
      createdAt: Number(r.created_at),
      isOwner: r.is_owner,
      ownerName: r.owner_name,
    },
    isOwner: r.is_owner,
  };
}

// Share notifications — unseen booth shares
router.get('/notifications', async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT bm.booth_id, bm.added_at, b.name AS booth_name, u.name AS owner_name
       FROM booth_members bm
       JOIN booths b ON b.id = bm.booth_id
       JOIN users u ON u.id = b.user_id
       WHERE bm.user_id = $1 AND bm.seen_at IS NULL
       ORDER BY bm.added_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      boothId: r.booth_id,
      boothName: r.booth_name,
      ownerName: r.owner_name,
      addedAt: Number(r.added_at),
    })));
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark share notifications as seen
router.post('/notifications/seen', async (req, res) => {
  try {
    const db = getPool();
    await db.query(
      'UPDATE booth_members SET seen_at = $1 WHERE user_id = $2 AND seen_at IS NULL',
      [Date.now(), req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List booths (owned + shared)
router.get('/', async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT b.*, u.name AS owner_name,
         COALESCE(oc.cnt, 0)::int AS order_count,
         CASE WHEN b.user_id = $1 THEN true ELSE false END AS is_owner
       FROM booths b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN (SELECT booth_id, COUNT(*) as cnt FROM orders GROUP BY booth_id) oc
         ON b.id = oc.booth_id
       WHERE b.user_id = $1
          OR EXISTS (SELECT 1 FROM booth_members bm WHERE bm.booth_id = b.id AND bm.user_id = $1)
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    const booths = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail || null,
      startingCash: Number(r.starting_cash),
      inventory: r.inventory,
      createdAt: Number(r.created_at),
      orderCount: r.order_count,
      isOwner: r.is_owner,
      ownerName: r.owner_name,
    }));
    res.json(booths);
  } catch (err) {
    console.error('List booths error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create booth
router.post('/', async (req, res) => {
  try {
    const { name, startingCash, inventory, thumbnail } = req.body;
    if (!name) return res.status(400).json({ error: 'Booth name is required' });

    const id = genId();
    const now = Date.now();
    const db = getPool();
    await db.query(
      'INSERT INTO booths (id, user_id, name, starting_cash, inventory, thumbnail, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.user.id, name, Number(startingCash) || 0, JSON.stringify(inventory || {}), thumbnail || null, now]
    );

    res.json({
      id,
      name,
      thumbnail: thumbnail || null,
      startingCash: Number(startingCash) || 0,
      inventory: inventory || {},
      createdAt: now,
    });
  } catch (err) {
    console.error('Create booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booth
router.get('/:id', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });
    res.json(access.booth);
  } catch (err) {
    console.error('Get booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booth thumbnail (owner only)
router.patch('/:id', async (req, res) => {
  try {
    const db = getPool();
    const { thumbnail } = req.body;
    await db.query(
      'UPDATE booths SET thumbnail = $1 WHERE id = $2 AND user_id = $3',
      [thumbnail || null, req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Update booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restock booth inventory
router.post('/:id/restock', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    const { inventory } = req.body;
    if (!inventory || typeof inventory !== 'object') {
      return res.status(400).json({ error: 'Inventory object is required' });
    }

    // Build JSONB additions: for each cookie type, add the new quantity to existing
    const entries = Object.entries(inventory).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'No quantities to add' });
    }

    // Use jsonb concatenation — build a new object with summed values
    const setClauses = entries.map(([key], i) =>
      `jsonb_build_object($${i * 2 + 2}::text, COALESCE((inventory->>$${i * 2 + 2}::text)::int, 0) + $${i * 2 + 3}::int)`
    ).join(' || ');

    const params = [req.params.id];
    entries.forEach(([key, qty]) => {
      params.push(key, Number(qty));
    });

    await db.query(
      `UPDATE booths SET inventory = inventory || ${setClauses} WHERE id = $1`,
      params
    );

    // Return updated booth
    const updated = await getBoothWithAccess(db, req.params.id, req.user.id);
    res.json(updated.booth);
  } catch (err) {
    console.error('Restock booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete booth (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const db = getPool();
    await db.query('DELETE FROM booths WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List members
router.get('/:id/members', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    const ownerResult = await db.query(
      'SELECT id, name, username FROM users WHERE id = (SELECT user_id FROM booths WHERE id = $1)',
      [req.params.id]
    );

    const membersResult = await db.query(
      `SELECT u.id, u.name, u.username, bm.added_at
       FROM booth_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.booth_id = $1
       ORDER BY bm.added_at ASC`,
      [req.params.id]
    );

    const owner = ownerResult.rows[0];
    res.json({
      owner: { id: owner.id, name: owner.name, username: owner.username },
      members: membersResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        username: r.username,
        addedAt: Number(r.added_at),
      })),
    });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member (owner only)
router.post('/:id/members', async (req, res) => {
  try {
    const db = getPool();
    const booth = await db.query('SELECT id FROM booths WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (booth.rows.length === 0) return res.status(403).json({ error: 'Only the booth owner can add members' });

    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    const userResult = await db.query('SELECT id, name, username FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const member = userResult.rows[0];
    if (member.id === req.user.id) return res.status(400).json({ error: 'You are already the owner' });

    const id = genId();
    const now = Date.now();
    await db.query(
      'INSERT INTO booth_members (id, booth_id, user_id, added_at) VALUES ($1, $2, $3, $4) ON CONFLICT (booth_id, user_id) DO NOTHING',
      [id, req.params.id, member.id, now]
    );

    res.json({ id: member.id, name: member.name, username: member.username, addedAt: now });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member (owner only)
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const db = getPool();
    const booth = await db.query('SELECT id FROM booths WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (booth.rows.length === 0) return res.status(403).json({ error: 'Only the booth owner can remove members' });

    await db.query(
      'DELETE FROM booth_members WHERE booth_id = $1 AND user_id = $2',
      [req.params.id, req.params.memberId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List orders for booth (with who logged each order)
router.get('/:id/orders', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    const result = await db.query(
      `SELECT o.*, u.name AS logged_by_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.booth_id = $1
       ORDER BY o.created_at DESC`,
      [req.params.id]
    );
    const orders = result.rows.map(r => ({
      id: r.id,
      items: r.items,
      cashDonation: Number(r.cash_donation),
      total: Number(r.total),
      createdAt: Number(r.created_at),
      loggedByName: r.logged_by_name || null,
    }));
    res.json(orders);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create order (with user tracking)
router.post('/:id/orders', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.id, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    const { items, cashDonation, total } = req.body;
    const id = genId();
    const now = Date.now();

    await db.query(
      'INSERT INTO orders (id, booth_id, user_id, items, cash_donation, total, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.params.id, req.user.id, JSON.stringify(items || []), Number(cashDonation) || 0, Number(total) || 0, now]
    );

    res.json({
      id,
      items: items || [],
      cashDonation: Number(cashDonation) || 0,
      total: Number(total) || 0,
      createdAt: now,
      loggedByName: req.user.name,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order
router.put('/:boothId/orders/:orderId', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.boothId, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    const { items, cashDonation, total } = req.body;
    await db.query(
      'UPDATE orders SET items = $1, cash_donation = $2, total = $3 WHERE id = $4 AND booth_id = $5',
      [JSON.stringify(items || []), Number(cashDonation) || 0, Number(total) || 0, req.params.orderId, req.params.boothId]
    );

    const result = await db.query(
      `SELECT o.*, u.name AS logged_by_name FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [req.params.orderId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const r = result.rows[0];
    res.json({
      id: r.id,
      items: r.items,
      cashDonation: Number(r.cash_donation),
      total: Number(r.total),
      createdAt: Number(r.created_at),
      loggedByName: r.logged_by_name || null,
    });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete order
router.delete('/:boothId/orders/:orderId', async (req, res) => {
  try {
    const db = getPool();
    const access = await getBoothWithAccess(db, req.params.boothId, req.user.id);
    if (!access) return res.status(404).json({ error: 'Booth not found' });

    await db.query(
      'DELETE FROM orders WHERE id = $1 AND booth_id = $2',
      [req.params.orderId, req.params.boothId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
