// Ponto de entrada do backend Nevú
const app = require('./src/app');
const { syncDb } = require('./src/models');

const PORT = process.env.PORT || 5000;

// Sincronizar banco e iniciar servidor
syncDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend Nevú rodando na porta ${PORT}`);
  });
});
