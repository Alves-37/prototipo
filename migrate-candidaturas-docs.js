// Script para migrar a tabela de candidaturas adicionando documentoFrente/documentoVerso com alter
require('dotenv').config();
const { sequelize, Candidatura } = require('./src/models');

(async () => {
  try {
    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão OK. Iniciando sync de candidaturas com alter=true...');

    await Candidatura.sync({ alter: true });

    console.log('Tabela candidaturas sincronizada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao sincronizar candidaturas:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
