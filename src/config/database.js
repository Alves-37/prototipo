const { Sequelize } = require('sequelize');
require('dotenv').config();

// Prefer DATABASE_PUBLIC_URL (public proxy) for local dev; fallback to DATABASE_URL (internal) for cloud
const connectionUri = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

let sequelize;

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
} else {
  // Fallback local development using SQLite if no DATABASE_URL is provided
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_STORAGE || './nevu.sqlite',
    logging: false,
  });
}

module.exports = sequelize;