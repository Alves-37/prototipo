const { User } = require('../models');
const { Op } = require('sequelize');

function parsePagination(q) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '20', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

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
