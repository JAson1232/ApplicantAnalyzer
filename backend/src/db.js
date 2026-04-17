const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined
});

const schemaPath = path.resolve(__dirname, '../../db/init.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function ensureSchema() {
  await pool.query(schemaSql);
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  ensureSchema
};
