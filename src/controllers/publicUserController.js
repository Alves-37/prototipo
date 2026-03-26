const { User, Op } = require('../models');

// Funções públicas para usuários
exports.listPublicUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      ...(query ? { nome: { [Op.like]: `%${query}%` } } : {}),
    };

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [[User.sequelize.literal('RANDOM()')]],
      limit: limitNum,
      offset,
      attributes: ['id', 'nome', 'tipo', 'foto', 'logo', 'bio', 'localizacao', 'createdAt'],
    });

    return res.json({
      items: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao listar usuários públicos:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
};

exports.getPublicUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'nome', 'tipo', 'foto', 'logo', 'bio', 'localizacao', 'setor', 'tamanho', 'createdAt'],
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário público:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
};
