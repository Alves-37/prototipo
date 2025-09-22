// Safe migration to drop the `cnpj` column from users table (PostgreSQL)
// This script checks if the column exists before attempting to drop it.

const sequelize = require('./src/config/database');

async function columnExistsPostgres(table, column) {
  const [results] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = :table AND column_name = :column`,
    { replacements: { table, column } }
  );
  return Array.isArray(results) && results.length > 0;
}

async function migrate() {
  try {
    console.log('🔧 Iniciando migração: remover coluna cnpj da tabela users...');

    const dialect = sequelize.getDialect();
    console.log(`➡️  Dialect detectado: ${dialect}`);

    if (dialect !== 'postgres') {
      console.log('ℹ️  Dialect não é PostgreSQL. Nenhuma ação necessária.');
      process.exit(0);
      return;
    }

    const exists = await columnExistsPostgres('users', 'cnpj');
    if (!exists) {
      console.log('✅ Coluna cnpj já não existe. Nada a fazer.');
      process.exit(0);
      return;
    }

    console.log('📝 Removendo coluna cnpj de "users"...');
    await sequelize.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "cnpj"');
    console.log('✅ Coluna cnpj removida com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

migrate();
