const { Vaga, User, Candidatura, Notificacao, PushSubscription } = require('../models');
const webpush = require('web-push');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

const uploadSingleToCloudinaryOrLocal = async (fileObj, folder) => {
  if (!fileObj) return undefined;

  try {
    const result = await cloudinary.uploader.upload(fileObj.path, {
      folder: `nevu/${folder}`
    });
    return result.secure_url;
  } catch (error) {
    console.error('Erro ao fazer upload para Cloudinary:', error);
    return null;
  }
};

// Helpers para push notification (VAPID)
const ensureVapidConfigured = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { ok: false, missing: { publicKey: !publicKey, privateKey: !privateKey, subject: !subject } };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true, publicKey, privateKey, subject };
};

const subscriptionRowToWebpush = (row) => {
  try {
    const endpoint = String(row.endpoint || '');
    const p256dh = String(row.p256dh || '');
    const auth = String(row.auth || '');

    if (!endpoint || !p256dh || !auth) return null;
    return { endpoint, keys: { p256dh, auth } };
  } catch {
    return null;
  }
};

const sendPushNotification = async (userId, title, body, url = null, tag = null) => {
  try {
    const cfg = ensureVapidConfigured();
    if (!cfg.ok) return;

    const subs = await PushSubscription.findAll({ where: { userId } });
    if (!subs.length) return;

    const now = Date.now();
    const payload = JSON.stringify({
      title: String(title),
      body: String(body),
      url: url || '/',
      tag: tag ? String(tag) : `nevu-notification-${now}`,
      ts: now,
    });

    for (const row of subs) {
      try {
        const sub = subscriptionRowToWebpush(row);
        if (!sub) continue;
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          try { await row.destroy(); } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Erro ao enviar push:', err);
  }
};

// Listar todas as vagas públicas (para candidatos)
exports.listarTodas = async (req, res) => {
  try {
    const { page = 1, limit = 10, area, modalidade, tipoContrato, nivelExperiencia } = req.query;
    const offset = (page - 1) * limit;
    
    // Filtros
    const where = {
      status: 'publicada',
      dataExpiracao: {
        [Op.or]: [
          { [Op.gt]: new Date() },
          { [Op.is]: null }
        ]
      }
    };
    
    if (area) where.area = { [Op.like]: `%${area}%` };
    if (modalidade) where.modalidade = modalidade;
    if (tipoContrato) where.tipoContrato = tipoContrato;
    if (nivelExperiencia) where.nivelExperiencia = nivelExperiencia;
    
    const vagas = await Vaga.findAndCountAll({
      where,
      attributes: [
        'id',
        'titulo',
        'descricao',
        'salario',
        'imagem',
        'localizacao',
        'tipoContrato',
        'nivelExperiencia',
        'modalidade',
        'area',
        'premium',
        'dataPublicacao',
        'dataExpiracao',
        'empresaId',
        'visualizacoes',
        'capacidadeVagas',
        'statusCapacidade',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ],
      order: [['dataPublicacao', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      vagas: vagas.rows,
      total: vagas.count,
      page: parseInt(page),
      totalPages: Math.ceil(vagas.count / limit)
    });
  } catch (error) {
    console.error('Erro ao listar vagas:', error);
    res.status(500).json({ error: 'Erro ao listar vagas' });
  }
};

// Função para calcular e atualizar status da capacidade
exports.atualizarStatusCapacidade = async (vagaId) => {
  try {
    const vaga = await Vaga.findByPk(vagaId);
    if (!vaga) return;

    const candidatosAprovados = await Candidatura.count({ 
      where: { 
        vagaId,
        fase: { [Op.in]: ['aprovada', 'contratada'] }
      }
    });
    
    let novoStatusCapacidade = 'aberta';
    
    if (candidatosAprovados >= vaga.capacidadeVagas) {
      novoStatusCapacidade = 'fechada';
    } else if (candidatosAprovados >= Math.ceil(vaga.capacidadeVagas * 0.8)) {
      novoStatusCapacidade = 'parcial';
    }
    
    await vaga.update({ statusCapacidade: novoStatusCapacidade });
    
    return novoStatusCapacidade;
  } catch (error) {
    console.error('Erro ao atualizar status da capacidade:', error);
  }
};

// Buscar vaga por ID
exports.listarPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vaga = await Vaga.findByPk(id, {
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho', 'descricao', 'website']
        }
      ]
    });
    
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    const [candidaturasCount, aprovadosCount] = await Promise.all([
      Candidatura.count({ where: { vagaId: id } }),
      Candidatura.count({ where: { vagaId: id, fase: { [Op.in]: ['aprovada', 'contratada'] } } })
    ]);

    let candidatadoByMe = false;
    if (req.user && req.user.tipo === 'usuario') {
      const ja = await Candidatura.count({ where: { vagaId: id, usuarioId: req.user.id } });
      candidatadoByMe = ja > 0;
    }
    
    // Incrementar visualizações
    await vaga.increment('visualizacoes');
    
    res.json({
      ...vaga.toJSON(),
      candidaturasCount,
      aprovadosCount,
      candidatadoByMe
    });
  } catch (error) {
    console.error('Erro ao buscar vaga:', error);
    res.status(500).json({ error: 'Erro ao buscar vaga' });
  }
};

// Criar nova vaga (apenas empresas)
exports.criar = async (req, res) => {
  try {
    const empresaId = req.user.id; // ID da empresa autenticada
    const {
      titulo,
      descricao,
      requisitos,
      beneficios,
      salario,
      localizacao,
      tipoContrato,
      nivelExperiencia,
      modalidade,
      area,
      dataExpiracao,
      premium,
      capacidadeVagas
    } = req.body;
    
    console.log('=== DEBUG: Criando vaga ===');
    console.log('Dados recebidos:', req.body);
    console.log('Título:', titulo);
    console.log('Descrição:', descricao);
    console.log('Área:', area);
    
    // Validações
    if (!titulo || !descricao || !area) {
      console.log('❌ Validação falhou:');
      console.log('- Título presente:', !!titulo);
      console.log('- Descrição presente:', !!descricao);
      console.log('- Área presente:', !!area);
      return res.status(400).json({ error: 'Título, descrição e área são obrigatórios' });
    }
    
    // Verificar limite de vagas do plano
    const empresa = await User.findByPk(empresaId);
    const vagasPublicadas = await Vaga.count({
      where: {
        empresaId,
        status: 'publicada',
        dataPublicacao: {
          [Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // Este mês
        }
      }
    });
    
    // Criar a vaga
    const imagem = await uploadSingleToCloudinaryOrLocal(req.file, 'vagas');

    const vaga = await Vaga.create({
      titulo,
      descricao,
      requisitos,
      beneficios,
      salario,
      localizacao,
      tipoContrato: tipoContrato || 'Efetivo',
      nivelExperiencia: nivelExperiencia || 'JUNIOR',
      modalidade: modalidade || 'PRESENCIAL',
      area,
      dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null,
      empresaId,
      premium: premium || false,
      capacidadeVagas: capacidadeVagas || 1,
      status: 'publicada',
      statusCapacidade: 'aberta',
      imagem
    });
    
    // Buscar vaga com dados da empresa
    const vagaCompleta = await Vaga.findByPk(vaga.id, {
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ]
    });

    // Helper para sanitizar strings removendo tags HTML
    const sanitize = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);

    // Disparar notificações para todos os usuários (candidatos)
    try {
      const usuarios = await User.findAll({ where: { tipo: 'usuario' }, attributes: ['id'] });
      const empresaNome = sanitize(vagaCompleta.empresa?.nome || 'Empresa');
      const vagaTitulo = sanitize(vagaCompleta.titulo || 'Vaga');
      const notifs = usuarios.map(u => ({
        usuarioId: u.id,
        tipo: 'vaga_publicada',
        titulo: 'Nova vaga publicada',
        mensagem: `A empresa ${empresaNome} publicou a vaga: ${vagaTitulo}`,
        referenciaTipo: 'vaga',
        referenciaId: vagaCompleta.id,
      }));
      if (notifs.length > 0) {
        await Notificacao.bulkCreate(notifs, { validate: true });
      }

      // Enviar push notification para cada usuário (best-effort)
      const pushTitle = 'Nova vaga publicada';
      const pushBody = `A empresa ${empresaNome} publicou a vaga: ${vagaTitulo}`;
      for (const u of usuarios) {
        const uid = Number(u?.id);
        if (!uid) continue;
        await sendPushNotification(
          uid,
          pushTitle,
          pushBody,
          vagaCompleta?.id ? `/vaga/${vagaCompleta.id}` : '/vagas',
          vagaCompleta?.id ? `nevu-vaga-${vagaCompleta.id}-user-${uid}` : null
        );
      }
    } catch (e) {
      console.warn('Aviso: falha ao criar notificações de nova vaga:', e.message);
    }

    res.status(201).json(vagaCompleta);
  } catch (error) {
    console.error('Erro ao criar vaga:', error);
    res.status(500).json({ error: 'Erro ao criar vaga' });
  }
};

// Atualizar vaga (apenas a empresa dona)
exports.atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.id;
    
    const vaga = await Vaga.findOne({
      where: { id, empresaId }
    });
    
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada ou você não tem permissão para editá-la' });
    }
    
    // Campos permitidos para atualização
    const camposPermitidos = [
      'titulo', 'descricao', 'requisitos', 'beneficios', 'salario',
      'localizacao', 'tipoContrato', 'nivelExperiencia', 'modalidade',
      'area', 'dataExpiracao', 'premium', 'status', 'imagem'
    ];
    
    const dadosAtualizacao = {};
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        dadosAtualizacao[campo] = req.body[campo];
      }
    });

    // Se veio nova imagem no upload, sobrescrever o campo imagem
    if (req.file) {
      dadosAtualizacao.imagem = await uploadSingleToCloudinaryOrLocal(req.file, 'vagas');
    }
    
    await vaga.update(dadosAtualizacao);
    
    // Buscar vaga atualizada com dados da empresa
    const vagaAtualizada = await Vaga.findByPk(id, {
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ]
    });
    
    res.json(vagaAtualizada);
  } catch (error) {
    console.error('Erro ao atualizar vaga:', error);
    res.status(500).json({ error: 'Erro ao atualizar vaga' });
  }
};

// Deletar vaga (apenas a empresa dona)
exports.deletar = async (req, res) => {
  try {
    const { id } = req.params;
    const empresaId = req.user.id;
    
    const vaga = await Vaga.findOne({
      where: { id, empresaId }
    });
    
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada ou você não tem permissão para deletá-la' });
    }
    
    await vaga.destroy();
    res.json({ message: 'Vaga deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar vaga:', error);
    res.status(500).json({ error: 'Erro ao deletar vaga' });
  }
};

// Listar vagas da empresa logada
exports.listarPorEmpresa = async (req, res) => {
  try {
    const empresaId = req.user.id;
    
    const vagas = await Vaga.findAll({
      where: { empresaId },
      attributes: {
        include: [
          [
            Vaga.sequelize.literal(
              '(SELECT COUNT(*) FROM candidaturas AS c WHERE c."vagaId" = "Vaga"."id")'
            ),
            'candidaturas'
          ]
        ]
      },
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(vagas);
  } catch (error) {
    console.error('Erro ao listar vagas da empresa:', error);
    res.status(500).json({ error: 'Erro ao listar vagas da empresa' });
  }
};

// Buscar vagas por empresa (público)
exports.buscarPorEmpresa = async (req, res) => {
  try {
    const { empresaId } = req.params;
    
    const vagas = await Vaga.findAll({
      where: {
        empresaId,
        status: 'publicada',
        dataExpiracao: {
          [Op.or]: [
            { [Op.gt]: new Date() },
            { [Op.is]: null }
          ]
        }
      },
      attributes: [
        'id',
        'titulo',
        'descricao',
        'salario',
        'imagem',
        'localizacao',
        'tipoContrato',
        'nivelExperiencia',
        'modalidade',
        'area',
        'premium',
        'dataPublicacao',
        'dataExpiracao',
        'empresaId',
        'visualizacoes',
        'capacidadeVagas',
        'statusCapacidade',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ],
      order: [['dataPublicacao', 'DESC']]
    });
    
    res.json(vagas);
  } catch (error) {
    console.error('Erro ao buscar vagas da empresa:', error);
    res.status(500).json({ error: 'Erro ao buscar vagas da empresa' });
  }
}; 