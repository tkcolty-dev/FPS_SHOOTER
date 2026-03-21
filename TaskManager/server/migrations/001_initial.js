const { Pool } = require('pg');

function getDbConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const pg = vcap.postgres?.[0]?.credentials;
    if (pg) return { connectionString: pg.uri || `postgres://${pg.username}:${pg.password}@${pg.hostname}:${pg.port}/${pg.name}`, ssl: false };
  }
  return { connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/taskmanager' };
}

async function migrate() {
  const pool = new Pool(getDbConfig());
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        theme VARCHAR(10) DEFAULT 'light',
        notify_overdue BOOLEAN DEFAULT true,
        notify_upcoming BOOLEAN DEFAULT true,
        notify_before_minutes INTEGER DEFAULT 30,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) DEFAULT 'general',
        priority VARCHAR(10) DEFAULT 'medium',
        status VARCHAR(20) DEFAULT 'pending',
        due_date TIMESTAMPTZ,
        due_time VARCHAR(10),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        location VARCHAR(255),
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        color VARCHAR(20) DEFAULT '#2563eb',
        invitation_text TEXT,
        attendees TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(user_id, due_date);
      CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_time ON events(user_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_history(user_id);

      CREATE TABLE IF NOT EXISTS user_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_notes ON user_notes(user_id, category);

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT 'none';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT 'none';

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0;

      CREATE TABLE IF NOT EXISTS shared_tasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        shared_with_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        permission VARCHAR(10) DEFAULT 'edit',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(task_id, shared_with_id)
      );
      CREATE INDEX IF NOT EXISTS idx_shared_owner ON shared_tasks(owner_id);
      CREATE INDEX IF NOT EXISTS idx_shared_with ON shared_tasks(shared_with_id);

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_shared BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS show_time_completed BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS confirm_before_delete BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_view VARCHAR(20) DEFAULT 'all';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS show_task_count BOOLEAN DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_clear_completed BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_clear_hours INTEGER DEFAULT 24;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN DEFAULT false;
    `);
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) migrate();
module.exports = { migrate, getDbConfig };
