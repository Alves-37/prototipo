// Mostra para qual banco o backend/scripts estão apontando
// Uso:
//   node which-db.js

require('dotenv').config();
const sequelize = require('./src/config/database');

function maskUri(uri) {
  if (!uri) return uri;
  try {
    const u = new URL(uri);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return uri.replace(/:\/\/([^:@]+):([^@]+)@/,'://***:***@');
  }
}

(async () => {
  try {
    const dialect = sequelize.getDialect();
    const config = sequelize.config || {};

    console.log('NODE_ENV =', process.env.NODE_ENV || '(unset)');
    console.log('Dialect  =', dialect);

    if (dialect === 'sqlite') {
      console.log('SQLite storage =', config.storage);
    } else {
      // Para Postgres/MySQL
      const host = config.host;
      const port = config.port;
      const database = config.database;
      let uri = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || '';
      console.log('Host     =', host);
      console.log('Port     =', port);
      console.log('Database =', database);
      console.log('SSL      =', process.env.DATABASE_SSL);
      console.log('URI(src) =', maskUri(uri));
    }

    // Testar conexão rapidamente
    await sequelize.authenticate();
    console.log('Conexão OK');
  } catch (err) {
    console.error('Falha ao inspecionar/indicar banco:', err.message);
    process.exit(1);
  } finally {
    try { await sequelize.close(); } catch {}
  }
})();
