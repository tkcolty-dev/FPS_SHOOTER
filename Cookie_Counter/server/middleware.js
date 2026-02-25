const { getPool } = require('./db');

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = auth.slice(7);
  const db = getPool();
  const result = await db.query(
    'SELECT u.id, u.name, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1',
    [token]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  req.user = result.rows[0];
  next();
}

module.exports = authenticate;
