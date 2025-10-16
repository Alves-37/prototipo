#!/usr/bin/env node
/*
  Migração segura para criar/ajustar a tabela push_subscriptions sem apagar dados existentes.
  - Cria a tabela se não existir
  - Adiciona colunas ausentes
  - Garante índice único em endpoint

  Uso:
    node scripts/migrate-push-subscriptions.js
*/

require('dotenv').config();

const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

async function ensureTable() {
  const qi = sequelize.getQueryInterface();
  const table = 'push_subscriptions';
  let exists = true;
  let columns = {};

  try {
    columns = await qi.describeTable(table);
  } catch (err) {
    // Em muitos dialetos, describeTable lança erro se a tabela não existir
    exists = false;
  }

  if (!exists) {
    console.log(`[migrate] Criando tabela ${table}...`);
    await qi.createTable(table, {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: true,
        references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      endpoint: { type: DataTypes.TEXT, allowNull: false },
      p256dh: { type: DataTypes.STRING(255), allowNull: true },
      auth: { type: DataTypes.STRING(255), allowNull: true },
      expirationTime: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    });
    // Índice único para endpoint
    await qi.addIndex(table, ['endpoint'], { unique: true, name: 'ux_push_subscriptions_endpoint' });
    console.log('[migrate] Tabela criada com sucesso.');
    return;
  }

  console.log(`[migrate] Tabela ${table} já existe. Verificando colunas/índices...`);

  async function addColumnIfMissing(colName, spec) {
    if (!columns[colName]) {
      console.log(`[migrate] Adicionando coluna '${colName}'...`);
      await qi.addColumn(table, colName, spec);
    }
  }

  // Garantir colunas
  await addColumnIfMissing('userId', {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
  });
  await addColumnIfMissing('endpoint', { type: DataTypes.TEXT, allowNull: false });
  await addColumnIfMissing('p256dh', { type: DataTypes.STRING(255), allowNull: true });
  await addColumnIfMissing('auth', { type: DataTypes.STRING(255), allowNull: true });
  await addColumnIfMissing('expirationTime', { type: DataTypes.DATE, allowNull: true });
  await addColumnIfMissing('createdAt', { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') });
  await addColumnIfMissing('updatedAt', { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') });

  // Garantir índice único em endpoint (tenta criar; se já existir, ignora)
  try {
    await qi.addIndex(table, ['endpoint'], { unique: true, name: 'ux_push_subscriptions_endpoint' });
    console.log('[migrate] Índice único criado em endpoint.');
  } catch (e) {
    console.log('[migrate] Índice único em endpoint já existia ou não pôde ser recriado:', e.message);
  }

  console.log('[migrate] Migração concluída.');
}

(async () => {
  try {
    await sequelize.authenticate();
    await ensureTable();
  } catch (err) {
    console.error('[migrate] Erro na migração:', err.message || err);
    process.exit(1);
  } finally {
    try { await sequelize.close(); } catch {}
  }
})();
