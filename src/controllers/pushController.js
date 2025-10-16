const { User, PushSubscription } = require('../models');

// Controller simples para registrar/desregistrar inscrições de push.
// Neste primeiro passo salvaremos apenas em memória/log e retornaremos 200
// para remover o 404. Opcionalmente, podemos evoluir para persistir em DB.

exports.subscribe = async (req, res) => {
  try {
    const { endpoint, keys, expirationTime, userId } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint é obrigatório' });
    }
    // Opcional: validar estrutura de keys (p256dh, auth)
    const assocUserId = userId || (req.user ? req.user.id : null) || null;

    // Upsert por endpoint para evitar duplicados
    const payload = {
      userId: assocUserId,
      endpoint,
      p256dh: keys?.p256dh || null,
      auth: keys?.auth || null,
      expirationTime: expirationTime ? new Date(expirationTime) : null,
    };

    const existing = await PushSubscription.findOne({ where: { endpoint } });
    if (existing) {
      await existing.update(payload);
    } else {
      await PushSubscription.create(payload);
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Erro em push subscribe:', err);
    return res.status(500).json({ error: 'Erro ao registrar inscrição de push' });
  }
};

exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint é obrigatório' });
    }
    const existing = await PushSubscription.findOne({ where: { endpoint } });
    if (existing) {
      await existing.destroy();
    }
    return res.json({ ok: true, removed: !!existing });
  } catch (err) {
    console.error('Erro em push unsubscribe:', err);
    return res.status(500).json({ error: 'Erro ao remover inscrição de push' });
  }
};
