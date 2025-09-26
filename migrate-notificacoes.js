// Script para migrar a tabela de notificações com segurança
require('dotenv').config();
const { sequelize, Notificacao } = require('./src/models');

(async () => {
  try {
    console.log('Conectando ao banco...');
    await sequelize.authenticate();
    console.log('Conexão OK. Iniciando sync da tabela notificacoes com alter=true...');

    // Sincroniza apenas a tabela de notificações (evita mexer no resto)
    await Notificacao.sync({ alter: true });

    console.log('Tabela notificacoes sincronizada com sucesso.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao sincronizar notificacoes:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
