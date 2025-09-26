// Script para sincronizar a tabela de denuncias
require('dotenv').config();
const { sequelize, Denuncia } = require('./src/models');

(async () => {
  try {
    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão OK. Iniciando sync de denuncias com alter=true...');

    await Denuncia.sync({ alter: true });

    console.log('Tabela denuncias sincronizada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao sincronizar denuncias:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
