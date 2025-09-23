const { Sequelize } = require('sequelize');
require('dotenv').config();

// Prefer DATABASE_PUBLIC_URL (public proxy) for local dev; fallback to DATABASE_URL (internal) for cloud
const connectionUri = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

let sequelize;

// Em produção, NUNCA usar SQLite. Abortamos se faltar a URL do banco.
if (!connectionUri && process.env.NODE_ENV === 'production') {
  console.error('[DB] Faltando DATABASE_URL/DATABASE_PUBLIC_URL em produção. Abortando para proteger dados.');
  throw new Error('DATABASE_URL não definido em produção. Configure o Postgres no Railway e a variável no serviço Node.');
}

if (connectionUri) {
  const useSSL = process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';
  sequelize = new Sequelize(connectionUri, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
  // Logs claros do alvo da conexão
  try {
    const u = new URL(connectionUri);
    console.log(`[DB] Conectando via Postgres: host=${u.hostname} db=${u.pathname.replace('/', '')} ssl=${useSSL}`);
  } catch (e) {
    console.log(`[DB] Conectando via Postgres (URL não parseada). SSL=${useSSL}`);
  }
} else {
  // Fallback apenas para DESENVOLVIMENTO usando SQLite
  console.warn('[DB] Usando SQLite local (apenas desenvolvimento). Em produção isso é bloqueado.');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './nevu.sqlite',
    logging: false,
  });
}

module.exports = sequelize;