const { User, Post, Vaga, Produto, Chamado, PostReaction, PostComment, ProdutoComment, Op } = require('../models');

// Função auxiliar para normalizar imagens
const normalizeImagens = (req, imagens) => {
  if (!imagens) return [];
  if (typeof imagens === 'string') {
    try {
      const parsed = JSON.parse(imagens);
      return Array.isArray(parsed) ? parsed : [imagens];
    } catch {
      return [imagens];
    }
  }
  if (Array.isArray(imagens)) return imagens;
  return [];
};

const getPublicBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const toAbsolute = (req, maybePath) => {
  if (!maybePath) return null;
  const f = String(maybePath);
  if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
  const baseUrl = getPublicBaseUrl(req);
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
          capa: toAbsolute(req, raw.capa),
          logo: toAbsolute(req, raw.logo),
          setor: raw.setor || null,
          tamanho: raw.tamanho || null,
          descricao: raw.descricao || null,
          website: raw.website || null,
          endereco: raw.endereco || null,
        }
      : {
          foto: toAbsolute(req, raw.foto),
          capa: toAbsolute(req, raw.capa),
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
          linkedin: raw.linkedin || null,
          github: raw.github || null,
          portfolio: raw.portfolio || null,
          behance: raw.behance || null,
          instagram: raw.instagram || null,
          twitter: raw.twitter || null,
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

exports.listar = async (req, res) => {
  try {
    const { page = 1, limit = 20, tab = 'todos', q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    // tab=todos junta múltiplos tipos (posts/vagas/servicos/vendas). Se usarmos limitNum para cada tipo,
    // acabamos buscando 4x mais dados que o necessário, aumentando muito o tempo de resposta.
    const perTypeLimit = tab === 'todos' ? Math.max(1, Math.ceil(limitNum / 2)) : limitNum;
    const perTypeOffset = (pageNum - 1) * perTypeLimit;

    const query = String(q || '').trim();

    const items = [];

    const shouldIncludeVagas = tab === 'todos' || tab === 'vagas';
    const shouldIncludePessoas = tab === 'pessoas';
    const shouldIncludeEmpresas = tab === 'empresas';
    const shouldIncludeServicos = tab === 'todos' || tab === 'servicos';
    const shouldIncludeVendas = tab === 'todos' || tab === 'vendas';
    const shouldIncludePosts = tab === 'todos' || tab === 'posts' || tab === 'postagens';

    const fetchPosts = async () => {
      if (!shouldIncludePosts) return;

      const postWhere = {
        isHidden: false,
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
        order: [[Post.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const postIds = posts.map(p => p.id);

      const [reactionCounts, commentCounts, myReactions] = await Promise.all([
        postIds.length
          ? PostReaction.findAll({
              attributes: ['postId', [PostReaction.sequelize.fn('COUNT', PostReaction.sequelize.col('id')), 'count']],
              where: { postId: postIds },
              group: ['postId'],
              raw: true,
            })
          : Promise.resolve([]),
        postIds.length
          ? PostComment.findAll({
              attributes: ['postId', [PostComment.sequelize.fn('COUNT', PostComment.sequelize.col('id')), 'count']],
              where: { postId: postIds },
              group: ['postId'],
              raw: true,
            })
          : Promise.resolve([]),
        req.user && postIds.length
          ? PostReaction.findAll({
              where: { userId: req.user.id, postId: postIds },
              attributes: ['postId', 'tipo'],
              raw: true,
            })
          : Promise.resolve([]),
      ]);

      const reactionMap = reactionCounts.reduce((acc, r) => {
        acc[r.postId] = parseInt(r.count, 10);
        return acc;
      }, {});

      const commentMap = commentCounts.reduce((acc, c) => {
        acc[c.postId] = parseInt(c.count, 10);
        return acc;
      }, {});

      const myReactionMap = myReactions.reduce((acc, r) => {
        acc[r.postId] = r.tipo;
        return acc;
      }, {});

      posts.forEach(post => {
        const raw = typeof post.toJSON === 'function' ? post.toJSON() : post;
        items.push({
          type: 'post',
          id: raw.id,
          texto: raw.texto,
          imageUrl: raw.imageUrl,
          videoUrl: raw.videoUrl,
          postType: raw.postType,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          author: raw.author,
          stats: {
            reactions: reactionMap[raw.id] || 0,
            comments: commentMap[raw.id] || 0,
          },
          myReaction: myReactionMap[raw.id] || null,
        });
      });
    };

    const fetchVagas = async () => {
      if (!shouldIncludeVagas) return;

      const vagaWhere = {
        ativa: true,
        ...(query
          ? {
              [Op.or]: [
                { titulo: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
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
            attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
          },
        ],
        order: [[Vaga.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      vagas.forEach(vaga => {
        const raw = typeof vaga.toJSON === 'function' ? vaga.toJSON() : vaga;
        items.push({
          type: 'vaga',
          id: raw.id,
          titulo: raw.titulo,
          descricao: raw.descricao,
          requisitos: raw.requisitos,
          beneficios: raw.beneficios,
          localizacao: raw.localizacao,
          modalidade: raw.modalidade,
          salario: raw.salario,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          empresa: raw.empresa,
        });
      });
    };

    const fetchServicos = async () => {
      if (!shouldIncludeServicos) return;

      const servicoWhere = {
        ativo: true,
        ...(query
          ? {
              [Op.or]: [
                { titulo: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const servicos = await Chamado.findAll({
        where: servicoWhere,
        include: [
          {
            model: User,
            as: 'usuario',
            attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
          },
        ],
        order: [[Chamado.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      servicos.forEach(servico => {
        const raw = typeof servico.toJSON === 'function' ? servico.toJSON() : servico;
        items.push({
          type: 'servico',
          id: raw.id,
          titulo: raw.titulo,
          descricao: raw.descricao,
          categoria: raw.categoria,
          localizacao: raw.localizacao,
          orcamento: raw.orcamento,
          prazo: raw.prazo,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          usuario: raw.usuario,
        });
      });
    };

    const fetchVendas = async () => {
      if (!shouldIncludeVendas) return;

      const produtoWhere = {
        ativo: true,
        ...(query
          ? {
              [Op.or]: [
                { nome: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const produtos = await Produto.findAll({
        where: produtoWhere,
        include: [
          {
            model: User,
            as: 'empresa',
            attributes: ['id', 'nome', 'tipo', 'foto', 'logo'],
          },
        ],
        order: [[Produto.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const produtoIds = produtos.map(p => p.id);

      const [reactionCounts, commentCounts, myReactions] = await Promise.all([
        produtoIds.length
          ? ProdutoComment.findAll({
              attributes: ['produtoId', [ProdutoComment.sequelize.fn('COUNT', ProdutoComment.sequelize.col('id')), 'count']],
              where: { produtoId: produtoIds },
              group: ['produtoId'],
              raw: true,
            })
          : Promise.resolve([]),
        req.user && produtoIds.length
          ? ProdutoComment.findAll({
              where: { userId: req.user.id, produtoId: produtoIds },
              attributes: ['produtoId'],
              raw: true,
            })
          : Promise.resolve([]),
      ]);

      const commentMap = reactionCounts.reduce((acc, c) => {
        acc[c.produtoId] = parseInt(c.count, 10);
        return acc;
      }, {});

      const commentedMap = myReactions.reduce((acc, r) => {
        acc[r.produtoId] = true;
        return acc;
      }, {});

      produtos.forEach(produto => {
        const raw = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;
        items.push({
          type: 'produto',
          id: raw.id,
          nome: raw.nome,
          descricao: raw.descricao,
          preco: raw.preco,
          categoria: raw.categoria,
          estoque: raw.estoque,
          imagens: normalizeImagens(req, raw.imagens),
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          empresa: raw.empresa,
          stats: {
            comments: commentMap[raw.id] || 0,
          },
          commented: commentedMap[raw.id] || false,
        });
      });
    };

    const fetchPessoas = async () => {
      if (!shouldIncludePessoas) return;

      const userWhere = {
        tipo: 'candidato',
        ...(query
          ? {
              [Op.or]: [
                { nome: { [Op.like]: `%${query}%` } },
                { bio: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const users = await User.findAll({
        where: userWhere,
        order: [[User.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
        attributes: ['id', 'nome', 'tipo', 'foto', 'bio', 'localizacao', 'createdAt'],
      });

      users.forEach(user => {
        const raw = typeof user.toJSON === 'function' ? user.toJSON() : user;
        items.push({
          type: 'pessoa',
          id: raw.id,
          nome: raw.nome,
          bio: raw.bio,
          localizacao: raw.localizacao,
          foto: raw.foto,
          createdAt: raw.createdAt,
        });
      });
    };

    const fetchEmpresas = async () => {
      if (!shouldIncludeEmpresas) return;

      const companyWhere = {
        tipo: 'empresa',
        ...(query
          ? {
              [Op.or]: [
                { nome: { [Op.like]: `%${query}%` } },
                { setor: { [Op.like]: `%${query}%` } },
                { descricao: { [Op.like]: `%${query}%` } },
              ],
            }
          : {}),
      };

      const companies = await User.findAll({
        where: companyWhere,
        order: [[User.sequelize.literal('RANDOM()')]],
        limit: perTypeLimit,
        offset: perTypeOffset,
        attributes: ['id', 'nome', 'tipo', 'logo', 'setor', 'tamanho', 'localizacao', 'createdAt'],
      });

      companies.forEach(company => {
        const raw = typeof company.toJSON === 'function' ? company.toJSON() : company;
        items.push({
          type: 'empresa',
          id: raw.id,
          nome: raw.nome,
          setor: raw.setor,
          tamanho: raw.tamanho,
          localizacao: raw.localizacao,
          logo: raw.logo,
          createdAt: raw.createdAt,
        });
      });
    };

    // Executar todas as buscas em paralelo
    await Promise.all([
      fetchPosts(),
      fetchVagas(),
      fetchServicos(),
      fetchVendas(),
      fetchPessoas(),
      fetchEmpresas(),
    ]);

    // Embaralhar itens quando tab=todos para misturar os tipos
    if (tab === 'todos') {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }

    // Paginação final
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedItems = items.slice(startIndex, endIndex);

    return res.json({
      items: paginatedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: items.length,
        pages: Math.ceil(items.length / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao listar feed:', error);
    return res.status(500).json({ error: 'Erro ao listar feed' });
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

    return res.json(pub);
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
      order: [[User.sequelize.literal('RANDOM()')]],
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

exports.listarPessoas = async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      tipo: 'candidato',
      ...(query ? { nome: { [Op.like]: `%${query}%` } } : {}),
    };

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [[User.sequelize.literal('RANDOM()')]],
      limit: limitNum,
      offset,
      attributes: ['id', 'nome', 'tipo', 'foto', 'bio', 'localizacao', 'createdAt'],
    });

    return res.json({
      items: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    return res.status(500).json({ error: 'Erro ao listar pessoas' });
  }
};

exports.listarEmpresas = async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      tipo: 'empresa',
      ...(query ? { nome: { [Op.like]: `%${query}%` } } : {}),
    };

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [[User.sequelize.literal('RANDOM()')]],
      limit: limitNum,
      offset,
      attributes: ['id', 'nome', 'tipo', 'logo', 'setor', 'tamanho', 'localizacao', 'createdAt'],
    });

    return res.json({
      items: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao listar empresas:', error);
    return res.status(500).json({ error: 'Erro ao listar empresas' });
  }
};
