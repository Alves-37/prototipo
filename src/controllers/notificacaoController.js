const { Notificacao } = require('../models');

// Listar notificações do usuário logado
exports.listar = async (req, res) => {
  try {
    const { page = 1, limit = 20, somenteNaoLidas } = req.query;
    const where = { usuarioId: req.user.id };
    if (somenteNaoLidas === 'true') where.lida = false;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Notificacao.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    const naoLidas = await Notificacao.count({ where: { usuarioId: req.user.id, lida: false } });

    res.json({
      notificacoes: rows,
      total: count,
      naoLidas,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('Erro ao listar notificações:', err);
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
};

// Marcar uma notificação como lida
exports.marcarComoLida = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notificacao.findOne({ where: { id, usuarioId: req.user.id } });
    if (!notif) return res.status(404).json({ error: 'Notificação não encontrada' });
    await notif.update({ lida: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar notificação como lida:', err);
    res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
  }
};

// Marcar todas como lidas
exports.marcarTodasComoLidas = async (req, res) => {
  try {
    await Notificacao.update({ lida: true }, { where: { usuarioId: req.user.id, lida: false } });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao marcar todas como lidas:', err);
    res.status(500).json({ error: 'Erro ao marcar todas como lidas' });
  }
};

// Limpar todas notificações
exports.limpar = async (req, res) => {
  try {
    await Notificacao.destroy({ where: { usuarioId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao limpar notificações:', err);
    res.status(500).json({ error: 'Erro ao limpar notificações' });
  }
};
