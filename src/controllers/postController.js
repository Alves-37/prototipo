const { Post, PostReaction, PostComment, User } = require('../models');

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
