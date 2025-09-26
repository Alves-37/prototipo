const { Denuncia } = require('../models');

// Criar denúncia (somente autenticado)
exports.criar = async (req, res) => {
  try {
    // auth obrigatório
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Autenticação obrigatória para enviar denúncia.' });
    }

    const { referenciaTipo, referenciaId, motivo, descricao, prioridade } = req.body;

    if (!referenciaTipo) {
      return res.status(400).json({ error: 'Tipo de referência é obrigatório.' });
    }
    if (!descricao || String(descricao).trim().length < 5) {
      return res.status(400).json({ error: 'Descrição é obrigatória e deve ter pelo menos 5 caracteres.' });
    }

    const anexo = req.file ? req.file.filename : null;

    const denuncia = await Denuncia.create({
      autorId: req.user.id,
      referenciaTipo,
      referenciaId: referenciaId || null,
      motivo: motivo || 'outro',
      descricao: String(descricao).trim(),
      anexo,
      prioridade: prioridade || null,
      status: 'aberta',
    });

    res.status(201).json(denuncia);
  } catch (error) {
    console.error('Erro ao criar denúncia:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar denúncias (admin)
exports.listar = async (req, res) => {
  try {
    const { status, referenciaTipo, motivo } = req.query;
    const where = {};
    if (status) where.status = status;
    if (referenciaTipo) where.referenciaTipo = referenciaTipo;
    if (motivo) where.motivo = motivo;

    const denuncias = await Denuncia.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(denuncias);
  } catch (error) {
    console.error('Erro ao listar denúncias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Buscar denúncia por ID (admin)
exports.detalhe = async (req, res) => {
  try {
    const { id } = req.params;
    const denuncia = await Denuncia.findByPk(id);
    if (!denuncia) return res.status(404).json({ error: 'Denúncia não encontrada' });
    res.json(denuncia);
  } catch (error) {
    console.error('Erro ao buscar denúncia:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Atualizar status (admin)
exports.atualizarStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, prioridade } = req.body;
    const denuncia = await Denuncia.findByPk(id);
    if (!denuncia) return res.status(404).json({ error: 'Denúncia não encontrada' });

    const fields = {};
    if (status) fields.status = status;
    if (prioridade) fields.prioridade = prioridade;

    await denuncia.update(fields);
    res.json(denuncia);
  } catch (error) {
    console.error('Erro ao atualizar denúncia:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
