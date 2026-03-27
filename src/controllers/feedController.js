const { User, Post, Vaga, Produto, Chamado, PostReaction, PostComment, ProdutoComment, Op } = require('../models');
let io = null;
try {
  io = require('../socket');
} catch {
  io = null;
}

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

// Shuffle determinístico (Fisher–Yates) baseado em seed
const createSeededRandom = (seed) => {
  // mulberry32
  let t = (Number(seed) || 0) >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const hashStringToSeed = (str) => {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seededShuffleInPlace = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const seededOrderKey = (seedNum, type, id) => {
  const base = `${seedNum}:${String(type || '')}:${String(id ?? '')}`;
  return hashStringToSeed(base);
};

const seededSortItemsByKey = (arr, seedNum, type) => {
  const list = Array.isArray(arr) ? arr : [];
  return [...list].sort((a, b) => seededOrderKey(seedNum, type, a?.id) - seededOrderKey(seedNum, type, b?.id));
};

exports.listar = async (req, res) => {
  try {
    const { page = 1, limit = 20, tab = 'todos', q, seed } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    // tab=todos junta múltiplos tipos (posts/vagas/servicos/vendas). Se usarmos limitNum para cada tipo,
    // acabamos buscando 4x mais dados que o necessário, aumentando muito o tempo de resposta.
    const perTypeLimit = tab === 'todos' ? Math.max(1, Math.ceil(limitNum / 2)) : limitNum;
    const perTypeOffset = (pageNum - 1) * perTypeLimit;

    const query = String(q || '').trim();

    // Seed recomendado: vindo do frontend (persistido em localStorage por sessão)
    // Fallback: combina userId (se existir) + tab + query para manter consistência
    const seedStr = seed !== undefined && seed !== null && String(seed).trim() !== ''
      ? String(seed)
      : `${req.user?.id || 'anon'}:${tab}:${query}`;
    const seedNum = hashStringToSeed(seedStr);
    const rand = createSeededRandom(seedNum);

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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const orderedPosts = seededSortItemsByKey(posts, seedNum, 'post');

      const postIds = orderedPosts.map(p => p.id);

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

      orderedPosts.forEach(post => {
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
        dataExpiracao: {
          [Op.or]: [
            { [Op.gt]: new Date() },
            { [Op.is]: null },
          ],
        },
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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const orderedVagas = seededSortItemsByKey(vagas, seedNum, 'vaga');

      orderedVagas.forEach(vaga => {
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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const orderedServicos = seededSortItemsByKey(servicos, seedNum, 'servico');

      orderedServicos.forEach(servico => {
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
                { titulo: { [Op.like]: `%${query}%` } },
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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
      });

      const orderedProdutos = seededSortItemsByKey(produtos, seedNum, 'produto');

      const produtoIds = orderedProdutos.map(p => p.id);

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

      orderedProdutos.forEach(produto => {
        const raw = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;
        items.push({
          type: 'produto',
          id: raw.id,
          nome: raw.titulo,
          descricao: raw.descricao,
          preco: raw.preco,
          categoria: raw.categoria,
          estoque: raw.estoqueQtd,
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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
        attributes: ['id', 'nome', 'tipo', 'foto', 'bio', 'localizacao', 'createdAt'],
      });

      const orderedUsers = seededSortItemsByKey(users, seedNum, 'pessoa');

      orderedUsers.forEach(user => {
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
        order: [['id', 'DESC']],
        limit: perTypeLimit,
        offset: perTypeOffset,
        attributes: ['id', 'nome', 'tipo', 'logo', 'setor', 'tamanho', 'localizacao', 'createdAt'],
      });

      const orderedCompanies = seededSortItemsByKey(companies, seedNum, 'empresa');

      orderedCompanies.forEach(company => {
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
    const safe = async (label, fn) => {
      try {
        await fn();
      } catch (err) {
        console.error(`Erro ao buscar ${label} no feed:`, err && (err.original?.message || err.parent?.message || err.message) ? (err.original?.message || err.parent?.message || err.message) : err);
      }
    };

    await Promise.all([
      safe('posts', fetchPosts),
      safe('vagas', fetchVagas),
      safe('servicos', fetchServicos),
      safe('vendas', fetchVendas),
      safe('pessoas', fetchPessoas),
      safe('empresas', fetchEmpresas),
    ]);

    // Misturar itens quando tab=todos de forma determinística (seed)
    if (tab === 'todos') {
      seededShuffleInPlace(items, rand);
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

exports.listPublicUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, tipo } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();
    const tipoFiltro = String(tipo || '').trim();

    const where = {
      suspended: false,
      ...(tipoFiltro ? { tipo: tipoFiltro } : {}),
      ...(query
        ? {
            [Op.or]: [
              { nome: { [Op.like]: `%${query}%` } },
              { bio: { [Op.like]: `%${query}%` } },
              { setor: { [Op.like]: `%${query}%` } },
              { descricao: { [Op.like]: `%${query}%` } },
            ],
          }
        : {}),
    };

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
      attributes: ['id', 'nome', 'tipo', 'foto', 'logo', 'bio', 'setor', 'tamanho', 'localizacao', 'createdAt'],
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
    console.error('Erro ao listar usuários públicos:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários públicos' });
  }
};

exports.getPublicUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({
      where: { id, suspended: false },
      attributes: ['id', 'nome', 'tipo', 'foto', 'logo', 'bio', 'setor', 'tamanho', 'localizacao', 'createdAt'],
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário público:', error);
    return res.status(500).json({ error: 'Erro ao buscar usuário público' });
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
