const { Sequelize } = require('sequelize');
require('dotenv').config();

// Prefer DATABASE_PUBLIC_URL (proxy pública Railway) e, se não existir, DATABASE_URL (host interno Railway).
// Como último recurso, usa os valores padrão fornecidos pelo usuário para manter o backend funcional.
const DEFAULT_DATABASE_PUBLIC_URL = 'postgresql://postgres:OuKBYrRjizNBPFLJAYJjfumzhjgPHGjm@ballast.proxy.rlwy.net:27968/railway';
const DEFAULT_DATABASE_URL = 'postgresql://postgres:OuKBYrRjizNBPFLJAYJjfumzhjgPHGjm@postgres.railway.internal:5432/railway';

const connectionUri =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  DEFAULT_DATABASE_PUBLIC_URL ||
  DEFAULT_DATABASE_URL;

let sequelize;

if (!connectionUri) {
  throw new Error('DATABASE_PUBLIC_URL ou DATABASE_URL não configurados. Defina as variáveis para o PostgreSQL do Railway.');
}

const normalizedUri = connectionUri.trim();
const sslEnv = process.env.DATABASE_SSL;
const useSSL =
  sslEnv === 'true'
    ? true
    : sslEnv === 'false'
    ? false
    : !normalizedUri.includes('postgres.railway.internal');

sequelize = new Sequelize(normalizedUri, {
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