const { Pool } = require('pg');

function getConnectionConfig() {
  // Cloud Foundry: parse VCAP_SERVICES
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const pgService = vcap['postgresql-db']?.[0] || vcap['postgresql']?.[0];
    if (pgService) {
      const creds = pgService.credentials;
      return {
        host: creds.hostname || creds.host,
        port: creds.port,
        database: creds.dbname || creds.name,
        user: creds.username || creds.user,
        password: creds.password,
        ssl: { rejectUnauthorized: false },
      };
    }
  }

  // Local: use DATABASE_URL
  return { connectionString: process.env.DATABASE_URL };
}

const pool = new Pool(getConnectionConfig());

module.exports = pool;
