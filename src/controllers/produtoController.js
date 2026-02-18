const { Produto, User } = require('../models');
const { Op } = require('sequelize');

const toAbsolute = (req, maybePath) => {
  if (!maybePath) return null;
  const f = String(maybePath);
  if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const path = f.startsWith('/') ? f : `/${f}`;
  return `${baseUrl}${path}`;
};

const normalizeImagens = (req, raw) => {
  try {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((x) => toAbsolute(req, x)).filter(Boolean);
  } catch {
    return [];
  }
};

const parseImagensKeep = (raw) => {
  try {
    if (raw === undefined || raw === null) return undefined;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
};

const sanitizeRelativeUploadPath = (p) => {
  try {
    const s = String(p || '').trim();
    if (!s) return null;
    if (!s.startsWith('/uploads/')) return null;
    if (s.includes('..')) return null;
    return s;
  } catch {
    return null;
  }
};

const parseTags = (tags) => {
  try {
    if (tags === undefined || tags === null) return undefined;
    if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
    if (typeof tags === 'string') {
      const trimmed = tags.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
      }
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
};

exports.list = async (req, res) => {
  try {
    const { q = '', empresaId, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const offset = (pageNum - 1) * limitNum;

    const query = String(q || '').trim();

    const where = {
      ativo: true,
      ...(empresaId ? { empresaId: Number(empresaId) } : {}),
      ...(query
        ? {
            [Op.or]: [
              { titulo: { [Op.like]: `%${query}%` } },
              { descricao: { [Op.like]: `%${query}%` } },
              { categoria: { [Op.like]: `%${query}%` } },
            ],
          }
        : {}),
    };

    const { rows, count } = await Produto.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'tipo', 'logo', 'foto'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset,
    });

    const produtos = rows.map((p) => {
      const raw = typeof p.toJSON === 'function' ? p.toJSON() : p;
      return {
        ...raw,
        imagens: normalizeImagens(req, raw.imagens),
        empresa: raw.empresa
          ? {
              id: raw.empresa.id,
              nome: raw.empresa.nome,
              tipo: raw.empresa.tipo,
              logo: toAbsolute(req, raw.empresa.logo),
              foto: toAbsolute(req, raw.empresa.foto),
            }
          : null,
      };
    });

    return res.json({
      produtos,
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum),
    });
  } catch (err) {
    console.error('Erro ao listar produtos:', err);
    return res.status(500).json({ error: 'Erro ao listar produtos' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const produto = await Produto.findByPk(id, {
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'tipo', 'logo', 'foto'],
        },
      ],
    });

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const raw = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;
    return res.json({
      ...raw,
      imagens: normalizeImagens(req, raw.imagens),
      empresa: raw.empresa
        ? {
            id: raw.empresa.id,
            nome: raw.empresa.nome,
            tipo: raw.empresa.tipo,
            logo: toAbsolute(req, raw.empresa.logo),
            foto: toAbsolute(req, raw.empresa.foto),
          }
        : null,
    });
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
    return res.status(500).json({ error: 'Erro ao buscar produto' });
  }
};

exports.create = async (req, res) => {
  try {
    const empresaId = req.user?.id;
    if (!empresaId) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user?.tipo !== 'empresa') return res.status(403).json({ error: 'Apenas empresas podem criar produtos' });

    const {
      titulo,
      descricao,
      preco,
      precoSobConsulta,
      tipoVenda,
      estoqueQtd,
      tempoPreparoDias,
      categoria,
      tags,
      entregaDisponivel,
      retiradaDisponivel,
      zonaEntrega,
      custoEntrega,
      localRetirada,
      ativo,
    } = req.body || {};

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const imagens = files.map(f => `/uploads/${f.filename}`);

    const produto = await Produto.create({
      empresaId,
      titulo: String(titulo).trim(),
      descricao: descricao !== undefined ? String(descricao) : null,
      preco: preco !== undefined && preco !== null ? String(preco) : null,
      precoSobConsulta: String(precoSobConsulta).toLowerCase() === 'true' ? true : !!precoSobConsulta,
      tipoVenda: tipoVenda === 'sob_encomenda' ? 'sob_encomenda' : 'estoque',
      estoqueQtd: estoqueQtd !== undefined && estoqueQtd !== null && String(estoqueQtd) !== '' ? Number(estoqueQtd) : null,
      tempoPreparoDias: tempoPreparoDias !== undefined && tempoPreparoDias !== null && String(tempoPreparoDias) !== '' ? Number(tempoPreparoDias) : null,
      categoria: categoria !== undefined && categoria !== null ? String(categoria) : null,
      tags: parseTags(tags) ?? [],
      imagens,
      entregaDisponivel: String(entregaDisponivel).toLowerCase() === 'true' ? true : !!entregaDisponivel,
      retiradaDisponivel: retiradaDisponivel === undefined ? true : (String(retiradaDisponivel).toLowerCase() === 'true' ? true : !!retiradaDisponivel),
      zonaEntrega: zonaEntrega !== undefined && zonaEntrega !== null ? String(zonaEntrega) : null,
      custoEntrega: custoEntrega !== undefined && custoEntrega !== null ? String(custoEntrega) : null,
      localRetirada: localRetirada !== undefined && localRetirada !== null ? String(localRetirada) : null,
      ativo: ativo === undefined ? true : (String(ativo).toLowerCase() === 'true' ? true : !!ativo),
    });

    const raw = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('venda:new', {
          item: {
            type: 'venda',
            id: raw.id,
            createdAt: raw.createdAt,
            dataPublicacao: raw.createdAt,
            titulo: raw.titulo,
            descricao: raw.descricao,
            preco: raw.preco,
            precoSobConsulta: !!raw.precoSobConsulta,
            tipoVenda: raw.tipoVenda,
            imagens: normalizeImagens(req, raw.imagens),
            entregaDisponivel: !!raw.entregaDisponivel,
            retiradaDisponivel: !!raw.retiradaDisponivel,
            zonaEntrega: raw.zonaEntrega,
            custoEntrega: raw.custoEntrega,
            localRetirada: raw.localRetirada,
            empresaId: raw.empresaId,
          },
        });
      }
    } catch (e) {
      console.error('Falha ao emitir venda:new:', e);
    }

    return res.status(201).json({
      ...raw,
      imagens: normalizeImagens(req, raw.imagens),
    });
  } catch (err) {
    console.error('Erro ao criar produto:', err);
    return res.status(500).json({ error: 'Erro ao criar produto' });
  }
};

exports.update = async (req, res) => {
  try {
    const empresaId = req.user?.id;
    if (!empresaId) return res.status(401).json({ error: 'Não autenticado' });

    const { id } = req.params;
    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    if (String(produto.empresaId) !== String(empresaId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const body = req.body || {};

    const files = Array.isArray(req.files) ? req.files : [];
    const novasImagens = files.map(f => `/uploads/${f.filename}`);

    const imagensKeepParsed = parseImagensKeep(body.imagensKeep);

    const next = {
      ...(body.titulo !== undefined ? { titulo: String(body.titulo).trim() } : {}),
      ...(body.descricao !== undefined ? { descricao: body.descricao !== null ? String(body.descricao) : null } : {}),
      ...(body.preco !== undefined ? { preco: body.preco !== null ? String(body.preco) : null } : {}),
      ...(body.precoSobConsulta !== undefined ? { precoSobConsulta: String(body.precoSobConsulta).toLowerCase() === 'true' ? true : !!body.precoSobConsulta } : {}),
      ...(body.tipoVenda !== undefined ? { tipoVenda: body.tipoVenda === 'sob_encomenda' ? 'sob_encomenda' : 'estoque' } : {}),
      ...(body.estoqueQtd !== undefined ? { estoqueQtd: body.estoqueQtd !== null && String(body.estoqueQtd) !== '' ? Number(body.estoqueQtd) : null } : {}),
      ...(body.tempoPreparoDias !== undefined ? { tempoPreparoDias: body.tempoPreparoDias !== null && String(body.tempoPreparoDias) !== '' ? Number(body.tempoPreparoDias) : null } : {}),
      ...(body.categoria !== undefined ? { categoria: body.categoria !== null ? String(body.categoria) : null } : {}),
      ...(body.tags !== undefined ? { tags: parseTags(body.tags) ?? [] } : {}),
      ...(body.entregaDisponivel !== undefined ? { entregaDisponivel: String(body.entregaDisponivel).toLowerCase() === 'true' ? true : !!body.entregaDisponivel } : {}),
      ...(body.retiradaDisponivel !== undefined ? { retiradaDisponivel: String(body.retiradaDisponivel).toLowerCase() === 'true' ? true : !!body.retiradaDisponivel } : {}),
      ...(body.zonaEntrega !== undefined ? { zonaEntrega: body.zonaEntrega !== null ? String(body.zonaEntrega) : null } : {}),
      ...(body.custoEntrega !== undefined ? { custoEntrega: body.custoEntrega !== null ? String(body.custoEntrega) : null } : {}),
      ...(body.localRetirada !== undefined ? { localRetirada: body.localRetirada !== null ? String(body.localRetirada) : null } : {}),
      ...(body.ativo !== undefined ? { ativo: String(body.ativo).toLowerCase() === 'true' ? true : !!body.ativo } : {}),
    };

    if (imagensKeepParsed !== undefined || novasImagens.length) {
      const keep = (Array.isArray(imagensKeepParsed) ? imagensKeepParsed : (Array.isArray(produto.imagens) ? produto.imagens : []))
        .map(sanitizeRelativeUploadPath)
        .filter(Boolean);
      next.imagens = [...keep, ...novasImagens];
    }

    await produto.update(next);

    const raw = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('venda:update', {
          vendaId: Number(raw.id),
          item: {
            type: 'venda',
            id: raw.id,
            createdAt: raw.createdAt,
            dataPublicacao: raw.createdAt,
            titulo: raw.titulo,
            descricao: raw.descricao,
            preco: raw.preco,
            precoSobConsulta: !!raw.precoSobConsulta,
            tipoVenda: raw.tipoVenda,
            imagens: normalizeImagens(req, raw.imagens),
            entregaDisponivel: !!raw.entregaDisponivel,
            retiradaDisponivel: !!raw.retiradaDisponivel,
            zonaEntrega: raw.zonaEntrega,
            custoEntrega: raw.custoEntrega,
            localRetirada: raw.localRetirada,
            empresaId: raw.empresaId,
          },
        });
      }
    } catch (e) {
      console.error('Falha ao emitir venda:update:', e);
    }

    return res.json({
      ...raw,
      imagens: normalizeImagens(req, raw.imagens),
    });
  } catch (err) {
    console.error('Erro ao atualizar produto:', err);
    return res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
};

exports.remove = async (req, res) => {
  try {
    const empresaId = req.user?.id;
    if (!empresaId) return res.status(401).json({ error: 'Não autenticado' });

    const { id } = req.params;
    const produto = await Produto.findByPk(id);
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    if (String(produto.empresaId) !== String(empresaId)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await produto.update({ ativo: false });

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        io.emit('venda:delete', { vendaId: Number(id), empresaId: Number(empresaId) });
      }
    } catch (e) {
      console.error('Falha ao emitir venda:delete:', e);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao remover produto:', err);
    return res.status(500).json({ error: 'Erro ao remover produto' });
  }
};
