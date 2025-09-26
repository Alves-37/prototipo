// Express app config baseado nas necessidades do frontend Nevú
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const candidaturaRoutes = require('./routes/candidaturaRoutes');
const vagaRoutes = require('./routes/vagaRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const chamadoRoutes = require('./routes/chamadoRoutes');
const mensagemRoutes = require('./routes/mensagens');
const notificacaoRoutes = require('./routes/notificacaoRoutes');
const denunciaRoutes = require('./routes/denunciaRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas
app.use('/api/candidaturas', candidaturaRoutes);
app.use('/api/vagas', vagaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/chamados', chamadoRoutes);
app.use('/api/mensagens', mensagemRoutes);
app.use('/api/notificacoes', notificacaoRoutes);
app.use('/api/denuncias', denunciaRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Arquivo muito grande. Tamanho máximo permitido: 200MB' 
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        error: 'Campo de arquivo inesperado' 
      });
    }
  }
  
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Rota raiz para responder no domínio base
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API Nevú online',
    timestamp: new Date().toISOString(),
  });
});

// (Removida) Rota /api/health para manter apenas a raiz como endpoint de status

module.exports = app;
