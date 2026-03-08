// Script para sincronizar a tabela de produtos
require('dotenv').config();
const { sequelize, Produto } = require('./src/models');

(async () => {
  try {
    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão OK. Iniciando sync de produtos com alter=true...');

    await Produto.sync({ alter: true });

    console.log('Tabela produtos sincronizada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao sincronizar produtos:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
