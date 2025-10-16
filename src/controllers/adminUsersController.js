const { User } = require('../models');
const { Op } = require('sequelize');

function parsePagination(q) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Excluir usuário definitivamente (admin)
exports.excluir = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    await user.destroy();
    return res.json({ success: true, deleted: true, id });
  } catch (err) {
    console.error('Erro em admin usuarios excluir:', err);
    return res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
};
exports.desativar = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    user.suspended = true;
    await user.save();
    return res.json({ success: true, user: { id: user.id, suspended: user.suspended } });
  } catch (err) {
    console.error('Erro em admin usuarios desativar:', err);
    return res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
};

exports.ativar = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    user.suspended = false;
    await user.save();
    return res.json({ success: true, user: { id: user.id, suspended: user.suspended } });
  } catch (err) {
    console.error('Erro em admin usuarios ativar:', err);
    return res.status(500).json({ error: 'Erro ao ativar usuário' });
  }
};

exports.list = async (req, res) => {
  try {
    const { busca, tipo, sortBy = 'createdAt', order = 'desc' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (tipo && ['usuario', 'empresa'].includes(tipo)) {
      where.tipo = tipo;
    }
    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${busca}%` } },
        { email: { [Op.iLike]: `%${busca}%` } },
      ];
    }

    const orderArr = [[sortBy, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']];

    const { rows, count } = await User.findAndCountAll({
      where,
      order: orderArr,
      limit,
      offset,
      attributes: { exclude: ['senha', 'cvData'] },
    });

    return res.json({ items: rows, page, limit, total: count });
  } catch (err) {
    console.error('Erro em admin usuarios list:', err);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
};
