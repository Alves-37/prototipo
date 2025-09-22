const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'umsegredoseguro';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' do início
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(500).json({ error: 'Erro na autenticação' });
  }
};

// Middleware para verificar se é empresa
const empresaMiddleware = (req, res, next) => {
  if (req.user.tipo !== 'empresa') {
    return res.status(403).json({ error: 'Acesso negado. Apenas empresas podem acessar este recurso.' });
  }
  next();
};

// Middleware para verificar se é usuário
const usuarioMiddleware = (req, res, next) => {
  if (req.user.tipo !== 'usuario') {
    return res.status(403).json({ error: 'Acesso negado. Apenas candidatos podem acessar este recurso.' });
  }
  next();
};

module.exports = {
  authMiddleware,
  empresaMiddleware,
  usuarioMiddleware
}; 