const { Sequelize } = require('sequelize');
require('dotenv').config();

// Prefer DATABASE_PUBLIC_URL (proxy pública Railway). Fallback para DATABASE_URL (host interno Railway).
// Importante: sem fallback para SQLite para garantir uso exclusivo de PostgreSQL.
const connectionUri = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

let sequelize;

if (!connectionUri) {
  throw new Error('DATABASE_PUBLIC_URL ou DATABASE_URL não configurados. Defina as variáveis para o PostgreSQL do Railway.');
}

// Forçar SSL para compatibilidade com a proxy pública do Railway
const useSSL = true;

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

module.exports = sequelize;