require('dotenv').config();
const { sequelize, Post } = require('./src/models');

(async () => {
  try {
    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão OK. Iniciando sync de posts com alter=true...');

    await Post.sync({ alter: true });

    console.log('Tabela posts sincronizada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao sincronizar posts:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
