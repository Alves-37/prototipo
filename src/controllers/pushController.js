const { User, PushSubscription } = require('../models');

const webpush = require('web-push');

const ensureVapidConfigured = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { ok: false, publicKey, privateKey, subject };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true, publicKey, subject };
};

const subscriptionRowToWebpush = (row) => {
  if (!row?.endpoint) return null;
  return {
    endpoint: row.endpoint,
    expirationTime: row.expirationTime ? new Date(row.expirationTime).getTime() : null,
    keys: {
      p256dh: row.p256dh || undefined,
      auth: row.auth || undefined,
    },
  };
};

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
    
    console.log('=== DEBUG: Push Subscribe ===');
    console.log('req.user:', req.user);
    console.log('assocUserId:', assocUserId);
    console.log('body.userId:', userId);

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

exports.test = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const cfg = ensureVapidConfigured();
    if (!cfg.ok) {
      return res.status(500).json({
        error: 'VAPID não configurado no servidor',
        missing: {
          VAPID_PUBLIC_KEY: !cfg.publicKey,
          VAPID_PRIVATE_KEY: !cfg.privateKey,
          VAPID_SUBJECT: !cfg.subject,
        },
      });
    }

    const { title, body, url } = req.body || {};
    const payload = JSON.stringify({
      title: String(title || 'Nevú'),
      body: String(body || 'Notificação de teste'),
      url: url ? String(url) : '/',
      tag: 'nevu-test',
    });

    console.log('=== DEBUG: Push Test ===');
    console.log('req.user:', req.user);
    console.log('req.user.id:', req.user?.id);

    const subs = await PushSubscription.findAll({ where: { userId: req.user.id } });
    console.log('Subscriptions encontradas:', subs.length);
    
    if (!subs.length) {
      return res.status(404).json({ error: 'Nenhuma inscrição push encontrada para este usuário' });
    }

    const results = [];
    for (const row of subs) {
      const sub = subscriptionRowToWebpush(row);
      if (!sub) continue;
      try {
        await webpush.sendNotification(sub, payload);
        results.push({ endpoint: row.endpoint, ok: true });
      } catch (err) {
        const statusCode = err?.statusCode;
        results.push({ endpoint: row.endpoint, ok: false, statusCode, message: err?.message });
        // 410/404: subscription inválida -> remove
        if (statusCode === 410 || statusCode === 404) {
          try { await row.destroy(); } catch {}
        }
      }
    }

    return res.json({ ok: true, sent: results.filter(r => r.ok).length, results });
  } catch (err) {
    console.error('Erro em push test:', err);
    return res.status(500).json({ error: 'Erro ao enviar push de teste' });
  }
};
