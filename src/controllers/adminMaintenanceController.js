const { sequelize, Admin } = require('../models');
const bcrypt = require('bcryptjs');

exports.resetDatabase = async (req, res) => {
  try {
    // Exigir confirmação explícita para qualquer ambiente, inclusive produção
    if (!req.body || req.body.confirm !== 'RESET_DB') {
      return res.status(400).json({ error: "Confirmação obrigatória. Envie { confirm: 'RESET_DB' }" });
    }

    // Dropa e recria todas as tabelas
    await sequelize.sync({ force: true });

    // Recria admin padrão
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@admin.com';
    const senha = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const nome = process.env.DEFAULT_ADMIN_NAME || 'Administrador';

    const senhaHash = await bcrypt.hash(senha, 10);
    await Admin.create({ nome, email, senhaHash, ativo: true, role: 'admin' });

    return res.json({
      ok: true,
      message: 'Banco resetado e admin padrão recriado.',
      admin: { email, senha }
    });
  } catch (err) {
    console.error('Erro ao resetar banco:', err);
    return res.status(500).json({ error: 'Erro ao resetar banco de dados.' });
  }
};
