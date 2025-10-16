const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sequelize = require('../src/config/database');

(async () => {
  console.log('[Migration] Iniciando migração: adicionar coluna users.somNotificacoes');
  try {
    // Adicionar coluna se não existir (PostgreSQL)
    await sequelize.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "somNotificacoes" BOOLEAN DEFAULT false;
    `);

    // Garantir que valores nulos sejam false
    await sequelize.query(`
      UPDATE "users" SET "somNotificacoes" = false WHERE "somNotificacoes" IS NULL;
    `);

    // Opcional: forçar NOT NULL (seguro após o UPDATE acima)
    await sequelize.query(`
      ALTER TABLE "users"
      ALTER COLUMN "somNotificacoes" SET NOT NULL;
    `);

    console.log('[Migration] Coluna somNotificacoes criada/atualizada com sucesso.');
  } catch (err) {
    console.error('[Migration] Falha na migração somNotificacoes:', err);
    process.exitCode = 1;
  } finally {
    try { await sequelize.close(); } catch {}
  }
})();
