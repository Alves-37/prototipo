const jwt = require('jsonwebtoken');

module.exports = function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    const secret = process.env.JWT_SECRET || 'umsegredoseguro';
    if (!process.env.JWT_SECRET) {
      console.warn('[requireAdmin] JWT_SECRET não definido. Usando fallback (apenas dev). Configure JWT_SECRET no ambiente.');
    }
    const payload = jwt.verify(token, secret);
    if (!payload || payload.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    req.admin = payload; // sub, email, nome, role
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 401 : 401;
    return res.status(code).json({ error: 'Token inválido' });
  }
}
