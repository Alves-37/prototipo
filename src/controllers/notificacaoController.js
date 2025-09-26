const { Notificacao } = require('../models');

// Listar notificações do usuário logado
exports.listar = async (req, res) => {
  try {
    // Garantir que o usuário esteja definido via authMiddleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { page = 1, limit = 20, somenteNaoLidas } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const where = { usuarioId: req.user.id };
    if (somenteNaoLidas === 'true') where.lida = false;

    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Notificacao.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    const naoLidas = await Notificacao.count({ where: { usuarioId: req.user.id, lida: false } });

    res.json({
      notificacoes: rows,
      total: count,
      naoLidas,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum)
    });
  } catch (err) {
    console.error('Erro ao listar notificações:', err && (err.stack || err.message || err));
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
};

// Marcar uma notificação como lida
exports.marcarComoLida = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
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
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
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
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    await Notificacao.destroy({ where: { usuarioId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao limpar notificações:', err);
    res.status(500).json({ error: 'Erro ao limpar notificações' });
  }
};
