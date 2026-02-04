// Ponto de entrada do backend Nevú
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const { syncDb, sequelize } = require('./src/models');
const { Op } = require('sequelize');
const { Mensagem } = require('./src/models');

const PORT = process.env.PORT || 5000;
let server;
let io;

const onlineUsers = new Set();
const lastSeenByUserId = new Map();

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
  app.set('onlineUsers', onlineUsers);
  app.set('lastSeenByUserId', lastSeenByUserId);

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
          (async () => {
            try {
              if (!Mensagem) return;
              const userId = Number(socket.userId);
              if (!userId) return;

              const pendentes = await Mensagem.findAll({
                where: {
                  destinatarioId: userId,
                  entregue: false,
                },
                attributes: ['id', 'conversaId', 'remetenteId'],
                limit: 200,
                order: [['createdAt', 'ASC']],
              });

              if (!pendentes || pendentes.length === 0) return;

              const ids = pendentes.map(m => m.id);
              await Mensagem.update(
                { entregue: true },
                { where: { id: { [Op.in]: ids } } }
              );

              const grouped = new Map();
              pendentes.forEach((m) => {
                const remetenteId = Number(m?.remetenteId);
                const conversaId = String(m?.conversaId || '');
                if (!remetenteId || !conversaId) return;
                const key = `${remetenteId}::${conversaId}`;
                const arr = grouped.get(key) || [];
                arr.push(m.id);
                grouped.set(key, arr);
              });

              grouped.forEach((messageIds, key) => {
                try {
                  const [remetenteIdStr, conversaId] = String(key).split('::');
                  const remetenteId = Number(remetenteIdStr);
                  if (!remetenteId || !conversaId) return;
                  io.to(`user:${remetenteId}`).emit('message:status', {
                    conversaId,
                    messageIds,
                    entregue: true,
                    at: Date.now(),
                  });
                } catch {}
              });
            } catch {}
          })();
        } catch {}

        try {
          socket.emit('presence:state', { onlineUserIds: Array.from(onlineUsers) });
        } catch {}

        try {
          io.emit('presence:update', { userId: socket.userId, online: true, at: Date.now(), lastSeenAt: null });
        } catch {}
      }
    } catch {}

    socket.on('typing', (evt) => {
      try {
        if (!socket.userId) return;
        const toUserId = evt?.toUserId;
        const conversaId = evt?.conversaId;
        if (toUserId === undefined || toUserId === null) return;
        io.to(`user:${toUserId}`).emit('typing', {
          fromUserId: socket.userId,
          toUserId,
          conversaId,
          typing: !!evt?.typing,
          at: Date.now(),
        });
      } catch {}
    });

    socket.on('disconnect', () => {
      try {
        if (!socket.userId) return;
        onlineUsers.delete(String(socket.userId));
        try {
          lastSeenByUserId.set(String(socket.userId), Date.now());
        } catch {}
        try {
          const lastSeenAt = lastSeenByUserId.get(String(socket.userId)) || Date.now();
          io.emit('presence:update', { userId: socket.userId, online: false, at: Date.now(), lastSeenAt });
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
