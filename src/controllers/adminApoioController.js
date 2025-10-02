const { Apoio, User } = require('../models');
const { Op } = require('sequelize');

function parsePagination(q) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '12', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function mapStatusToDb(label) {
  // Front usa: 'Pendente' | 'Em Atendimento' | 'Resolvido'
  if (!label) return undefined;
  const map = {
    'Pendente': 'pendente',
    'Em Atendimento': 'em_atendimento',
    'Resolvido': 'resolvido',
  };
  return map[label];
}

function mapStatusFromDb(db) {
  switch (db) {
    case 'pendente': return 'Pendente';
    case 'em_atendimento': return 'Em Atendimento';
    case 'resolvido': return 'Resolvido';
    default: return 'Pendente';
  }
}

exports.list = async (req, res) => {
  try {
    const { busca, status, sortBy = 'createdAt', order = 'desc' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    const dbStatus = mapStatusToDb(status);
    if (dbStatus) where.status = dbStatus;

    if (busca) {
      where[Op.or] = [
        { titulo: { [Op.iLike]: `%${busca}%` } },
        { descricao: { [Op.iLike]: `%${busca}%` } },
      ];
    }

    const orderArr = [[sortBy, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']];

    const { rows, count } = await Apoio.findAndCountAll({
      where,
      order: orderArr,
      limit,
      offset,
      include: [{
        model: User,
        as: 'usuario',
        attributes: ['id','nome','email']
      }],
    });

    const items = rows.map(c => ({
      id: c.id,
      nome: c.usuario ? c.usuario.nome : (c.nome || 'Anônimo'),
      email: c.usuario ? c.usuario.email : c.email,
      mensagem: c.mensagem,
      status: mapStatusFromDb(c.status),
      data: c.createdAt,
    }));

    return res.json({ items, page, limit, total: count });
  } catch (err) {
    console.error('Erro em admin apoio list:', err);
    return res.status(500).json({ error: 'Erro ao listar mensagens de apoio' });
  }
};
