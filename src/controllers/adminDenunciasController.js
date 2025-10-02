const { Denuncia, User } = require('../models');
const { Op } = require('sequelize');

function parsePagination(q) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '12', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

exports.list = async (req, res) => {
  try {
    const { busca, status, tipo, sortBy = 'createdAt', order = 'desc' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (status && ['aberta','em_analise','resolvida','arquivada'].includes(status)) {
      where.status = status;
    }
    if (tipo && ['empresa','candidato','vaga','mensagem','outro'].includes(tipo)) {
      where.referenciaTipo = tipo;
    }
    if (busca) {
      where[Op.or] = [
        { descricao: { [Op.iLike]: `%${busca}%` } },
        { motivo: { [Op.iLike]: `%${busca}%` } },
      ];
    }

    const orderArr = [[sortBy, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']];

    const { rows, count } = await Denuncia.findAndCountAll({
      where,
      order: orderArr,
      limit,
      offset,
      include: [{
        model: User,
        as: 'autor',
        attributes: ['id','nome','email']
      }],
    });

    const items = rows.map(d => ({
      id: d.id,
      referenciaTipo: d.referenciaTipo,
      motivo: d.motivo,
      descricao: d.descricao,
      anexo: d.anexo,
      status: mapDenunciaStatus(d.status),
      data: d.createdAt,
      usuarioId: d.autor ? d.autor.id : null,
      usuarioNome: d.autor ? d.autor.nome : 'Anônimo',
      usuarioEmail: d.autor ? d.autor.email : null,
    }));

    return res.json({ items, page, limit, total: count });
  } catch (err) {
    console.error('Erro em admin denuncias list:', err);
    return res.status(500).json({ error: 'Erro ao listar denúncias' });
  }
};

function mapDenunciaStatus(statusDb) {
  // Front usa: 'Pendente' | 'Em Análise' | 'Resolvida'
  switch (statusDb) {
    case 'aberta': return 'Pendente';
    case 'em_analise': return 'Em Análise';
    case 'resolvida': return 'Resolvida';
    case 'arquivada': return 'Arquivada';
    default: return 'Pendente';
  }
}
