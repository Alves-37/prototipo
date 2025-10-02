const { Apoio } = require('../models');

exports.create = async (req, res) => {
  try {
    const { nome, email, mensagem, usuarioId, prioridade } = req.body || {};
    if (!mensagem || (!nome && !usuarioId)) {
      return res.status(400).json({ error: 'Mensagem é obrigatória. Informe nome ou usuarioId.' });
    }

    const status = prioridade ? 'em_atendimento' : 'pendente';

    const created = await Apoio.create({
      usuarioId: usuarioId || null,
      nome: nome || null,
      email: email || null,
      mensagem,
      status,
    });

    return res.status(201).json({
      id: created.id,
      nome: created.nome,
      email: created.email,
      mensagem: created.mensagem,
      status: created.status,
      data: created.createdAt,
    });
  } catch (err) {
    console.error('Erro ao criar apoio:', err);
    return res.status(500).json({ error: 'Erro ao enviar mensagem de apoio' });
  }
};
