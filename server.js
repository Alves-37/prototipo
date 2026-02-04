// Ponto de entrada do backend Nevú
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const { syncDb, sequelize } = require('./src/models');

const PORT = process.env.PORT || 5000;
let server;
let io;

const onlineUsers = new Set();

// Sincronizar banco e iniciar servidor
syncDb().then(() => {
  server = http.createServer(app);

  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  });

  app.set('io', io);

  const JWT_SECRET = process.env.JWT_SECRET || 'umsegredoseguro';

  io.use((socket, next) => {
    try {
      const rawAuthToken = socket?.handshake?.auth?.token;
      const rawQueryToken = socket?.handshake?.query?.token;
      const rawHeaderAuth = socket?.handshake?.headers?.authorization;

      const token = rawAuthToken
        || rawQueryToken
        || (typeof rawHeaderAuth === 'string' && rawHeaderAuth.startsWith('Bearer ') ? rawHeaderAuth.substring(7) : null);

      if (!token) return next();

      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.id) {
        socket.userId = Number(decoded.id);
      }

      return next();
    } catch {
      return next();
    }
  });

  io.on('connection', (socket) => {
    try {
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);

        onlineUsers.add(String(socket.userId));
        try {
          socket.emit('presence:state', { onlineUserIds: Array.from(onlineUsers) });
        } catch {}

        try {
          io.emit('presence:update', { userId: socket.userId, online: true, at: Date.now() });
        } catch {}
      }
    } catch {}

    socket.on('disconnect', () => {
      try {
        if (!socket.userId) return;
        onlineUsers.delete(String(socket.userId));
        try {
          io.emit('presence:update', { userId: socket.userId, online: false, at: Date.now() });
        } catch {}
      } catch {}
    });
  });

  server.listen(PORT, () => {
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
