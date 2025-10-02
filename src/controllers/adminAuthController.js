const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

// Usa o mesmo segredo já existente no projeto para não divergir
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

function signAdminToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      role: 'admin',
      email: admin.email,
      nome: admin.nome,
      type: 'dashboard',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin || !admin.ativo) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const ok = await bcrypt.compare(senha, admin.senhaHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Atualiza lastLoginAt
    try {
      admin.lastLoginAt = new Date();
      await admin.save();
    } catch (_) {}

    const token = signAdminToken(admin);
    return res.json({
      token,
      user: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: 'admin',
      },
    });
  } catch (err) {
    console.error('Erro em admin login:', err);
    return res.status(500).json({ error: 'Erro interno ao fazer login de admin.' });
  }
};
