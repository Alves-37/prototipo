/*
  Lista as tabelas existentes no banco (schema public) usando a conexão Sequelize
  Configuração de conexão em src/config/database.js (PostgreSQL via Railway)

  Uso:
    node scripts/list-tables.js
*/

const sequelize = require('../src/config/database');

(async () => {
  console.log('Conectando ao banco para listar tabelas...');
  try {
    await sequelize.authenticate();

    const [rows] = await sequelize.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;`
    );

    if (!rows || rows.length === 0) {
      console.log('Nenhuma tabela encontrada no schema public.');
    } else {
      console.log(`\nTabelas no schema public (${rows.length}):`);
      for (const r of rows) {
        console.log('- ' + r.table_name);
      }
    }

    // Também exibir views, se útil
    const [views] = await sequelize.query(
      `SELECT table_name
         FROM information_schema.views
        WHERE table_schema = 'public'
        ORDER BY table_name;`
    );
    if (views && views.length) {
      console.log(`\nViews no schema public (${views.length}):`);
      for (const v of views) {
        console.log('- ' + v.table_name);
      }
    }
  } catch (err) {
    console.error('Erro ao listar tabelas:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
