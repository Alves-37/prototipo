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

// Ativar usuário
exports.ativar = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remover suspensão
    await user.update({
      suspended: false,
      suspendedUntil: null,
      deletionRequestedAt: null
    });

    return res.json({ message: 'Usuário ativado com sucesso', user });
  } catch (err) {
    console.error('Erro ao ativar usuário:', err);
    return res.status(500).json({ error: 'Erro ao ativar usuário' });
  }
};

// Desativar usuário (suspender)
exports.desativar = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Suspender indefinidamente (admin pode reativar)
    await user.update({
      suspended: true,
      suspendedUntil: null, // null = indefinido
      deletionRequestedAt: null
    });

    return res.json({ message: 'Usuário desativado com sucesso', user });
  } catch (err) {
    console.error('Erro ao desativar usuário:', err);
    return res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
};

// Excluir usuário permanentemente
exports.excluir = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Excluir permanentemente
    await user.destroy();

    return res.json({ message: 'Usuário excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir usuário:', err);
    return res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
};
