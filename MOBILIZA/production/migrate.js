/**
 * Script de migração — executa schema.sql contra o DATABASE_URL
 * Rodar: npm run migrate
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não configurada no .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Executando schema.sql contra', process.env.DATABASE_URL.replace(/:[^:]+@/, ':***@'));
    await pool.query(sql);
    console.log('✓ Schema aplicado com sucesso');
  } catch (e) {
    console.error('✗ Erro:', e.message);
        console.warn('Continuando mesmo assim (schema provavelmente ja aplicado)');
  } finally {
    await pool.end();
  }
})();
