#!/usr/bin/env node
/*
  Reset total do banco PostgreSQL no Railway.
  AVISO: isto APAGA TODOS OS DADOS.
  Uso: node scripts/reset-railway-db.js --yes [--use-public]
  - --use-public: força usar DATABASE_PUBLIC_URL (proxy público) em vez de DATABASE_URL.
*/

// Carregar variáveis do .env quando rodando localmente
try { require('dotenv').config(); } catch (e) {}

const { Client } = require('pg');
const readline = require('readline');

async function main() {
  const confirmFlag = process.argv.includes('--yes');
  if (!confirmFlag) {
    console.error('⚠️  Uso: node scripts/reset-railway-db.js --yes');
    console.error('Isto APAGARÁ TODOS OS DADOS do banco de produção no Railway.');
    process.exit(1);
  }

  const usePublic = process.argv.includes('--use-public');
  const dbUrl = usePublic
    ? (process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL)
    : (process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL);
  if (!dbUrl) {
    console.error('❌ DATABASE_URL (ou DATABASE_PUBLIC_URL) não definida nas variáveis de ambiente.');
    process.exit(1);
  }

  const using = usePublic ? 'DATABASE_PUBLIC_URL' : (process.env.DATABASE_URL ? 'DATABASE_URL' : 'DATABASE_PUBLIC_URL');
  console.log(`➡️  Conectando ao banco no Railway usando ${using} ...`);
  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Conectado. Iniciando reset do schema public...');

    // Drop e recria o schema public
    // IMPORTANTE: isto apaga TUDO
    const sql = `
      BEGIN;
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
      COMMIT;
    `;

    await client.query(sql);
    console.log('🧹 Schema public resetado com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao resetar schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  // Recriar tabelas a partir dos models (sequelize.sync)
  console.log('🔁 Recriando tabelas com sequelize.sync({ force: true })...');
  try {
    // Carregar models e sequelize já configurado
    const { sequelize } = require('../src/models');
    await sequelize.sync({ force: true });
    console.log('✅ Tabelas recriadas com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao recriar tabelas via Sequelize:', err.message);
    process.exit(1);
  }

  console.log('🎉 Reset do banco no Railway concluído.');
}

main();
