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

// NOVO: Feed verdadeiramente aleatório como Facebook
exports.getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20, tab = 'todos', q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    // Se não for tab=todos, usa as funções originais para tipos específicos
    if (tab !== 'todos') {
      return exports.listar(req, res);
    }

    // Para tab=todos, cria uma query UNION verdadeiramente aleatória
    const postQuery = `
      SELECT 
        'post' as type,
        p.id,
        p.texto,
        p.imageUrl,
        p.videoUrl,
        p.postType,
        p.createdAt,
        p.updatedAt,
        JSON_OBJECT(
          'id', u.id,
          'nome', u.nome,
          'tipo', u.tipo,
          'foto', u.foto,
          'logo', u.logo
        ) as author,
        0 as reactions,
        0 as comments,
        NULL as myReaction
      FROM posts p
      JOIN users u ON p.userId = u.id
      WHERE p.isHidden = false ${query ? `AND (p.texto ILIKE '%${query}%')` : ''}
    `;

    const vagaQuery = `
      SELECT 
        'vaga' as type,
        v.id,
        v.titulo as texto,
        NULL as imageUrl,
        NULL as videoUrl,
        NULL as postType,
        v.createdAt,
        v.updatedAt,
        JSON_OBJECT(
          'id', u.id,
          'nome', u.nome,
          'tipo', u.tipo,
          'foto', u.foto,
          'logo', u.logo
        ) as empresa,
        NULL as reactions,
        NULL as comments,
        NULL as myReaction
      FROM vagas v
      JOIN users u ON v.empresaId = u.id
      WHERE v.status = 'publicada' ${query ? `AND (v.titulo ILIKE '%${query}%' OR v.descricao ILIKE '%${query}%')` : ''}
    `;

    const servicoQuery = `
      SELECT 
        'servico' as type,
        c.id,
        c.titulo as texto,
        NULL as imageUrl,
        NULL as videoUrl,
        NULL as postType,
        c.createdAt,
        c.updatedAt,
        JSON_OBJECT(
          'id', u.id,
          'nome', u.nome,
          'tipo', u.tipo,
          'foto', u.foto,
          'logo', u.logo
        ) as usuario,
        NULL as reactions,
        NULL as comments,
        NULL as myReaction
      FROM chamados c
      JOIN users u ON c.usuarioId = u.id
      WHERE c.status = 'aberto' ${query ? `AND (c.titulo ILIKE '%${query}%' OR c.descricao ILIKE '%${query}%')` : ''}
    `;

    const produtoQuery = `
      SELECT 
        'produto' as type,
        p.id,
        p.nome as texto,
        NULL as imageUrl,
        NULL as videoUrl,
        NULL as postType,
        p.createdAt,
        p.updatedAt,
        JSON_OBJECT(
          'id', u.id,
          'nome', u.nome,
          'tipo', u.tipo,
          'foto', u.foto,
          'logo', u.logo
        ) as empresa,
        0 as reactions,
        0 as comments,
        NULL as myReaction
      FROM produtos p
      JOIN users u ON p.empresaId = u.id
      WHERE p.ativo = true ${query ? `AND (p.nome ILIKE '%${query}%' OR p.descricao ILIKE '%${query}%')` : ''}
    `;

    const finalQuery = `
      SELECT * FROM (
        ${postQuery}
        UNION ALL
        ${vagaQuery}
        UNION ALL
        ${servicoQuery}
        UNION ALL
        ${produtoQuery}
      ) as combined_items
      ORDER BY RANDOM()
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [results] = await sequelize.query(finalQuery);

    // Processar resultados
    const items = [];
    const postIds = [];
    const produtoIds = [];

    results.forEach(row => {
      items.push({
        ...row,
        author: row.author ? JSON.parse(row.author) : null,
        empresa: row.empresa ? JSON.parse(row.empresa) : null,
        usuario: row.usuario ? JSON.parse(row.usuario) : null,
      });

      if (row.type === 'post') postIds.push(row.id);
      if (row.type === 'produto') produtoIds.push(row.id);
    });

    // Buscar contagens para posts (se necessário)
    if (postIds.length > 0) {
      const [reactionCounts, commentCounts, myReactions] = await Promise.all([
        sequelize.query(`
          SELECT postId, COUNT(*) as count 
          FROM post_reactions 
          WHERE postId IN (${postIds.join(',')})
          GROUP BY postId
        `, { type: sequelize.QueryTypes.SELECT }),
        
        sequelize.query(`
          SELECT postId, COUNT(*) as count 
          FROM post_comments 
          WHERE postId IN (${postIds.join(',')})
          GROUP BY postId
        `, { type: sequelize.QueryTypes.SELECT }),
        
        req.user ? sequelize.query(`
          SELECT postId, tipo 
          FROM post_reactions 
          WHERE userId = ${req.user.id} AND postId IN (${postIds.join(',')})
        `, { type: sequelize.QueryTypes.SELECT }) : Promise.resolve([])
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

      // Atualizar contagens nos itens
      items.forEach(item => {
        if (item.type === 'post') {
          item.stats = {
            reactions: reactionMap[item.id] || 0,
            comments: commentMap[item.id] || 0,
          };
          item.myReaction = myReactionMap[item.id] || null;
        }
      });
    }

    // Buscar contagens para produtos (se necessário)
    if (produtoIds.length > 0) {
      const [commentCounts] = await Promise.all([
        sequelize.query(`
          SELECT produtoId, COUNT(*) as count 
          FROM produto_comments 
          WHERE produtoId IN (${produtoIds.join(',')})
          GROUP BY produtoId
        `, { type: sequelize.QueryTypes.SELECT })
      ]);

      const commentMap = commentCounts.reduce((acc, c) => {
        acc[c.produtoId] = parseInt(c.count, 10);
        return acc;
      }, {});

      // Atualizar contagens nos itens
      items.forEach(item => {
        if (item.type === 'produto') {
          item.stats = {
            comments: commentMap[item.id] || 0,
          };
        }
      });
    }

    // Contar total para paginação (simplificado)
    const total = items.length >= limitNum ? limitNum * (pageNum + 1) : items.length + offset;

    return res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Erro ao listar feed:', error);
    return res.status(500).json({ error: 'Erro ao listar feed' });
  }
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
        status: 'publicada',
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
        status: 'aberto',
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

      const [reactionCounts, myReactions] = await Promise.all([
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
        tipo: 'usuario',
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

exports.listarPessoas = async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      tipo: 'usuario',
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
