const { PushSubscription } = require('../models');
const webpush = require('web-push');

// Configurar VAPID keys (você precisará gerar essas chaves)
// Execute: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3QTnpC_2MYqXhVeY6VkJJQXJJQXJJQXJJQXJJQXI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'your-private-key-here';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:suporte@nevu.co.mz';

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Inscrever usuário para notificações push
exports.subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const usuarioId = req.user.id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Dados de inscrição inválidos' });
    }

    // Verificar se já existe uma inscrição com este endpoint
    const existing = await PushSubscription.findOne({
      where: { endpoint: subscription.endpoint }
    });

    if (existing) {
      // Atualizar se for do mesmo usuário
      if (existing.usuarioId === usuarioId) {
        await existing.update({
          keys: subscription.keys,
          expirationTime: subscription.expirationTime,
          userAgent: req.headers['user-agent'],
          active: true
        });
        return res.json({ message: 'Inscrição atualizada com sucesso' });
      } else {
        // Se for de outro usuário, remover a antiga e criar nova
        await existing.destroy();
      }
    }

    // Criar nova inscrição
    await PushSubscription.create({
      usuarioId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: subscription.expirationTime,
      userAgent: req.headers['user-agent'],
      active: true
    });

    res.json({ message: 'Inscrito para notificações push com sucesso' });
  } catch (error) {
    console.error('Erro ao inscrever para push:', error);
    res.status(500).json({ error: 'Erro ao processar inscrição' });
  }
};

// Cancelar inscrição
exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const usuarioId = req.user.id;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint não fornecido' });
    }

    await PushSubscription.destroy({
      where: {
        usuarioId,
        endpoint
      }
    });

    res.json({ message: 'Inscrição cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar inscrição:', error);
    res.status(500).json({ error: 'Erro ao cancelar inscrição' });
  }
};

// Enviar notificação push para um usuário específico
exports.sendToUser = async (usuarioId, payload) => {
  try {
    const subscriptions = await PushSubscription.findAll({
      where: {
        usuarioId,
        active: true
      }
    });

    if (subscriptions.length === 0) {
      console.log(`Nenhuma inscrição ativa para usuário ${usuarioId}`);
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          return { success: true };
        } catch (error) {
          console.error(`Erro ao enviar push para ${sub.endpoint}:`, error);
          
          // Se a inscrição expirou ou é inválida, desativar
          if (error.statusCode === 410 || error.statusCode === 404) {
            await sub.update({ active: false });
          }
          
          return { success: false, error };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    return { sent, failed };
  } catch (error) {
    console.error('Erro ao enviar notificações push:', error);
    return { sent: 0, failed: 0, error };
  }
};

// Enviar notificação para todos os usuários
exports.sendToAll = async (payload, excludeUserId = null) => {
  try {
    const where = { active: true };
    if (excludeUserId) {
      where.usuarioId = { [require('sequelize').Op.ne]: excludeUserId };
    }

    const subscriptions = await PushSubscription.findAll({ where });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: sub.keys
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload)
          );

          return { success: true };
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await sub.update({ active: false });
          }
          return { success: false };
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - sent;

    return { sent, failed, total: subscriptions.length };
  } catch (error) {
    console.error('Erro ao enviar notificações para todos:', error);
    return { sent: 0, failed: 0, total: 0, error };
  }
};

// Obter chave pública VAPID
exports.getPublicKey = (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
};
