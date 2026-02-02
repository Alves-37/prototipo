const { User, Vaga, Post, PostReaction, PostComment, Connection } = require('../models');
const { Op } = require('sequelize');

const toAbsolute = (req, maybePath) => {
  if (!maybePath) return null;
  const f = String(maybePath);
  if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const path = f.startsWith('/') ? f : `/${f}`;
  return `${baseUrl}${path}`;
};

const toPublicUser = (req, u) => {
  if (!u) return null;
  const raw = typeof u.toJSON === 'function' ? u.toJSON() : u;

  return {
    id: raw.id,
    nome: raw.nome,
    tipo: raw.tipo,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    perfil: raw.tipo === 'empresa'
      ? {
          logo: toAbsolute(req, raw.logo),
          setor: raw.setor || null,
          tamanho: raw.tamanho || null,
          descricao: raw.descricao || null,
          website: raw.website || null,
          endereco: raw.endereco || null,
        }
      : {
          foto: toAbsolute(req, raw.foto),
          bio: raw.bio || null,
          experiencia: raw.experiencia || null,
          formacao: raw.formacao || null,
          endereco: raw.endereco || null,
        },
  };
};

exports.getFeed = async (req, res) => {
  try {
    const { tab = 'todos', q = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const items = [];

    const shouldIncludeVagas = tab === 'todos' || tab === 'vagas';
    const shouldIncludePessoas = tab === 'pessoas';
    const shouldIncludePosts = tab === 'todos' || tab === 'posts' || tab === 'postagens';

    if (shouldIncludePosts) {
      const postWhere = {
        ...(query
          ? {
              texto: { [Op.like]: `%${query}%` },
            }
          : {}),
      };

      const posts = await Post.findAll({
        where: postWhere,
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: limitNum,
        offset,
      });

      const postIds = posts.map(p => p.id);

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

      const myLikedSet = new Set();
      if (req.user && postIds.length) {
        const myReactions = await PostReaction.findAll({
          attributes: ['postId'],
          where: { postId: postIds, userId: req.user.id },
          raw: true,
        });
        for (const r of myReactions) {
          myLikedSet.add(String(r.postId));
        }
      }

      for (const p of posts) {
        const raw = typeof p.toJSON === 'function' ? p.toJSON() : p;
        const author = raw.author || null;
        const avatarUrl = author?.tipo === 'empresa'
          ? toAbsolute(req, author.logo)
          : toAbsolute(req, author.foto);

        items.push({
          type: 'post',
          id: raw.id,
          createdAt: raw.createdAt,
          dataPublicacao: raw.createdAt,
          nome: author?.nome || 'Usuário',
          texto: raw.texto,
          imageUrl: toAbsolute(req, raw.imageUrl),
          avatarUrl,
          likedByMe: req.user ? myLikedSet.has(String(raw.id)) : false,
          counts: {
            likes: reactionMap[String(raw.id)] || 0,
            comments: commentMap[String(raw.id)] || 0,
          },
        });
      }
    }

    if (shouldIncludeVagas) {
      const vagaWhere = {
        status: 'publicada',
        ...(query
          ? {
              [Op.or]: [
                { titulo: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
                { area: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const vagas = await Vaga.findAll({
        where: vagaWhere,
        include: [
          {
            model: User,
            as: 'empresa',
            attributes: ['id', 'nome', 'logo', 'setor', 'tamanho'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: limitNum,
        offset,
      });

      for (const v of vagas) {
        const raw = typeof v.toJSON === 'function' ? v.toJSON() : v;
        items.push({
          type: 'vaga',
          id: raw.id,
          createdAt: raw.createdAt,
          dataPublicacao: raw.dataPublicacao || raw.createdAt,
          titulo: raw.titulo,
          descricao: raw.descricao,
          area: raw.area,
          localizacao: raw.localizacao,
          modalidade: raw.modalidade,
          tipoContrato: raw.tipoContrato,
          nivelExperiencia: raw.nivelExperiencia,
          salario: raw.salario,
          empresa: raw.empresa ? raw.empresa.nome : null,
          empresaObj: raw.empresa
            ? {
                id: raw.empresa.id,
                nome: raw.empresa.nome,
                logo: toAbsolute(req, raw.empresa.logo),
                setor: raw.empresa.setor || null,
                tamanho: raw.empresa.tamanho || null,
              }
            : null,
        });
      }
    }

    if (shouldIncludePessoas) {
      const userWhere = {
        ...(query
          ? {
              nome: { [Op.like]: `%${query}%` },
            }
          : {}),
      };

      const users = await User.findAll({
        where: userWhere,
        order: [['createdAt', 'DESC']],
        limit: limitNum,
        offset,
      });

      const companyIds = users
        .filter(u => {
          const raw = typeof u?.toJSON === 'function' ? u.toJSON() : u;
          return raw?.tipo === 'empresa';
        })
        .map(u => {
          const raw = typeof u?.toJSON === 'function' ? u.toJSON() : u;
          return raw?.id;
        })
        .filter(Boolean);

      const companyPostsRows = companyIds.length
        ? await Post.findAll({
            attributes: ['userId', [Post.sequelize.fn('COUNT', Post.sequelize.col('id')), 'count']],
            where: { userId: companyIds },
            group: ['userId'],
            raw: true,
          })
        : [];
      const companyPostsMap = Object.fromEntries(companyPostsRows.map(r => [String(r.userId), Number(r.count) || 0]));

      const companyVagasRows = companyIds.length
        ? await Vaga.findAll({
            attributes: ['empresaId', [Vaga.sequelize.fn('COUNT', Vaga.sequelize.col('id')), 'count']],
            where: { empresaId: companyIds, status: 'publicada' },
            group: ['empresaId'],
            raw: true,
          })
        : [];
      const companyVagasMap = Object.fromEntries(companyVagasRows.map(r => [String(r.empresaId), Number(r.count) || 0]));

      const personIds = users
        .filter(u => {
          const raw = typeof u?.toJSON === 'function' ? u.toJSON() : u;
          return raw?.tipo !== 'empresa';
        })
        .map(u => {
          const raw = typeof u?.toJSON === 'function' ? u.toJSON() : u;
          return raw?.id;
        })
        .filter(Boolean);

      const personPostsRows = personIds.length
        ? await Post.findAll({
            attributes: ['userId', [Post.sequelize.fn('COUNT', Post.sequelize.col('id')), 'count']],
            where: { userId: personIds },
            group: ['userId'],
            raw: true,
          })
        : [];
      const personPostsMap = Object.fromEntries(personPostsRows.map(r => [String(r.userId), Number(r.count) || 0]));

      for (const u of users) {
        const pub = toPublicUser(req, u);
        if (!pub) continue;

        const perfil = pub.perfil || {};
        const hasProfileInfo = pub.tipo === 'empresa'
          ? !!(perfil.descricao || perfil.endereco || perfil.setor || perfil.website)
          : !!(perfil.bio || perfil.experiencia || perfil.formacao || perfil.endereco || perfil.resumo || (Array.isArray(perfil.habilidades) && perfil.habilidades.length));
        if (!hasProfileInfo) continue;

        if (pub.tipo === 'empresa') {
          const postsCount = companyPostsMap[String(pub.id)] || 0;
          const vagasCount = companyVagasMap[String(pub.id)] || 0;
          if (postsCount === 0 && vagasCount === 0) continue;
        } else {
          const postsCount = personPostsMap[String(pub.id)] || 0;
          if (postsCount === 0) continue;
        }

        items.push({
          type: pub.tipo === 'empresa' ? 'empresa' : 'pessoa',
          id: pub.id,
          createdAt: pub.createdAt,
          nome: pub.nome,
          perfil: pub.perfil,
          avatarUrl: pub.tipo === 'empresa' ? pub.perfil?.logo : pub.perfil?.foto,
        });
      }
    }

    items.sort((a, b) => {
      const da = new Date(a.dataPublicacao || a.createdAt || 0).getTime();
      const db = new Date(b.dataPublicacao || b.createdAt || 0).getTime();
      return db - da;
    });

    const paged = items.slice(0, limitNum);

    return res.json({
      tab,
      page: pageNum,
      limit: limitNum,
      query,
      items: paged,
      counts: {
        totalReturned: paged.length,
      },
    });
  } catch (err) {
    console.error('Erro ao montar feed:', err);
    return res.status(500).json({ error: 'Erro ao carregar feed' });
  }
};

exports.getPublicUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ID inválido' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const pub = toPublicUser(req, user);
    if (!pub) return res.status(404).json({ error: 'Usuário não encontrado' });

    const numericId = Number(id);
    const userId = Number.isFinite(numericId) ? numericId : id;

    const postsCount = await Post.count({ where: { userId } });

    const connectionsCount = await Connection.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
      },
    });

    return res.json({
      ...pub,
      stats: {
        posts: postsCount,
        connections: connectionsCount,
      },
    });
  } catch (err) {
    console.error('Erro ao buscar usuário público:', err);
    return res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
};

exports.listPublicUsers = async (req, res) => {
  try {
    const { tipo = 'todos', q = '', page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      ...(tipo !== 'todos' ? { tipo } : {}),
      ...(query ? { nome: { [Op.like]: `%${query}%` } } : {}),
    };

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    return res.json({
      users: rows.map(u => toPublicUser(req, u)).filter(Boolean),
      total: count,
      page: pageNum,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (err) {
    console.error('Erro ao listar usuários públicos:', err);
    return res.status(500).json({ error: 'Erro ao listar usuários' });
  }
};
