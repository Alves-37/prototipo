const { User, Vaga, Post, PostReaction, PostComment, Connection, Chamado } = require('../models');
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

  if (Object.prototype.hasOwnProperty.call(raw, 'perfilPublico') && raw.perfilPublico === false) {
    return null;
  }

  let habilidades = [];
  try {
    if (Array.isArray(raw.habilidades)) {
      habilidades = raw.habilidades;
    } else if (typeof raw.habilidades === 'string') {
      habilidades = JSON.parse(raw.habilidades);
    }
  } catch (e) {
    habilidades = [];
  }

  let idiomas = [];
  try {
    if (Array.isArray(raw.idiomas)) {
      idiomas = raw.idiomas;
    } else if (typeof raw.idiomas === 'string') {
      idiomas = JSON.parse(raw.idiomas);
    }
  } catch (e) {
    idiomas = [];
  }

  let certificacoes = [];
  try {
    if (Array.isArray(raw.certificacoes)) {
      certificacoes = raw.certificacoes;
    } else if (typeof raw.certificacoes === 'string') {
      certificacoes = JSON.parse(raw.certificacoes);
    }
  } catch (e) {
    certificacoes = [];
  }

  let projetos = [];
  try {
    if (Array.isArray(raw.projetos)) {
      projetos = raw.projetos;
    } else if (typeof raw.projetos === 'string') {
      projetos = JSON.parse(raw.projetos);
    }
  } catch (e) {
    projetos = [];
  }

  let vagasInteresse = [];
  try {
    if (Array.isArray(raw.vagasInteresse)) {
      vagasInteresse = raw.vagasInteresse;
    } else if (typeof raw.vagasInteresse === 'string') {
      vagasInteresse = JSON.parse(raw.vagasInteresse);
    }
  } catch (e) {
    vagasInteresse = [];
  }

  const mostrarTelefone = Object.prototype.hasOwnProperty.call(raw, 'mostrarTelefone') ? !!raw.mostrarTelefone : false;
  const mostrarEndereco = Object.prototype.hasOwnProperty.call(raw, 'mostrarEndereco') ? !!raw.mostrarEndereco : false;

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
          instituicao: raw.instituicao || null,
          resumo: raw.resumo || null,
          habilidades,
          idiomas,
          certificacoes,
          projetos,
          vagasInteresse,
          // Redes
          linkedin: raw.linkedin || null,
          github: raw.github || null,
          portfolio: raw.portfolio || null,
          behance: raw.behance || null,
          instagram: raw.instagram || null,
          twitter: raw.twitter || null,
          // Preferências
          tipoTrabalho: raw.tipoTrabalho || null,
          faixaSalarial: raw.faixaSalarial || null,
          localizacaoPreferida: raw.localizacaoPreferida || null,
          disponibilidade: raw.disponibilidade || null,
          perfilPublico: Object.prototype.hasOwnProperty.call(raw, 'perfilPublico') ? !!raw.perfilPublico : true,
          mostrarTelefone,
          mostrarEndereco,
          telefone: mostrarTelefone ? (raw.telefone || null) : null,
          endereco: mostrarEndereco ? (raw.endereco || null) : null,
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
    const shouldIncludeServicos = tab === 'servicos';
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
          userId: raw.userId,
          createdAt: raw.createdAt,
          dataPublicacao: raw.createdAt,
          nome: author?.nome || 'Usuário',
          texto: raw.texto,
          imageUrl: toAbsolute(req, raw.imageUrl),
          avatarUrl,
          author: author
            ? {
                id: author.id,
                nome: author.nome,
                tipo: author.tipo,
                foto: toAbsolute(req, author.foto),
                logo: toAbsolute(req, author.logo),
              }
            : null,
          likedByMe: req.user ? myLikedSet.has(String(raw.id)) : false,
          counts: {
            likes: reactionMap[String(raw.id)] || 0,
            comments: commentMap[String(raw.id)] || 0,
          },
        });
      }
    }

    if (shouldIncludeServicos) {
      const chamadoWhere = {
        ...(query
          ? {
              [Op.or]: [
                { titulo: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
                { localizacao: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const chamados = await Chamado.findAll({
        where: chamadoWhere,
        include: [
          {
            model: User,
            as: 'usuario',
            attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
          },
        ],
        order: [['data', 'DESC']],
        limit: limitNum,
        offset,
      });

      for (const c of chamados) {
        const raw = typeof c.toJSON === 'function' ? c.toJSON() : c;
        const author = raw.usuario || null;
        const avatarUrl = author?.tipo === 'empresa'
          ? toAbsolute(req, author.logo)
          : toAbsolute(req, author.foto);

        items.push({
          type: 'servico',
          id: raw.id,
          createdAt: raw.data || raw.createdAt,
          dataPublicacao: raw.data || raw.createdAt,
          titulo: raw.titulo,
          descricao: raw.descricao,
          categoria: raw.categoria,
          localizacao: raw.localizacao,
          orcamento: raw.orcamento,
          prazo: raw.prazo,
          prioridade: raw.prioridade,
          status: raw.status,
          nome: author?.nome || 'Usuário',
          avatarUrl,
          author: author
            ? {
                id: author.id,
                nome: author.nome,
                tipo: author.tipo,
              }
            : null,
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
          avatarUrl: raw.empresa ? toAbsolute(req, raw.empresa.logo) : null,
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
        tipo: { [Op.ne]: 'empresa' },
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

      for (const u of users) {
        const pub = toPublicUser(req, u);
        if (!pub) continue;

        items.push({
          type: 'pessoa',
          id: pub.id,
          createdAt: pub.createdAt,
          nome: pub.nome,
          perfil: pub.perfil,
          avatarUrl: pub.perfil?.foto,
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

    const followersCount = await Connection.count({
      where: {
        status: 'accepted',
        addresseeId: userId,
      },
    });

    const followingCount = await Connection.count({
      where: {
        status: 'accepted',
        requesterId: userId,
      },
    });

    return res.json({
      ...pub,
      stats: {
        posts: postsCount,
        connections: connectionsCount,
        followers: followersCount,
        following: followingCount,
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
