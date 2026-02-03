const { Post, PostReaction, PostComment, User, Notificacao } = require('../models');

const toAbsolute = (req, maybePath) => {
  if (!maybePath) return null;
  const f = String(maybePath);
  if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const path = f.startsWith('/') ? f : `/${f}`;
  return `${baseUrl}${path}`;
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

exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const where = {};
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
        return {
          id: raw.id,
          userId: raw.userId,
          texto: raw.texto,
          imageUrl: toAbsolute(req, raw.imageUrl),
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
    const { texto, imageUrl } = req.body || {};

    const t = typeof texto === 'string' ? texto.trim() : '';
    const img = typeof imageUrl === 'string' ? imageUrl.trim() : '';

    if (!t && !img) {
      return res.status(400).json({ error: 'Informe texto ou imagem.' });
    }

    const created = await Post.create({
      userId,
      texto: t || null,
      imageUrl: img || null,
    });

    const post = await Post.findByPk(created.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof post.toJSON === 'function' ? post.toJSON() : post;

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
      texto: raw.texto,
      imageUrl: toAbsolute(req, raw.imageUrl),
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
      const t = typeof texto === 'string' ? texto.trim() : '';
      patch.texto = t ? t : null;
    }

    if (imageUrl !== undefined) {
      const img = typeof imageUrl === 'string' ? imageUrl.trim() : '';
      patch.imageUrl = img ? img : null;
    }

    const nextTexto = Object.prototype.hasOwnProperty.call(patch, 'texto') ? patch.texto : post.texto;
    const nextImage = Object.prototype.hasOwnProperty.call(patch, 'imageUrl') ? patch.imageUrl : post.imageUrl;

    if (!nextTexto && !nextImage) {
      return res.status(400).json({ error: 'Informe texto ou imagem.' });
    }

    await post.update(patch);

    const withAuthor = await Post.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'nome', 'tipo', 'foto', 'logo'] }],
    });

    const raw = typeof withAuthor.toJSON === 'function' ? withAuthor.toJSON() : withAuthor;

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

    const post = await Post.findByPk(id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });

    const existing = await PostReaction.findOne({ where: { postId: id, userId } });

    if (existing) {
      await existing.destroy();
    } else {
      await PostReaction.create({ postId: id, userId, type: 'like' });
    }

    const likes = await PostReaction.count({ where: { postId: id } });

    // Notificação para o dono do post (somente quando adiciona like)
    try {
      const postOwnerId = post.userId;
      if (!existing && postOwnerId && Number(postOwnerId) !== Number(userId)) {
        const actorName = req.user?.nome || 'Alguém';
        const notif = await Notificacao.create({
          usuarioId: postOwnerId,
          tipo: 'sistema',
          titulo: 'Curtida',
          mensagem: `${actorName} curtiu seu post.`,
          referenciaTipo: 'outro',
          referenciaId: Number(id),
          lida: false,
        });

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
      console.error('Falha ao criar/emitir notificação de curtida:', e);
    }

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('post:like', {
          postId: Number(id),
          userId: Number(userId),
          liked: !existing,
          likes,
        });
      }
    } catch (e) {
      console.error('Falha ao emitir post:like:', e);
    }

    return res.json({
      postId: Number(id),
      liked: !existing,
      likes,
    });
  } catch (err) {
    console.error('Erro ao curtir/descurtir post:', err);
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

    const t = typeof texto === 'string' ? texto.trim() : '';
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

    const t = typeof texto === 'string' ? texto.trim() : '';
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
