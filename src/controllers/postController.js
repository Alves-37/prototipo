const { Post, PostReaction, PostComment, PostView, PostFeedback, PostCommentReaction, User, Notificacao, PushSubscription } = require('../models');
const webpush = require('web-push');

const getPublicBaseUrl = (req) => {
  try {
    const xfProto = req.get('x-forwarded-proto');
    const xfHost = req.get('x-forwarded-host');
    const proto = xfProto ? String(xfProto).split(',')[0].trim() : req.protocol;
    const host = xfHost ? String(xfHost).split(',')[0].trim() : req.get('host');
    return `${proto}://${host}`;
  } catch {
    return `${req.protocol}://${req.get('host')}`;
  }
};

// Função para enviar push notification
const sendPushNotification = async (userId, title, body, url = null) => {
  try {
    const cfg = ensureVapidConfigured();
    if (!cfg.ok) return;

    const subs = await PushSubscription.findAll({ where: { userId } });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title: String(title),
      body: String(body),
      url: url || '/',
      tag: 'nevu-notification',
    });

    for (const row of subs) {
      try {
        const sub = subscriptionRowToWebpush(row);
        if (!sub) continue;
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          try { await row.destroy(); } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Erro ao enviar push:', err);
  }
};

// Helper functions para VAPID (copiados do pushController)
const ensureVapidConfigured = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { ok: false, missing: { publicKey: !publicKey, privateKey: !privateKey, subject: !subject } };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true, publicKey, privateKey, subject };
};

const subscriptionRowToWebpush = (row) => {
  try {
    const endpoint = String(row.endpoint || '');
    const keys = row.keys || {};
    const p256dh = String(keys.p256dh || '');
    const auth = String(keys.auth || '');

    if (!endpoint || !p256dh || !auth) return null;

    return { endpoint, keys: { p256dh, auth } };
  } catch {
    return null;
  }
};

exports.setInterest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const interested = !!(req.body && req.body.interested);

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const [row] = await PostFeedback.findOrCreate({
      where: { postId: Number(id), userId: Number(userId) },
      defaults: { postId: Number(id), userId: Number(userId), interested },
    });

    if (row) {
      await row.update({ interested });
    }

    return res.json({ ok: true, postId: Number(id), interested });
  } catch (err) {
    console.error('Erro ao registrar interesse no post:', err);
    return res.status(500).json({ error: 'Erro ao registrar interesse no post' });
  }
};

exports.toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, commentId } = req.params;

    const comment = await PostComment.findByPk(commentId);
    if (!comment || String(comment.postId) !== String(id)) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    const existing = await PostCommentReaction.findOne({
      where: { commentId, userId }
    });

    if (existing) {
      await existing.destroy();
    } else {
      await PostCommentReaction.create({ commentId, userId, type: 'like' });
    }

    const likes = await PostCommentReaction.count({ where: { commentId } });

    return res.json({
      commentId: Number(commentId),
      liked: !existing,
      likes
    });
  } catch (err) {
    console.error('Erro ao curtir comentário:', err);
    return res.status(500).json({ error: 'Erro ao reagir ao comentário' });
  }
};

const basicModerateText = (input) => {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return { ok: true, value: '' };

  const lowered = text.toLowerCase();
  const banned = [
    'porn',
    'porno',
    'pornografia',
    'nude',
    'nudes',
    'sexo',
    'conteúdo adulto',
    'conteudo adulto',
    'racista',
    'nazista',
    'ódio',
    'odio',
  ];

  for (const w of banned) {
    if (lowered.includes(w)) {
      return { ok: false, reason: 'Conteúdo não permitido' };
    }
  }

  const linkMatches = text.match(/https?:\/\//gi) || [];
  if (linkMatches.length > 3) {
    return { ok: false, reason: 'Muitos links na publicação' };
  }

  return { ok: true, value: text };
};

const toAbsolute = (req, maybePath) => {
  if (!maybePath) return null;
  const f = String(maybePath);
  if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
  const baseUrl = getPublicBaseUrl(req);
  const path = f.startsWith('/') ? f : `/${f}`;
  return `${baseUrl}${path}`;
};

const normalizeImagens = (req, post) => {
  try {
    const raw = post && (typeof post.toJSON === 'function' ? post.toJSON() : post);
    const imagensRaw = raw?.imagens;
    if (Array.isArray(imagensRaw)) {
      return imagensRaw.map((x) => toAbsolute(req, x)).filter(Boolean);
    }
    if (typeof imagensRaw === 'string' && imagensRaw.trim()) {
      const parsed = JSON.parse(imagensRaw);
      return Array.isArray(parsed) ? parsed.map((x) => toAbsolute(req, x)).filter(Boolean) : [];
    }
  } catch {}
  return [];
};

const publicAuthor = (req, user) => {
  if (!user) return null;
  const raw = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    id: raw.id,
    nome: raw.nome,
    tipo: raw.tipo,
    foto: toAbsolute(req, raw.foto),
    logo: toAbsolute(req, raw.logo),
  };
};

exports.listLikes = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const likes = await PostReaction.findAll({
      where: { postId: id },
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    return res.json({
      postId: Number(id),
      total: likes.length,
      likes: likes.map((r) => {
        const raw = typeof r.toJSON === 'function' ? r.toJSON() : r;
        return {
          id: raw.id,
          postId: raw.postId,
          userId: raw.userId,
          type: raw.type,
          createdAt: raw.createdAt,
          author: publicAuthor(req, raw.author),
        };
      }),
    });
  } catch (err) {
    console.error('Erro ao listar curtidas:', err);
    return res.status(500).json({ error: 'Erro ao listar curtidas' });
  }
};

exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const where = { isHidden: false };
    if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
      const asNumber = Number(userId);
      where.userId = Number.isFinite(asNumber) ? asNumber : String(userId);
    }

    const { rows, count } = await Post.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
        },
      ],
    });

    const postIds = rows.map(p => p.id);

    const reactionCounts = postIds.length
      ? await PostReaction.findAll({
          attributes: ['postId', [PostReaction.sequelize.fn('COUNT', PostReaction.sequelize.col('id')), 'count']],
          where: { postId: postIds },
          group: ['postId'],
          raw: true,
        })
      : [];

    const commentCounts = postIds.length
      ? await PostComment.findAll({
          attributes: ['postId', [PostComment.sequelize.fn('COUNT', PostComment.sequelize.col('id')), 'count']],
          where: { postId: postIds },
          group: ['postId'],
          raw: true,
        })
      : [];

    const reactionMap = Object.fromEntries(reactionCounts.map(r => [String(r.postId), Number(r.count) || 0]));
    const commentMap = Object.fromEntries(commentCounts.map(r => [String(r.postId), Number(r.count) || 0]));

    return res.json({
      posts: rows.map(p => {
        const raw = typeof p.toJSON === 'function' ? p.toJSON() : p;
        const imagens = normalizeImagens(req, raw);
        return {
          id: raw.id,
          userId: raw.userId,
          postType: raw.postType,
          texto: raw.texto,
          imageUrl: toAbsolute(req, raw.imageUrl),
          imagens,
          servicePrice: raw.servicePrice,
          serviceCategory: raw.serviceCategory,
          serviceLocation: raw.serviceLocation,
          serviceWhatsapp: raw.serviceWhatsapp,
          ctaText: raw.ctaText,
          ctaUrl: raw.ctaUrl,
          createdAt: raw.createdAt,
          author: publicAuthor(req, raw.author),
          counts: {
            likes: reactionMap[String(raw.id)] || 0,
            comments: commentMap[String(raw.id)] || 0,
          },
        };
      }),
      total: count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (err) {
    console.error('Erro ao listar posts:', err);
    return res.status(500).json({ error: 'Erro ao listar posts' });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      texto,
      imageUrl,
      postType,
      servicePrice,
      serviceCategory,
      serviceLocation,
      serviceWhatsapp,
      ctaText,
      ctaUrl,
    } = req.body || {};

    const type = String(postType || 'normal').toLowerCase();
    if (!['normal', 'servico'].includes(type)) {
      return res.status(400).json({ error: 'Tipo de post inválido' });
    }

    if (type === 'servico' && req.user.tipo !== 'empresa') {
      return res.status(403).json({ error: 'Apenas empresas podem publicar serviços.' });
    }

    const mod = basicModerateText(texto);
    if (!mod.ok) {
      return res.status(400).json({ error: mod.reason || 'Conteúdo não permitido' });
    }
    const t = mod.value;
    const imgFromBody = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    const files = Array.isArray(req.files) ? req.files : [];
    const imagensFromFiles = files
      .slice(0, 5)
      .map(f => (f && f.filename ? `/uploads/${f.filename}` : null))
      .filter(Boolean);
    const imagensFromBody = (() => {
      try {
        if (req.body && req.body.imagens) {
          const val = req.body.imagens;
          if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean).slice(0, 5);
          if (typeof val === 'string' && val.trim()) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean).slice(0, 5);
          }
        }
      } catch {}
      return [];
    })();
    const imagens = imagensFromFiles.length ? imagensFromFiles : imagensFromBody;
    const img = imagens[0] || imgFromBody;

    const svcPrice = typeof servicePrice === 'string' ? servicePrice.trim() : '';
    const svcCategory = typeof serviceCategory === 'string' ? serviceCategory.trim() : '';
    const svcLocation = typeof serviceLocation === 'string' ? serviceLocation.trim() : '';
    const svcWhatsapp = typeof serviceWhatsapp === 'string' ? serviceWhatsapp.trim() : '';
    const ctaT = typeof ctaText === 'string' ? ctaText.trim() : '';
    const ctaU = typeof ctaUrl === 'string' ? ctaUrl.trim() : '';

    if (type === 'servico') {
      if (!svcCategory) {
        return res.status(400).json({ error: 'Categoria do serviço é obrigatória.' });
      }
      if (!svcLocation) {
        return res.status(400).json({ error: 'Localização do serviço é obrigatória.' });
      }
      if (!t && !img) {
        return res.status(400).json({ error: 'Informe texto ou imagem.' });
      }
    }

    if (!t && !img && (!Array.isArray(imagens) || !imagens.length)) {
      return res.status(400).json({ error: 'Informe texto ou imagem.' });
    }

    const created = await Post.create({
      userId,
      postType: type,
      texto: t || null,
      imageUrl: img || null,
      imagens: Array.isArray(imagens) ? imagens : [],
      servicePrice: svcPrice || null,
      serviceCategory: svcCategory || null,
      serviceLocation: svcLocation || null,
      serviceWhatsapp: svcWhatsapp || null,
      ctaText: ctaT || null,
      ctaUrl: ctaU || null,
    });

    const post = await Post.findByPk(created.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof post.toJSON === 'function' ? post.toJSON() : post;
    const absImagens = normalizeImagens(req, raw);

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const author = raw.author || null;
        const avatarUrl = author?.tipo === 'empresa'
          ? toAbsolute(req, author.logo)
          : toAbsolute(req, author.foto);

        io.emit('post:new', {
          item: {
            type: 'post',
            id: raw.id,
            createdAt: raw.createdAt,
            dataPublicacao: raw.createdAt,
            nome: author?.nome || 'Usuário',
            texto: raw.texto,
            imageUrl: toAbsolute(req, raw.imageUrl),
            imagens: absImagens,
            postType: raw.postType,
            servicePrice: raw.servicePrice,
            serviceCategory: raw.serviceCategory,
            serviceLocation: raw.serviceLocation,
            serviceWhatsapp: raw.serviceWhatsapp,
            ctaText: raw.ctaText,
            ctaUrl: raw.ctaUrl,
            avatarUrl,
            likedByMe: false,
            counts: { likes: 0, comments: 0 },
          },
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:new:', e);
    }

    return res.status(201).json({
      id: raw.id,
      userId: raw.userId,
      postType: raw.postType,
      texto: raw.texto,
      imageUrl: toAbsolute(req, raw.imageUrl),
      imagens: absImagens,
      servicePrice: raw.servicePrice,
      serviceCategory: raw.serviceCategory,
      serviceLocation: raw.serviceLocation,
      serviceWhatsapp: raw.serviceWhatsapp,
      ctaText: raw.ctaText,
      ctaUrl: raw.ctaUrl,
      createdAt: raw.createdAt,
      author: publicAuthor(req, raw.author),
      counts: { likes: 0, comments: 0 },
    });
  } catch (err) {
    console.error('Erro ao criar post:', err);
    return res.status(500).json({ error: 'Erro ao criar post' });
  }
};

exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { texto, imageUrl } = req.body || {};

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    if (Number(post.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const patch = {};

    if (texto !== undefined) {
      const mod = basicModerateText(texto);
      if (!mod.ok) {
        return res.status(400).json({ error: mod.reason || 'Conteúdo não permitido' });
      }
      const t = mod.value;
      patch.texto = t ? t : null;
    }

    if (imageUrl !== undefined) {
      const img = typeof imageUrl === 'string' ? imageUrl.trim() : '';
      patch.imageUrl = img ? img : null;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length) {
      const imagensFromFiles = files
        .slice(0, 5)
        .map(f => (f && f.filename ? `/uploads/${f.filename}` : null))
        .filter(Boolean);
      patch.imagens = imagensFromFiles;
      patch.imageUrl = imagensFromFiles[0] || patch.imageUrl || null;
    }

    const nextTexto = Object.prototype.hasOwnProperty.call(patch, 'texto') ? patch.texto : post.texto;
    const nextImage = Object.prototype.hasOwnProperty.call(patch, 'imageUrl') ? patch.imageUrl : post.imageUrl;
    const nextImagens = Object.prototype.hasOwnProperty.call(patch, 'imagens') ? patch.imagens : post.imagens;

    if (!nextTexto && !nextImage && (!Array.isArray(nextImagens) || !nextImagens.length)) {
      return res.status(400).json({ error: 'Informe texto ou imagem.' });
    }

    await post.update(patch);

    const withAuthor = await Post.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof withAuthor.toJSON === 'function' ? withAuthor.toJSON() : withAuthor;
    const absImagens = normalizeImagens(req, raw);

    const likes = await PostReaction.count({ where: { postId: post.id } });
    const comments = await PostComment.count({ where: { postId: post.id } });

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('post:update', {
          postId: Number(post.id),
          item: {
            type: 'post',
            id: raw.id,
            userId: raw.userId,
            createdAt: raw.createdAt,
            dataPublicacao: raw.createdAt,
            nome: raw.author?.nome || 'Usuário',
            texto: raw.texto,
            imageUrl: toAbsolute(req, raw.imageUrl),
            imagens: absImagens,
            avatarUrl: raw.author?.tipo === 'empresa' ? toAbsolute(req, raw.author?.logo) : toAbsolute(req, raw.author?.foto),
            counts: { likes, comments },
          },
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:update:', e);
    }

    return res.json({
      id: raw.id,
      userId: raw.userId,
      texto: raw.texto,
      imageUrl: toAbsolute(req, raw.imageUrl),
      imagens: absImagens,
      createdAt: raw.createdAt,
      author: publicAuthor(req, raw.author),
      counts: { likes, comments },
    });
  } catch (err) {
    console.error('Erro ao atualizar post:', err);
    return res.status(500).json({ error: 'Erro ao atualizar post' });
  }
};

exports.remove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    if (Number(post.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await PostReaction.destroy({ where: { postId: id } });
    await PostComment.destroy({ where: { postId: id } });
    await post.destroy();

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('post:delete', { postId: Number(id), userId: Number(userId) });
      }
    } catch (e) {
      console.error('Falha ao emitir post:delete:', e);
    }

    return res.json({ ok: true, postId: Number(id) });
  } catch (err) {
    console.error('Erro ao eliminar post:', err);
    return res.status(500).json({ error: 'Erro ao eliminar post' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { type } = req.body || {};

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const existing = await PostReaction.findOne({ where: { postId: id, userId } });

    let liked = false;
    let finalType = type || 'like';

    if (existing) {
      if (!type || existing.type === type) {
        // Se não passou tipo ou é o mesmo tipo, remove (unlike)
        await existing.destroy();
        liked = false;
        finalType = null;
      } else {
        // Se passou um tipo diferente, atualiza a reação
        await existing.update({ type });
        liked = true;
        finalType = type;
      }
    } else if (type !== null) {
      // Se não existia e o tipo não é explicitamente nulo, cria nova
      await PostReaction.create({ postId: id, userId, type: finalType });
      liked = true;
    }

    const likes = await PostReaction.count({ where: { postId: id } });

    // Notificação para o dono do post (somente quando adiciona ou muda reação)
    try {
      const postOwnerId = post.userId;
      if (liked && postOwnerId && Number(postOwnerId) !== Number(userId)) {
        const actorName = req.user?.nome || 'Alguém';
        const reactionLabel = finalType === 'like' ? 'curtiu' : 'reagiu ao';
        const notif = await Notificacao.create({
          usuarioId: postOwnerId,
          tipo: 'sistema',
          titulo: 'Reação',
          mensagem: `${actorName} ${reactionLabel} seu post.`,
          referenciaTipo: 'outro',
          referenciaId: Number(id),
          lida: false,
        });

        // Enviar push notification
        await sendPushNotification(
          postOwnerId,
          'Nova reação no seu post',
          `${actorName} ${reactionLabel} seu post.`,
          `/post/${id}`
        );

        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          io.to(`user:${postOwnerId}`).emit('notification:new', {
            id: notif.id,
            usuarioId: postOwnerId,
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            lida: notif.lida,
            createdAt: notif.createdAt,
          });
        }
      }
    } catch (e) {
      console.error('Falha ao criar/emitir notificação de reação:', e);
    }

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('post:like', {
          postId: Number(id),
          userId: Number(userId),
          liked,
          type: finalType,
          likes,
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:like:', e);
    }

    return res.json({
      postId: Number(id),
      liked,
      type: finalType,
      likes,
    });
  } catch (err) {
    console.error('Erro ao reagir ao post:', err);
    return res.status(500).json({ error: 'Erro ao reagir ao post' });
  }
};

exports.listComments = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const comments = await PostComment.findAll({
      where: { postId: id },
      order: [['createdAt', 'ASC']],
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    return res.json({
      postId: Number(id),
      comments: comments.map(c => {
        const raw = typeof c.toJSON === 'function' ? c.toJSON() : c;
        return {
          id: raw.id,
          postId: raw.postId,
          userId: raw.userId,
          texto: raw.texto,
          createdAt: raw.createdAt,
          author: publicAuthor(req, raw.author),
        };
      }),
    });
  } catch (err) {
    console.error('Erro ao listar comentários:', err);
    return res.status(500).json({ error: 'Erro ao listar comentários' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { texto } = req.body || {};

    const mod = basicModerateText(texto);
    if (!mod.ok) {
      return res.status(400).json({ error: mod.reason || 'Conteúdo não permitido' });
    }
    const t = mod.value;
    if (!t) return res.status(400).json({ error: 'Comentário inválido' });

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const created = await PostComment.create({ postId: id, userId, texto: t });

    const withAuthor = await PostComment.findByPk(created.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof withAuthor.toJSON === 'function' ? withAuthor.toJSON() : withAuthor;

    const payload = {
      id: raw.id,
      postId: raw.postId,
      userId: raw.userId,
      texto: raw.texto,
      createdAt: raw.createdAt,
      author: publicAuthor(req, raw.author),
    };

    // Notificação para o dono do post
    try {
      const postOwnerId = post.userId;
      if (postOwnerId && Number(postOwnerId) !== Number(userId)) {
        const actorName = req.user?.nome || 'Alguém';
        const preview = String(t).length > 60 ? `${String(t).slice(0, 60)}...` : String(t);
        const notif = await Notificacao.create({
          usuarioId: postOwnerId,
          tipo: 'sistema',
          titulo: 'Comentário',
          mensagem: `${actorName} comentou no seu post: ${preview}`,
          referenciaTipo: 'outro',
          referenciaId: Number(id),
          lida: false,
        });

        // Enviar push notification
        await sendPushNotification(
          postOwnerId,
          'Novo comentário no seu post',
          `${actorName} comentou: ${preview}`,
          `/post/${id}`
        );

        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          io.to(`user:${postOwnerId}`).emit('notification:new', {
            id: notif.id,
            usuarioId: postOwnerId,
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            lida: notif.lida,
            createdAt: notif.createdAt,
          });
        }
      }
    } catch (e) {
      console.error('Falha ao criar/emitir notificação de comentário:', e);
    }

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const comments = await PostComment.count({ where: { postId: id } });
        io.emit('post:comment', {
          postId: Number(id),
          userId: Number(userId),
          comment: payload,
          comments,
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:comment:', e);
    }

    return res.status(201).json(payload);
  } catch (err) {
    console.error('Erro ao adicionar comentário:', err);
    return res.status(500).json({ error: 'Erro ao comentar' });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, commentId } = req.params;
    const { texto } = req.body || {};

    const mod = basicModerateText(texto);
    if (!mod.ok) {
      return res.status(400).json({ error: mod.reason || 'Conteúdo não permitido' });
    }
    const t = mod.value;
    if (!t) return res.status(400).json({ error: 'Comentário inválido' });

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const comment = await PostComment.findByPk(commentId);
    if (!comment || String(comment.postId) !== String(id)) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    if (Number(comment.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Sem permissão para editar este comentário' });
    }

    await comment.update({ texto: t });

    const withAuthor = await PostComment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof withAuthor.toJSON === 'function' ? withAuthor.toJSON() : withAuthor;

    const payload = {
      id: raw.id,
      postId: raw.postId,
      userId: raw.userId,
      texto: raw.texto,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      author: publicAuthor(req, raw.author),
    };

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const comments = await PostComment.count({ where: { postId: id } });
        io.emit('post:comment:update', {
          postId: Number(id),
          userId: Number(userId),
          comment: payload,
          comments,
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:comment:update:', e);
    }

    return res.json(payload);
  } catch (err) {
    console.error('Erro ao editar comentário:', err);
    return res.status(500).json({ error: 'Erro ao editar comentário' });
  }
};

exports.removeComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, commentId } = req.params;

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const comment = await PostComment.findByPk(commentId);
    if (!comment || String(comment.postId) !== String(id)) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    const isCommentOwner = Number(comment.userId) === Number(userId);
    const isPostOwner = Number(post.userId) === Number(userId);

    if (!isCommentOwner && !isPostOwner) {
      return res.status(403).json({ error: 'Sem permissão para eliminar este comentário' });
    }

    await comment.destroy();

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const comments = await PostComment.count({ where: { postId: id } });
        io.emit('post:comment:delete', {
          postId: Number(id),
          userId: Number(userId),
          commentId: Number(commentId),
          comments,
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:comment:delete:', e);
    }

    return res.json({
      ok: true,
      postId: Number(id),
      commentId: Number(commentId),
    });
  } catch (err) {
    console.error('Erro ao eliminar comentário:', err);
    return res.status(500).json({ error: 'Erro ao eliminar comentário' });
  }
};

exports.registerView = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || null;

    const viewerUserId = req.user?.id ? Number(req.user.id) : null;
    await PostView.create({
      postId: Number(id),
      viewerUserId,
      viewerIp: ip ? String(ip).slice(0, 120) : null,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao registrar visualização:', err);
    return res.status(500).json({ error: 'Erro ao registrar visualização' });
  }
};

exports.getCompanyPostMetrics = async (req, res) => {
  try {
    const me = req.user;
    if (!me || me.tipo !== 'empresa') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const limitRaw = Number(req.query?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 60;

    const posts = await Post.findAll({
      where: { userId: me.id, isHidden: false },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'texto', 'imageUrl', 'postType', 'createdAt'],
      limit,
    });

    const postIds = posts.map(p => p.id);

    const reactionsByType = postIds.length
      ? await PostReaction.findAll({
          attributes: [
            'postId',
            'type',
            [PostReaction.sequelize.fn('COUNT', PostReaction.sequelize.col('id')), 'count'],
          ],
          where: { postId: postIds },
          group: ['postId', 'type'],
          raw: true,
        })
      : [];

    const viewsCounts = postIds.length
      ? await PostView.findAll({
          attributes: [
            'postId',
            [PostView.sequelize.fn('COUNT', PostView.sequelize.col('id')), 'count'],
          ],
          where: { postId: postIds },
          group: ['postId'],
          raw: true,
        })
      : [];

    const viewsMap = Object.fromEntries(viewsCounts.map(v => [String(v.postId), Number(v.count) || 0]));

    const reactionTypeMap = new Map();
    reactionsByType.forEach(r => {
      const postId = String(r.postId);
      const type = String(r.type || 'like');
      const count = Number(r.count) || 0;
      const prev = reactionTypeMap.get(postId) || {};
      reactionTypeMap.set(postId, { ...prev, [type]: count });
    });

    const items = posts.map(p => {
      const raw = typeof p.toJSON === 'function' ? p.toJSON() : p;
      const reactions = reactionTypeMap.get(String(raw.id)) || {};
      const reactionsTotal = Object.values(reactions).reduce((sum, n) => sum + (Number(n) || 0), 0);
      const views = viewsMap[String(raw.id)] || 0;

      return {
        id: raw.id,
        postType: raw.postType,
        texto: raw.texto,
        imageUrl: toAbsolute(req, raw.imageUrl),
        createdAt: raw.createdAt,
        metrics: {
          reactionsTotal,
          reactions,
          views,
        },
      };
    });

    const totalsPosts = await Post.count({ where: { userId: me.id, isHidden: false } });

    const runCountQuery = async (sql) => {
      const out = await Post.sequelize.query(sql, { replacements: { userId: Number(me.id) } });
      const rows = Array.isArray(out) ? out[0] : out;
      const first = Array.isArray(rows) && rows.length ? rows[0] : null;
      const val = first ? (first.count ?? first.total ?? Object.values(first)[0]) : 0;
      return Number(val) || 0;
    };

    const dialect = (() => {
      try {
        return String(Post.sequelize.getDialect ? Post.sequelize.getDialect() : '').toLowerCase();
      } catch {
        return '';
      }
    })();

    const q = (id) => {
      if (dialect === 'postgres') return `"${id}"`;
      if (dialect === 'mariadb' || dialect === 'mysql') return `\`${id}\``;
      return `"${id}"`;
    };

    const isHiddenExpr = (() => {
      if (dialect === 'postgres') return `${q('isHidden')} = false`;
      return `${q('isHidden')} = 0`;
    })();

    const totalsReactions = await runCountQuery(
      `SELECT COUNT(pr.${q('id')}) AS count\n`
      + `FROM ${q('post_reactions')} pr\n`
      + `JOIN ${q('posts')} p ON p.${q('id')} = pr.${q('postId')}\n`
      + `WHERE p.${q('userId')} = :userId AND p.${isHiddenExpr}`
    );

    const totalsViews = await runCountQuery(
      `SELECT COUNT(pv.${q('id')}) AS count\n`
      + `FROM ${q('post_views')} pv\n`
      + `JOIN ${q('posts')} p ON p.${q('id')} = pv.${q('postId')}\n`
      + `WHERE p.${q('userId')} = :userId AND p.${isHiddenExpr}`
    );

    const totals = { posts: totalsPosts, reactions: totalsReactions, views: totalsViews };

    return res.json({ totals, posts: items });
  } catch (err) {
    console.error('Erro ao buscar métricas de posts da empresa:', err);
    return res.status(500).json({ error: 'Erro ao buscar métricas de posts da empresa' });
  }
};
