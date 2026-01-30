const { Connection, User } = require('../models');

const publicUser = (u) => {
  if (!u) return null;
  const raw = typeof u.toJSON === 'function' ? u.toJSON() : u;
  return {
    id: raw.id,
    nome: raw.nome,
    tipo: raw.tipo,
    foto: raw.foto || null,
    logo: raw.logo || null,
  };
};

const normalizeId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const findBetweenUsers = async (a, b) => {
  return Connection.findOne({
    where: {
      requesterId: a,
      addresseeId: b,
    },
  });
};

exports.getStatus = async (req, res) => {
  try {
    const me = req.user.id;
    const other = normalizeId(req.params.targetId);
    if (!other) return res.status(400).json({ error: 'ID inválido' });
    if (other === me) return res.json({ status: 'self' });

    const outgoing = await Connection.findOne({ where: { requesterId: me, addresseeId: other } });
    const incoming = await Connection.findOne({ where: { requesterId: other, addresseeId: me } });

    const accepted = (outgoing && outgoing.status === 'accepted') || (incoming && incoming.status === 'accepted');
    if (accepted) return res.json({ status: 'connected' });

    if (outgoing && outgoing.status === 'pending') {
      return res.json({ status: 'pending_outgoing', requestId: outgoing.id });
    }

    if (incoming && incoming.status === 'pending') {
      return res.json({ status: 'pending_incoming', requestId: incoming.id });
    }

    return res.json({ status: 'none' });
  } catch (err) {
    console.error('Erro ao buscar status de conexão:', err);
    return res.status(500).json({ error: 'Erro ao buscar status' });
  }
};

exports.request = async (req, res) => {
  try {
    const me = req.user.id;
    const other = normalizeId(req.params.targetId);
    if (!other) return res.status(400).json({ error: 'ID inválido' });
    if (other === me) return res.status(400).json({ error: 'Operação inválida' });

    const otherUser = await User.findByPk(other);
    if (!otherUser) return res.status(404).json({ error: 'Usuário não encontrado' });

    const acceptedOutgoing = await Connection.findOne({ where: { requesterId: me, addresseeId: other, status: 'accepted' } });
    const acceptedIncoming = await Connection.findOne({ where: { requesterId: other, addresseeId: me, status: 'accepted' } });
    if (acceptedOutgoing || acceptedIncoming) {
      return res.json({ status: 'connected' });
    }

    let conn = await Connection.findOne({ where: { requesterId: me, addresseeId: other } });
    if (conn) {
      // Reabrir pedido se estava rejeitado/cancelado
      if (conn.status !== 'pending') {
        await conn.update({ status: 'pending' });
      }
    } else {
      conn = await Connection.create({ requesterId: me, addresseeId: other, status: 'pending' });
    }

    return res.status(201).json({ status: 'pending_outgoing', requestId: conn.id });
  } catch (err) {
    console.error('Erro ao solicitar conexão:', err);
    return res.status(500).json({ error: 'Erro ao solicitar conexão' });
  }
};

exports.listIncoming = async (req, res) => {
  try {
    const me = req.user.id;
    const rows = await Connection.findAll({
      where: { addresseeId: me, status: 'pending' },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'requester', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    return res.json({
      requests: rows.map(r => {
        const raw = typeof r.toJSON === 'function' ? r.toJSON() : r;
        return {
          id: raw.id,
          status: raw.status,
          createdAt: raw.createdAt,
          requester: publicUser(raw.requester),
        };
      }),
    });
  } catch (err) {
    console.error('Erro ao listar solicitações recebidas:', err);
    return res.status(500).json({ error: 'Erro ao listar solicitações' });
  }
};

exports.accept = async (req, res) => {
  try {
    const me = req.user.id;
    const requestId = normalizeId(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'ID inválido' });

    const conn = await Connection.findByPk(requestId);
    if (!conn) return res.status(404).json({ error: 'Solicitação não encontrada' });
    if (conn.addresseeId !== me) return res.status(403).json({ error: 'Acesso negado' });
    if (conn.status !== 'pending') return res.status(400).json({ error: 'Solicitação não está pendente' });

    await conn.update({ status: 'accepted' });
    return res.json({ status: 'connected' });
  } catch (err) {
    console.error('Erro ao aceitar conexão:', err);
    return res.status(500).json({ error: 'Erro ao aceitar conexão' });
  }
};

exports.reject = async (req, res) => {
  try {
    const me = req.user.id;
    const requestId = normalizeId(req.params.id);
    if (!requestId) return res.status(400).json({ error: 'ID inválido' });

    const conn = await Connection.findByPk(requestId);
    if (!conn) return res.status(404).json({ error: 'Solicitação não encontrada' });
    if (conn.addresseeId !== me) return res.status(403).json({ error: 'Acesso negado' });
    if (conn.status !== 'pending') return res.status(400).json({ error: 'Solicitação não está pendente' });

    await conn.update({ status: 'rejected' });
    return res.json({ status: 'none' });
  } catch (err) {
    console.error('Erro ao rejeitar conexão:', err);
    return res.status(500).json({ error: 'Erro ao rejeitar conexão' });
  }
};

exports.remove = async (req, res) => {
  try {
    const me = req.user.id;
    const other = normalizeId(req.params.targetId);
    if (!other) return res.status(400).json({ error: 'ID inválido' });

    const outgoing = await Connection.findOne({ where: { requesterId: me, addresseeId: other } });
    const incoming = await Connection.findOne({ where: { requesterId: other, addresseeId: me } });

    const toCancel = [];
    if (outgoing && outgoing.status === 'pending') toCancel.push(outgoing);
    if (incoming && incoming.status === 'pending') {
      // se alguém te pediu, você pode recusar via remove também
      toCancel.push(incoming);
    }

    const toDisconnect = [];
    if (outgoing && outgoing.status === 'accepted') toDisconnect.push(outgoing);
    if (incoming && incoming.status === 'accepted') toDisconnect.push(incoming);

    if (toCancel.length === 0 && toDisconnect.length === 0) {
      return res.json({ status: 'none' });
    }

    for (const c of toCancel) {
      await c.update({ status: 'canceled' });
    }

    for (const c of toDisconnect) {
      await c.update({ status: 'canceled' });
    }

    return res.json({ status: 'none' });
  } catch (err) {
    console.error('Erro ao remover/cancelar conexão:', err);
    return res.status(500).json({ error: 'Erro ao remover conexão' });
  }
};
