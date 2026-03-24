const { Candidatura, Vaga, User, Notificacao, PushSubscription } = require('../models');
const webpush = require('web-push');

// Função para enviar push notification
const sendPushNotification = async (userId, title, body, url = null) => {
  try {
    const cfg = ensureVapidConfigured();
    if (!cfg.ok) return;

    const subs = await PushSubscription.findAll({ where: { userId } });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title: String(title),
      body: String(body),
      url: url || '/',
      tag: 'nevu-notification',
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

// Helper functions para VAPID
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

// Candidato se candidata a uma vaga
exports.criar = async (req, res) => {
  try {
    const { vagaId, mensagem, telefone, linkedin, disponibilidade } = req.body;
    const usuarioId = req.user.id;

    if (req.user?.tipo !== 'usuario') {
      return res.status(403).json({ error: 'Apenas candidatos podem se candidatar a vagas.' });
    }

    // Verifica se já existe candidatura para essa vaga/usuário
    const existente = await Candidatura.findOne({ where: { vagaId, usuarioId } });
    if (existente) {
      return res.status(400).json({ error: 'Você já se candidatou a esta vaga.' });
    }

    // Verificar se a vaga existe e tem capacidade disponível
    const vaga = await Vaga.findByPk(vagaId);
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada.' });
    }

    if (vaga.empresaId && Number(vaga.empresaId) === Number(usuarioId)) {
      return res.status(403).json({ error: 'Você não pode se candidatar à sua própria vaga.' });
    }

    // Verificar se a vaga está aberta para candidaturas
    if (vaga.status !== 'publicada') {
      return res.status(400).json({ error: 'Esta vaga não está mais aceitando candidaturas.' });
    }

    // Verificar se a vaga ainda está aceitando candidaturas
    if (vaga.statusCapacidade === 'fechada') {
      return res.status(400).json({ 
        error: 'Esta vaga não está mais aceitando candidaturas.' 
      });
    }

    // Processar uploads (currículo opcional, documentos frente/verso obrigatórios)
    const files = req.files || {};
    const curriculoFile = Array.isArray(files.curriculo) && files.curriculo[0] ? files.curriculo[0] : null;
    const docFrenteFile = Array.isArray(files.documentoFrente) && files.documentoFrente[0] ? files.documentoFrente[0] : null;
    const docVersoFile = Array.isArray(files.documentoVerso) && files.documentoVerso[0] ? files.documentoVerso[0] : null;

    if (!docFrenteFile || !docVersoFile) {
      return res.status(400).json({ error: 'Documento de identificação frente e verso são obrigatórios.' });
    }

    // Upload para Cloudinary (se configurado), senão manter filename local
    const cloudinary = require('../config/cloudinary');
    const path = require('path');
    const fs = require('fs');

    const uploadLocalOrCloud = async (fileObj, folder) => {
      if (!fileObj) return null;
      // caminho completo gerado pelo multer diskStorage
      const fullPath = fileObj.path || path.join(__dirname, '../../uploads', fileObj.filename);
      if (cloudinary) {
        const result = await cloudinary.uploader.upload(fullPath, {
          folder: `nevu/${folder}`,
          resource_type: 'auto'
        });
        // limpar arquivo local após upload bem-sucedido
        try { fs.unlinkSync(fullPath); } catch (e) {}
        return result.secure_url;
      }
      // Fallback: usar filename local (servirá em dev; em produção pode expirar após restart)
      return fileObj.filename;
    };

    const curriculoValue = await uploadLocalOrCloud(curriculoFile, 'curriculos');
    const documentoFrente = await uploadLocalOrCloud(docFrenteFile, 'documentos/frente');
    const documentoVerso = await uploadLocalOrCloud(docVersoFile, 'documentos/verso');

    if (curriculoValue) {
      // Atualizar o currículo do usuário (armazenar URL quando cloudinary estiver ativo)
      await User.update(
        { curriculo: curriculoValue },
        { where: { id: usuarioId } }
      );
    }

    const candidatura = await Candidatura.create({ 
      vagaId, 
      usuarioId, 
      mensagem,
      telefone,
      linkedin,
      disponibilidade,
      documentoFrente,
      documentoVerso,
      fase: 'recebida',
      historicoFases: JSON.stringify([{
        fase: 'recebida',
        data: new Date().toISOString(),
        observacao: 'Candidatura enviada'
      }])
    });

    // Não atualizar status da capacidade aqui - será atualizado quando candidatos forem aprovados
    
    // Disparar notificação para a EMPRESA dona da vaga
    try {
      const vagaNot = await Vaga.findByPk(vagaId);
      if (vagaNot && vagaNot.empresaId) {
        await Notificacao.create({
          usuarioId: vagaNot.empresaId,
          tipo: 'candidatura_fase',
          titulo: 'Nova candidatura recebida',
          mensagem: `Você recebeu uma nova candidatura para a vaga: ${vagaNot.titulo || 'Vaga'}`,
          referenciaTipo: 'candidatura',
          referenciaId: candidatura.id,
        });

        // Enviar push notification para a empresa
        await sendPushNotification(
          vagaNot.empresaId,
          'Nova candidatura recebida',
          `Você tem uma nova candidatura para: ${vagaNot.titulo || 'Vaga'}`,
          `/vagas/${vagaId}`
        );
      }
    } catch (e) {
      console.warn('Aviso: falha ao criar notificação de nova candidatura:', e.message);
    }

    res.status(201).json(candidatura);
  } catch (error) {
    console.error('Erro ao criar candidatura:', error);
    res.status(500).json({ error: 'Erro ao criar candidatura' });
  }
};

// Empresa lista candidaturas de uma vaga
exports.listarPorVaga = async (req, res) => {
  try {
    const { vagaId } = req.params;
    const candidaturas = await Candidatura.findAll({
      where: { vagaId },
      include: [{ model: User, as: 'usuario', attributes: { exclude: ['senha'] } }],
      order: [['createdAt', 'DESC']]
    });
    res.json(candidaturas);
  } catch (error) {
    console.error('Erro ao listar candidaturas:', error);
    res.status(500).json({ error: 'Erro ao listar candidaturas' });
  }
};

// Empresa lista candidaturas de todas as suas vagas
exports.listarPorEmpresa = async (req, res) => {
  try {
    const empresaId = req.user.id;
    // Busca todas as vagas da empresa
    const vagas = await Vaga.findAll({ where: { empresaId } });
    const vagaIds = vagas.map(v => v.id);
    // Busca candidaturas nessas vagas
    const candidaturas = await Candidatura.findAll({
      where: { vagaId: vagaIds },
      include: [
        { 
          model: User, 
          as: 'usuario', 
          attributes: ['id', 'nome', 'email', 'telefone', 'foto', 'experiencia', 'formacao', 'curriculo']
        },
        { model: Vaga, as: 'vaga' }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(candidaturas);
  } catch (error) {
    console.error('Erro ao listar candidaturas da empresa:', error);
    res.status(500).json({ error: 'Erro ao listar candidaturas da empresa' });
  }
};

// Ver detalhe de uma candidatura
exports.detalhe = async (req, res) => {
  try {
    const { id } = req.params;
    const candidatura = await Candidatura.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'usuario', 
          attributes: ['id', 'nome', 'email', 'telefone', 'foto', 'experiencia', 'formacao', 'curriculo']
        },
        { model: Vaga, as: 'vaga' }
      ]
    });
    if (!candidatura) return res.status(404).json({ error: 'Candidatura não encontrada' });
    res.json(candidatura);
  } catch (error) {
    console.error('Erro ao buscar candidatura:', error);
    res.status(500).json({ error: 'Erro ao buscar candidatura' });
  }
};

// Candidato lista suas próprias candidaturas
exports.listarPorUsuario = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const candidaturas = await Candidatura.findAll({
      where: { usuarioId },
      include: [
        { 
          model: Vaga, 
          as: 'vaga',
          include: [{ model: User, as: 'empresa', attributes: ['id', 'nome', 'logo'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(candidaturas);
  } catch (error) {
    console.error('Erro ao listar candidaturas do usuário:', error);
    res.status(500).json({ error: 'Erro ao listar candidaturas do usuário' });
  }
};

// Atualizar fase da candidatura (sistema de fases)
exports.atualizarFase = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      fase, 
      dataEntrevista, 
      localEntrevista, 
      observacoesEmpresa, 
      feedbackEntrevista, 
      avaliacaoEmpresa,
      dataTesteTecnico,
      resultadoTesteTecnico,
      notaTesteTecnico,
      salarioProposto,
      dataInicio
    } = req.body;
    
    // Verificar se a candidatura existe
    const candidatura = await Candidatura.findByPk(id, {
      include: [
        { model: User, as: 'usuario', attributes: ['id', 'nome', 'email'] },
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo', 'empresaId'] }
      ]
    });
    
    if (!candidatura) {
      return res.status(404).json({ error: 'Candidatura não encontrada' });
    }
    
    // Verificar se o usuário logado é a empresa dona da vaga
    if (req.user.tipo !== 'empresa' || req.user.id !== candidatura.vaga.empresaId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Validar transições de fase permitidas
    const transicoesPermitidas = {
      'recebido': ['em_analise', 'reprovada'],
      'recebida': ['em_analise', 'reprovada'],
      'em_analise': ['entrevista_agendada', 'reprovada'],
      'entrevista_agendada': ['entrevista_realizada', 'reprovada'],
      'entrevista_realizada': ['aprovada', 'reprovada'],
      'teste_tecnico': ['aprovada', 'reprovada'],
      'aprovada': ['contratada'],
      'reprovada': ['entrevista_agendada'], // Permitir reagendar entrevista
      'contratada': [] // Não há transições após contratar
    };
    
    // Se a fase atual não existe nas transições, permitir qualquer transição para entrevista_agendada
    const faseAtual = candidatura.fase || candidatura.status || 'recebida';
    
    if (!transicoesPermitidas[faseAtual]) {
      if (fase === 'entrevista_agendada') {
        // Permitir transição para entrevista_agendada
      } else {
        return res.status(400).json({ 
          error: `Transição de fase inválida: ${faseAtual} → ${fase}` 
        });
      }
    } else if (!transicoesPermitidas[faseAtual].includes(fase)) {
      return res.status(400).json({ 
        error: `Transição de fase inválida: ${faseAtual} → ${fase}` 
      });
    }
    
    // Preparar dados para atualização
    const dadosAtualizacao = { fase };
    
    // Adicionar campos específicos baseados na fase
    if (fase === 'entrevista_agendada') {
      if (!dataEntrevista) {
        return res.status(400).json({ error: 'Data da entrevista é obrigatória' });
      }
      dadosAtualizacao.dataEntrevista = dataEntrevista;
      dadosAtualizacao.localEntrevista = localEntrevista;
    }
    
    if (fase === 'entrevista_realizada') {
      dadosAtualizacao.feedbackEntrevista = feedbackEntrevista;
      dadosAtualizacao.avaliacaoEmpresa = avaliacaoEmpresa;
    }
    
    if (fase === 'teste_tecnico') {
      dadosAtualizacao.dataTesteTecnico = dataTesteTecnico || new Date();
      dadosAtualizacao.resultadoTesteTecnico = resultadoTesteTecnico || 'pendente';
      dadosAtualizacao.notaTesteTecnico = notaTesteTecnico;
    }
    
    if (fase === 'contratada') {
      dadosAtualizacao.dataContratacao = new Date();
      dadosAtualizacao.salarioProposto = salarioProposto;
      dadosAtualizacao.dataInicio = dataInicio;
    }
    
    if (observacoesEmpresa) {
      dadosAtualizacao.observacoesEmpresa = observacoesEmpresa;
    }
    
    // Atualizar candidatura
    await candidatura.update(dadosAtualizacao);
    
    // Verificar se precisa atualizar status da capacidade da vaga
    if (fase === 'aprovada' || fase === 'contratada') {
      // Importar a função do vagaController
      const vagaController = require('./vagaController');
      await vagaController.atualizarStatusCapacidade(candidatura.vagaId);
    }
    
    // Disparar notificação para o usuário sobre mudança de fase (mensagens específicas)
    try {
      const sanitize = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);
      const tituloVaga = sanitize(candidatura.vaga?.titulo || 'Vaga');
      
      // Tentar obter o nome da empresa de várias formas
      const empresa = await User.findByPk(candidatura.vaga.empresaId);
      const nomeEmpresa = sanitize(empresa?.nome || empresa?.razaoSocial || 'a empresa');

      let msgCorpo;
      switch (fase) {
        case 'em_analise':
          msgCorpo = `A sua candidatura para "${tituloVaga}" está em análise pela ${nomeEmpresa}.`;
          break;
        case 'entrevista_agendada':
          msgCorpo = `A ${nomeEmpresa} agendou uma entrevista para a vaga "${tituloVaga}". Verifique os detalhes no painel.`;
          break;
        case 'entrevista_realizada':
          msgCorpo = `A sua entrevista para "${tituloVaga}" foi registrada. Aguarde o retorno da ${nomeEmpresa}.`;
          break;
        case 'teste_tecnico':
          msgCorpo = `A ${nomeEmpresa} iniciou a fase de teste técnico para a vaga "${tituloVaga}".`;
          break;
        case 'aprovada':
          msgCorpo = `Parabéns! Você foi aprovado(a) na vaga "${tituloVaga}" pela ${nomeEmpresa}.`;
          break;
        case 'contratada':
          msgCorpo = `Parabéns! Você foi contratado(a) pela ${nomeEmpresa} para a vaga "${tituloVaga}".`;
          break;
        case 'reprovada':
          msgCorpo = `A sua candidatura para "${tituloVaga}" foi reprovada. Continue acompanhando novas oportunidades!`;
          break;
        default:
          msgCorpo = `Sua candidatura para "${tituloVaga}" mudou para a fase: ${fase}.`;
      }

      await Notificacao.create({
        usuarioId: candidatura.usuario.id,
        tipo: 'candidatura_fase',
        titulo: 'Atualização na sua candidatura',
        mensagem: msgCorpo,
        referenciaTipo: 'candidatura',
        referenciaId: candidatura.id,
      });

      // Enviar push notification para o candidato
      await sendPushNotification(
        candidatura.usuario.id,
        'Atualização na sua candidatura',
        msgCorpo,
        `/minhas-candidaturas`
      );
    } catch (e) {
      console.warn('Aviso: falha ao criar notificação de fase da candidatura:', e.message);
    }

    // Retornar candidatura atualizada
    const candidaturaAtualizada = await Candidatura.findByPk(id, {
      include: [
        { model: User, as: 'usuario', attributes: ['id', 'nome', 'email', 'telefone', 'foto'] },
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo', 'empresaId'] }
      ]
    });
    
    res.json(candidaturaAtualizada);
    
  } catch (error) {
    console.error('Erro ao atualizar fase da candidatura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Buscar candidaturas por empresa (com filtros de fase)
exports.candidaturasPorEmpresa = async (req, res) => {
  try {
    const { fase, vagaId } = req.query;
    const empresaId = req.user.id;
    
    // Construir filtros
    const filtros = {
      include: [
        { 
          model: Vaga, 
          as: 'vaga', 
          where: { empresaId },
          attributes: ['id', 'titulo', 'descricao', 'salario', 'tipoTrabalho']
        },
        { 
          model: User, 
          as: 'usuario', 
          attributes: ['id', 'nome', 'email', 'telefone', 'foto', 'experiencia', 'formacao', 'curriculo']
        }
      ],
      order: [['createdAt', 'DESC']]
    };
    
    // Adicionar filtro de fase se fornecido
    if (fase) {
      filtros.where = { fase };
    }
    
    // Adicionar filtro de vaga se fornecido
    if (vagaId) {
      filtros.include[0].where = { ...filtros.include[0].where, id: vagaId };
    }
    
    const candidaturas = await Candidatura.findAll(filtros);
    
    res.json(candidaturas);
    
  } catch (error) {
    console.error('Erro ao buscar candidaturas da empresa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Estatísticas de candidaturas por fase para empresa
exports.estatisticasEmpresa = async (req, res) => {
  try {
    const empresaId = req.user.id;
    
    const candidaturas = await Candidatura.findAll({
      include: [
        { 
          model: Vaga, 
          as: 'vaga', 
          where: { empresaId },
          attributes: ['id']
        }
      ],
      attributes: ['fase']
    });
    
    const estatisticas = {
      total: candidaturas.length,
      recebidas: candidaturas.filter(c => c.fase === 'recebida').length,
      em_analise: candidaturas.filter(c => c.fase === 'em_analise').length,
      entrevista_agendada: candidaturas.filter(c => c.fase === 'entrevista_agendada').length,
      entrevista_realizada: candidaturas.filter(c => c.fase === 'entrevista_realizada').length,
      teste_tecnico: candidaturas.filter(c => c.fase === 'teste_tecnico').length,
      aprovadas: candidaturas.filter(c => c.fase === 'aprovada').length,
      reprovadas: candidaturas.filter(c => c.fase === 'reprovada').length,
      contratadas: candidaturas.filter(c => c.fase === 'contratada').length
    };
    
    res.json(estatisticas);
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Obter histórico de fases de uma candidatura
exports.historicoFases = async (req, res) => {
  try {
    const { id } = req.params;
    
    const candidatura = await Candidatura.findByPk(id, {
      include: [
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo', 'empresaId'] }
      ]
    });
    
    if (!candidatura) {
      return res.status(404).json({ error: 'Candidatura não encontrada' });
    }
    
    // Verificar permissão
    if (req.user.tipo === 'empresa' && req.user.id !== candidatura.vaga.empresaId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    if (req.user.tipo === 'usuario' && req.user.id !== candidatura.usuarioId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const historico = JSON.parse(candidatura.historicoFases || '[]');
    
    res.json({
      candidaturaId: candidatura.id,
      faseAtual: candidatura.fase,
      historico: historico
    });
    
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Candidato cancela sua candidatura
exports.cancelar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    
    // Verificar se a candidatura existe e pertence ao usuário
    const candidatura = await Candidatura.findOne({
      where: { id, usuarioId },
      include: [
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo', 'empresaId'] }
      ]
    });
    
    if (!candidatura) {
      return res.status(404).json({ error: 'Candidatura não encontrada' });
    }
    
    // Verificar se pode cancelar (apenas em certos status)
    const statusPermitidos = ['recebida', 'em_analise'];
    if (!statusPermitidos.includes(candidatura.fase)) {
      return res.status(400).json({ 
        error: 'Não é possível cancelar candidatura neste status' 
      });
    }
    
    // Excluir candidatura
    await candidatura.destroy();
    
    res.json({ message: 'Candidatura cancelada com sucesso' });
    
  } catch (error) {
    console.error('Erro ao cancelar candidatura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}; 