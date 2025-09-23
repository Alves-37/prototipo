const { Notificacao } = require('../models');

// Listar notificações do usuário logado
exports.listar = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const where = { usuarioId: req.user.id };
    if (String(unreadOnly) === 'true') where.lida = false;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Notificacao.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      notificacoes: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    console.error('Erro ao listar notificações:', err);
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
};

// Contar não lidas
exports.contarNaoLidas = async (req, res) => {
  try {
    const total = await Notificacao.count({ where: { usuarioId: req.user.id, lida: false } });
    res.json({ naoLidas: total });
  } catch (err) {
    console.error('Erro ao contar notificações:', err);
    res.status(500).json({ error: 'Erro ao contar notificações' });
  }
};

// Marcar uma como lida
exports.marcarLida = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notificacao.findOne({ where: { id, usuarioId: req.user.id } });
    if (!notif) return res.status(404).json({ error: 'Notificação não encontrada' });
    await notif.update({ lida: true });
    res.json(notif);
  } catch (err) {
    console.error('Erro ao marcar notificação como lida:', err);
    res.status(500).json({ error: 'Erro ao marcar notificação' });
  }
};

// Marcar todas como lidas
exports.marcarTodas = async (req, res) => {
  try {
    await Notificacao.update({ lida: true }, { where: { usuarioId: req.user.id, lida: false } });
    res.json({ message: 'Todas as notificações marcadas como lidas' });
  } catch (err) {
    console.error('Erro ao marcar todas notificações:', err);
    res.status(500).json({ error: 'Erro ao marcar todas' });
  }
};

// Excluir
exports.excluir = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notificacao.findOne({ where: { id, usuarioId: req.user.id } });
    if (!notif) return res.status(404).json({ error: 'Notificação não encontrada' });
    await notif.destroy();
    res.json({ message: 'Notificação excluída' });
  } catch (err) {
    console.error('Erro ao excluir notificação:', err);
    res.status(500).json({ error: 'Erro ao excluir notificação' });
  }
};
