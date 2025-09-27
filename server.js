// Ponto de entrada do backend Nevú
const app = require('./src/app');
const { syncDb, sequelize } = require('./src/models');

const PORT = process.env.PORT || 5000;
let server;

// Sincronizar banco e iniciar servidor
syncDb().then(() => {
  server = app.listen(PORT, () => {
    console.log(`Backend Nevú rodando na porta ${PORT}`);
  });
});

function shutdown(signal) {
  console.log(`Recebido ${signal}. Encerrando graciosamente...`);
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP fechado.');
      if (sequelize && sequelize.close) {
        sequelize.close()
          .then(() => {
            console.log('Conexão com DB fechada.');
            process.exit(0);
          })
          .catch((err) => {
            console.error('Erro ao fechar conexão com DB:', err);
            process.exit(0);
          });
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
