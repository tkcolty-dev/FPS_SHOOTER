const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const cron = require('node-cron');
const { getDbConfig, migrate } = require('./migrations/001_initial');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const pool = new Pool(getDbConfig());

app.use(express.json({ limit: '5mb' }));

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Public auth routes (login/register)
app.use('/api/auth', require('./routes/auth')(pool, auth));
// Protected routes
app.use('/api/tasks', auth, require('./routes/tasks')(pool));
app.use('/api/events', auth, require('./routes/events')(pool));
app.use('/api/chat', auth, require('./routes/chat')(pool));
app.use('/api/notifications', auth, require('./routes/notifications')(pool));
app.use('/api/sharing', auth, require('./routes/sharing')(pool));
app.use('/api/push', auth, require('./routes/push')(pool));

// Serve React build
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

const { sendPushToUser } = require('./routes/push');

// Notification cron - check overdue tasks every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    const overdue = await pool.query(`
      SELECT t.id, t.title, t.user_id
      FROM tasks t
      JOIN users u ON u.id = t.user_id AND u.notify_overdue = true
      WHERE t.status != 'completed'
        AND t.due_date IS NOT NULL
        AND t.due_date::date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'overdue'
          AND n.created_at > NOW() - INTERVAL '1 hour'
        )
    `);

    for (const task of overdue.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [task.user_id, task.id, 'overdue', 'Task Overdue', `"${task.title}" is past its due date!`]
      );
      sendPushToUser(pool, task.user_id, 'Task Overdue', `"${task.title}" is past its due date!`, { url: '/tasks' });
    }

    const upcoming = await pool.query(`
      SELECT t.id, t.title, t.user_id, u.notify_before_minutes
      FROM tasks t
      JOIN users u ON u.id = t.user_id AND u.notify_upcoming = true
      WHERE t.status != 'completed'
        AND t.due_date IS NOT NULL
        AND t.due_date > NOW()
        AND t.due_date <= NOW() + (u.notify_before_minutes || ' minutes')::INTERVAL
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'upcoming'
          AND n.created_at > NOW() - INTERVAL '1 hour'
        )
    `);

    for (const task of upcoming.rows) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, type, title, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [task.user_id, task.id, 'upcoming', 'Task Coming Up', `"${task.title}" is due soon!`]
      );
      sendPushToUser(pool, task.user_id, 'Task Coming Up', `"${task.title}" is due soon!`, { url: '/tasks' });
    }
  } catch (err) {
    console.error('Notification cron error:', err);
  }
});

async function start() {
  try {
    await migrate();
    console.log('Database migrated');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  app.listen(PORT, () => console.log(`TaskManager running on port ${PORT}`));
}

start();
