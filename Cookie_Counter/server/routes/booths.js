const { Router } = require('express');
const authenticate = require('../middleware');
const { getPool } = require('../db');

const router = Router();
router.use(authenticate);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// List booths
router.get('/', async (req, res) => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT b.*, COALESCE(oc.cnt, 0)::int AS order_count
       FROM booths b
       LEFT JOIN (SELECT booth_id, COUNT(*) as cnt FROM orders GROUP BY booth_id) oc
         ON b.id = oc.booth_id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    const booths = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      startingCash: Number(r.starting_cash),
      inventory: r.inventory,
      createdAt: Number(r.created_at),
      orderCount: r.order_count,
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
    const { name, startingCash, inventory } = req.body;
    if (!name) return res.status(400).json({ error: 'Booth name is required' });

    const id = genId();
    const now = Date.now();
    const db = getPool();
    await db.query(
      'INSERT INTO booths (id, user_id, name, starting_cash, inventory, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.user.id, name, Number(startingCash) || 0, JSON.stringify(inventory || {}), now]
    );

    res.json({
      id,
      name,
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
    const result = await db.query(
      'SELECT * FROM booths WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booth not found' });

    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      startingCash: Number(r.starting_cash),
      inventory: r.inventory,
      createdAt: Number(r.created_at),
    });
  } catch (err) {
    console.error('Get booth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete booth
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

// List orders for booth
router.get('/:id/orders', async (req, res) => {
  try {
    const db = getPool();
    const booth = await db.query(
      'SELECT id FROM booths WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (booth.rows.length === 0) return res.status(404).json({ error: 'Booth not found' });

    const result = await db.query(
      'SELECT * FROM orders WHERE booth_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    const orders = result.rows.map(r => ({
      id: r.id,
      items: r.items,
      cashDonation: Number(r.cash_donation),
      total: Number(r.total),
      createdAt: Number(r.created_at),
    }));
    res.json(orders);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create order
router.post('/:id/orders', async (req, res) => {
  try {
    const db = getPool();
    const booth = await db.query(
      'SELECT id FROM booths WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (booth.rows.length === 0) return res.status(404).json({ error: 'Booth not found' });

    const { items, cashDonation, total } = req.body;
    const id = genId();
    const now = Date.now();

    await db.query(
      'INSERT INTO orders (id, booth_id, items, cash_donation, total, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.params.id, JSON.stringify(items || []), Number(cashDonation) || 0, Number(total) || 0, now]
    );

    res.json({
      id,
      items: items || [],
      cashDonation: Number(cashDonation) || 0,
      total: Number(total) || 0,
      createdAt: now,
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
    const booth = await db.query(
      'SELECT id FROM booths WHERE id = $1 AND user_id = $2',
      [req.params.boothId, req.user.id]
    );
    if (booth.rows.length === 0) return res.status(404).json({ error: 'Booth not found' });

    const { items, cashDonation, total } = req.body;
    await db.query(
      'UPDATE orders SET items = $1, cash_donation = $2, total = $3 WHERE id = $4 AND booth_id = $5',
      [JSON.stringify(items || []), Number(cashDonation) || 0, Number(total) || 0, req.params.orderId, req.params.boothId]
    );

    const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const r = result.rows[0];
    res.json({
      id: r.id,
      items: r.items,
      cashDonation: Number(r.cash_donation),
      total: Number(r.total),
      createdAt: Number(r.created_at),
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
    const booth = await db.query(
      'SELECT id FROM booths WHERE id = $1 AND user_id = $2',
      [req.params.boothId, req.user.id]
    );
    if (booth.rows.length === 0) return res.status(404).json({ error: 'Booth not found' });

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
