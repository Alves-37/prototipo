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

exports.listar = async (req, res) => {
  try {
    const { page = 1, limit = 20, tab = 'todos', q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    
    // Para feed estilo Facebook, buscar mais itens e depois embaralhar
    const fetchLimit = tab === 'todos' ? limitNum * 4 : limitNum;
    const offset = (pageNum - 1) * fetchLimit;

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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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
        limit: fetchLimit,
        offset: 0, // Sem offset para melhor aleatoriedade
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

    // Embaralhar todos os itens para estilo Facebook
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    // Paginação final após embaralhar
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
