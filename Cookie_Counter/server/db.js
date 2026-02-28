const { Pool } = require('pg');

let pool;

function getDbConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const pgService = vcap.postgres?.[0];
    if (pgService && pgService.credentials.uri) {
      return { connectionString: pgService.credentials.uri };
    }
  }
  return {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/cookie_counter',
  };
}

function getPool() {
  if (!pool) {
    pool = new Pool({ ...getDbConfig(), max: 10 });
  }
  return pool;
}

async function initDb() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS booths (
      id VARCHAR(32) PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      starting_cash DECIMAL(10,2) DEFAULT 0,
      inventory JSONB NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(32) PRIMARY KEY,
      booth_id VARCHAR(32) NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
      user_id VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
      items JSONB NOT NULL DEFAULT '[]',
      cash_donation DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) DEFAULT 0,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS booth_members (
      id VARCHAR(32) PRIMARY KEY,
      booth_id VARCHAR(32) NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
      user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at BIGINT NOT NULL,
      seen_at BIGINT,
      UNIQUE(booth_id, user_id)
    );
  `);

  // Add columns if they don't exist (for existing deployments)
  await db.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE booth_members ADD COLUMN IF NOT EXISTS seen_at BIGINT;
    ALTER TABLE booths ADD COLUMN IF NOT EXISTS thumbnail TEXT;
  `);
}

module.exports = { getPool, initDb };
