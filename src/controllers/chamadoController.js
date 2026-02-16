const { Chamado, RespostaChamado, User, Notificacao } = require('../models');

const { Op } = require('sequelize');

// Listar todos os chamados com filtros
exports.listar = async (req, res) => {
  try {
    const {
      categoria,
      status,
      prioridade,
      busca,
      page = 1,
      limit = 10,
      ordenar = 'data',
      direcao = 'DESC',
      excluirUsuario
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Construir filtros
    const where = {};
    
    if (categoria && categoria !== 'todas') {
      where.categoria = categoria;
    }
    
    if (status && status !== 'todos') {
      where.status = status;
    }
    
    if (prioridade && prioridade !== 'todas') {
      where.prioridade = prioridade;
    }
    
    if (busca) {
      where[Op.or] = [
        { titulo: { [Op.like]: `%${busca}%` } },
        { descricao: { [Op.like]: `%${busca}%` } },
        { localizacao: { [Op.like]: `%${busca}%` } }
      ];
    }

    // Excluir chamados do usuário logado se especificado
    if (excluirUsuario) {
      console.log('Excluindo chamados do usuário:', excluirUsuario);
      where.usuarioId = { [Op.ne]: parseInt(excluirUsuario) };
    }

    // Verificar plano do usuário para filtrar prioridades
    if (req.user && req.user.plano === 'gratuito') {
      where.prioridade = { [Op.ne]: 'alta' };
    }

    const { count, rows: chamados } = await Chamado.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email', 'foto']
        },
        {
          model: RespostaChamado,
          as: 'respostasList',
          attributes: ['id'],
          separate: true
        }
      ],
      order: [[ordenar, direcao]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Adicionar contador de respostas
    const chamadosComRespostas = chamados.map(chamado => {
      const chamadoJson = chamado.toJSON();
      chamadoJson.totalRespostas = chamado.respostasList ? chamado.respostasList.length : 0;
      delete chamadoJson.respostasList; // Remover array de respostas para economizar dados
      return chamadoJson;
    });

    res.json({
      chamados: chamadosComRespostas,
      paginacao: {
        total: count,
        pagina: parseInt(page),
        porPagina: parseInt(limit),
        totalPaginas: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar chamados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Buscar chamado por ID
exports.buscarPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DEBUG: Buscando chamado ID:', id);
    
    const chamado = await Chamado.findByPk(id, {
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email', 'foto', 'telefone']
        },
        {
          model: RespostaChamado,
          as: 'respostasList',
          include: [
            {
              model: User,
              as: 'usuario',
              attributes: ['id', 'nome', 'email', 'foto']
            }
          ],
          order: [['data', 'ASC']]
        }
      ]
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    console.log('=== DEBUG: Chamado encontrado:', {
      id: chamado.id,
      titulo: chamado.titulo,
      respostasCount: chamado.respostasList ? chamado.respostasList.length : 0,
      respostas: chamado.respostasList
    });

    // Incrementar visualizações
    await chamado.increment('visualizacoes');

    res.json(chamado);
  } catch (error) {
    console.error('Erro ao buscar chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Criar novo chamado
exports.criar = async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      categoria,
      localizacao,
      orcamento,
      prazo,
      prioridade,
      telefone,
      email,
      requisitos
    } = req.body;

    const requisitosNormalizados = (() => {
      try {
        if (Array.isArray(requisitos)) return requisitos;
        if (typeof requisitos === 'string' && requisitos.trim()) {
          const parsed = JSON.parse(requisitos);
          return Array.isArray(parsed) ? parsed : [];
        }
        return [];
      } catch {
        return [];
      }
    })();

    const baseUrl = (() => {
      try {
        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        return `${proto}://${host}`;
      } catch {
        return '';
      }
    })();

    const imagens = (() => {
      try {
        const files = Array.isArray(req.files) ? req.files : [];
        return files
          .map((f) => {
            const publicPath = `/uploads/${f.filename}`;
            return baseUrl ? `${baseUrl}${publicPath}` : publicPath;
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    })();

    // Validações básicas
    if (!titulo || !descricao || !categoria) {
      return res.status(400).json({ error: 'Título, descrição e categoria são obrigatórios' });
    }

    if (localizacao !== undefined && localizacao !== null && typeof localizacao === 'string' && !localizacao.trim()) {
      return res.status(400).json({ error: 'Localização inválida' });
    }

    // Verificar limite de chamados para plano gratuito
    if (req.user.plano === 'gratuito') {
      const totalChamados = await Chamado.count({
        where: { usuarioId: req.user.id }
      });
      
      if (totalChamados >= 3) {
        return res.status(403).json({ 
          error: 'Limite de 3 chamados atingido para plano gratuito. Faça upgrade para criar mais chamados.' 
        });
      }
    }

    const chamado = await Chamado.create({
      titulo,
      descricao,
      categoria,
      localizacao,
      orcamento,
      prazo: prazo ? new Date(prazo) : null,
      prioridade: prioridade || 'media',
      telefone: telefone || req.user.telefone,
      email: email || req.user.email,
      requisitos: requisitosNormalizados,
      imagens,
      usuarioId: req.user.id
    });

    // Buscar chamado criado com dados do usuário
    const chamadoCompleto = await Chamado.findByPk(chamado.id, {
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email', 'foto']
        }
      ]
    });

    // Disparar notificações para TODOS os outros usuários (candidatos e empresas), exceto o autor
    try {
      const sanitize = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);
      const autorNome = sanitize(req.user?.nome || 'Um usuário');
      const chamadoTitulo = sanitize(chamadoCompleto?.titulo || 'Chamado');

      const destinatarios = await User.findAll({ 
        where: { id: { [Op.ne]: req.user.id } },
        attributes: ['id']
      });
      const notifs = destinatarios.map(u => ({
        usuarioId: u.id,
        tipo: 'chamado_publicado',
        titulo: 'Novo chamado publicado',
        mensagem: `${autorNome} publicou o chamado: ${chamadoTitulo}`,
        referenciaTipo: 'chamado',
        referenciaId: chamadoCompleto.id,
      }));
      if (notifs.length > 0) {
        await Notificacao.bulkCreate(notifs, { validate: true });
      }
    } catch (e) {
      console.warn('Aviso: falha ao criar notificações de novo chamado:', e.message);
    }

    res.status(201).json(chamadoCompleto);
  } catch (error) {
    console.error('Erro ao criar chamado:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Atualizar chamado
exports.atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const dadosAtualizacao = req.body;

    const chamado = await Chamado.findOne({
      where: { id, usuarioId: req.user.id }
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    // Verificar se pode alterar status
    if (dadosAtualizacao.status && !['aberto', 'em_andamento', 'concluido', 'fechado'].includes(dadosAtualizacao.status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    await chamado.update(dadosAtualizacao);

    res.json(chamado);
  } catch (error) {
    console.error('Erro ao atualizar chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Excluir chamado (permitido mesmo com respostas)
exports.excluir = async (req, res) => {
  try {
    const { id } = req.params;

    const chamado = await Chamado.findOne({
      where: { id, usuarioId: req.user.id }
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    // Apagar respostas relacionadas e depois o chamado em uma transação
    await Chamado.sequelize.transaction(async (t) => {
      await RespostaChamado.destroy({ where: { chamadoId: id }, transaction: t });
      await chamado.destroy({ transaction: t });
    });

    res.json({ message: 'Chamado excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Adicionar resposta ao chamado
exports.adicionarResposta = async (req, res) => {
  try {
    const { id } = req.params;
    const { resposta, tipo, orcamento, prazo } = req.body;

    if (!resposta) {
      return res.status(400).json({ error: 'Resposta é obrigatória' });
    }

    const chamado = await Chamado.findByPk(id);
    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    // Verificar se não é o próprio autor do chamado
    if (chamado.usuarioId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode responder ao seu próprio chamado' });
    }

    // Verificar limite de respostas para plano gratuito
    if (req.user.plano === 'gratuito') {
      const totalRespostas = await RespostaChamado.count({
        where: { usuarioId: req.user.id }
      });
      
      if (totalRespostas >= 2) {
        return res.status(403).json({ 
          error: 'Limite de 2 respostas atingido para plano gratuito. Faça upgrade para responder mais chamados.' 
        });
      }
    }

    const novaResposta = await RespostaChamado.create({
      chamadoId: id,
      usuarioId: req.user.id,
      resposta,
      tipo: tipo || 'resposta',
      orcamento: orcamento ? parseFloat(orcamento) : null,
      prazo: prazo ? new Date(prazo) : null
    });

    // Incrementar contador de respostas no chamado
    await chamado.increment('respostas');

    // Buscar resposta criada com dados do usuário
    const respostaCompleta = await RespostaChamado.findByPk(novaResposta.id, {
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email', 'foto']
        }
      ]
    });

    // Notificar o autor do chamado sobre a nova resposta
    try {
      if (chamado && chamado.usuarioId) {
        await Notificacao.create({
          usuarioId: chamado.usuarioId,
          tipo: 'sistema',
          titulo: 'Nova resposta ao seu chamado',
          mensagem: `${respostaCompleta?.usuario?.nome || 'Um usuário'} respondeu ao chamado: ${chamado.titulo}`,
          referenciaTipo: 'chamado',
          referenciaId: chamado.id,
        });
      }
    } catch (e) {
      console.warn('Aviso: falha ao criar notificação de nova resposta de chamado:', e.message);
    }

    res.status(201).json(respostaCompleta);
  } catch (error) {
    console.error('Erro ao adicionar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Marcar resposta como aceita
exports.aceitarResposta = async (req, res) => {
  try {
    const { chamadoId, respostaId } = req.params;

    const chamado = await Chamado.findOne({
      where: { id: chamadoId, usuarioId: req.user.id }
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    const resposta = await RespostaChamado.findByPk(respostaId);
    if (!resposta || resposta.chamadoId !== parseInt(chamadoId)) {
      return res.status(404).json({ error: 'Resposta não encontrada' });
    }

    // Marcar resposta como aceita
    await resposta.update({ aceita: true });

    // Atualizar status do chamado para em_andamento
    await chamado.update({ status: 'em_andamento' });
    
    // Notificar o autor da resposta que ela foi aceita
    try {
      await Notificacao.create({
        usuarioId: resposta.usuarioId,
        tipo: 'sistema',
        titulo: 'Sua resposta foi aceita',
        mensagem: `Sua resposta ao chamado "${chamado.titulo}" foi aceita. O chamado agora está em andamento.`,
        referenciaTipo: 'chamado',
        referenciaId: chamado.id,
      });
    } catch (e) {
      console.warn('Aviso: falha ao criar notificação de resposta aceita:', e.message);
    }

    res.json({ message: 'Resposta aceita com sucesso' });
  } catch (error) {
    console.error('Erro ao aceitar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Concluir chamado (apenas autor)
exports.concluirChamado = async (req, res) => {
  try {
    const { id } = req.params;
    const { avaliacao, comentario } = req.body;

    console.log('=== DEBUG: Concluir chamado ===');
    console.log('ID do chamado:', id);
    console.log('Usuário logado:', req.user.id);
    console.log('Avaliação:', avaliacao);
    console.log('Comentário:', comentario);

    const chamado = await Chamado.findOne({
      where: { id, usuarioId: req.user.id }
    });

    console.log('Chamado encontrado:', chamado ? 'Sim' : 'Não');

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    console.log('Status atual do chamado:', chamado.status);

    // Verificar se o chamado está em andamento
    if (chamado.status !== 'em_andamento') {
      return res.status(400).json({ 
        error: 'Apenas chamados em andamento podem ser concluídos' 
      });
    }

    // Verificar se há uma resposta aceita
    const respostaAceita = await RespostaChamado.findOne({
      where: { chamadoId: id, aceita: true }
    });

    console.log('Resposta aceita encontrada:', respostaAceita ? 'Sim' : 'Não');

    if (!respostaAceita) {
      return res.status(400).json({ 
        error: 'Não é possível concluir um chamado sem resposta aceita' 
      });
    }

    // Atualizar status para concluído
    await chamado.update({ 
      status: 'concluido',
      dataConclusao: new Date()
    });

    // Se houver avaliação, salvar na resposta aceita
    if (avaliacao || comentario) {
      await respostaAceita.update({
        avaliacaoCliente: avaliacao,
        comentarioCliente: comentario,
        dataAvaliacao: new Date()
      });
    }

    console.log('Chamado concluído com sucesso');

    res.json({ 
      message: 'Chamado concluído com sucesso',
      status: 'concluido'
    });
  } catch (error) {
    console.error('Erro ao concluir chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Fechar chamado (apenas autor)
exports.fecharChamado = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const chamado = await Chamado.findOne({
      where: { id, usuarioId: req.user.id }
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    // Verificar se o chamado pode ser fechado
    if (chamado.status === 'concluido') {
      return res.status(400).json({ 
        error: 'Chamados concluídos não podem ser fechados' 
      });
    }

    // Atualizar status para fechado
    await chamado.update({ 
      status: 'fechado',
      dataFechamento: new Date(),
      motivoFechamento: motivo || 'Fechado pelo autor'
    });

    res.json({ 
      message: 'Chamado fechado com sucesso',
      status: 'fechado'
    });
  } catch (error) {
    console.error('Erro ao fechar chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Reabrir chamado (apenas autor)
exports.reabrirChamado = async (req, res) => {
  try {
    const { id } = req.params;

    const chamado = await Chamado.findOne({
      where: { id, usuarioId: req.user.id }
    });

    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    // Verificar se o chamado pode ser reaberto
    if (chamado.status !== 'fechado') {
      return res.status(400).json({ 
        error: 'Apenas chamados fechados podem ser reabertos' 
      });
    }

    // Atualizar status para aberto
    await chamado.update({ 
      status: 'aberto',
      dataReabertura: new Date()
    });

    res.json({ 
      message: 'Chamado reaberto com sucesso',
      status: 'aberto'
    });
  } catch (error) {
    console.error('Erro ao reabrir chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Favoritar/desfavoritar chamado
exports.toggleFavorito = async (req, res) => {
  try {
    const { id } = req.params;

    const chamado = await Chamado.findByPk(id);
    if (!chamado) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    await chamado.update({ favoritado: !chamado.favoritado });

    res.json({ 
      favoritado: chamado.favoritado,
      message: chamado.favoritado ? 'Chamado favoritado' : 'Favorito removido'
    });
  } catch (error) {
    console.error('Erro ao favoritar chamado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar chamados do usuário
exports.meusChamados = async (req, res) => {
  try {
    const chamados = await Chamado.findAll({
      where: { usuarioId: req.user.id },
      include: [
        {
          model: RespostaChamado,
          as: 'respostasList',
          attributes: ['id'],
          separate: true
        }
      ],
      order: [['data', 'DESC']]
    });

    const chamadosComRespostas = chamados.map(chamado => {
      const chamadoJson = chamado.toJSON();
      chamadoJson.totalRespostas = chamado.respostasList ? chamado.respostasList.length : 0;
      delete chamadoJson.respostasList;
      return chamadoJson;
    });

    res.json(chamadosComRespostas);
  } catch (error) {
    console.error('Erro ao listar meus chamados:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Teste: Verificar respostas existentes
exports.testarRespostas = async (req, res) => {
  try {
    const respostas = await RespostaChamado.findAll({
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email']
        },
        {
          model: Chamado,
          as: 'chamado',
          attributes: ['id', 'titulo']
        }
      ]
    });
    
    console.log('=== TESTE: Total de respostas no banco:', respostas.length);
    console.log('=== TESTE: Respostas:', respostas.map(r => ({
      id: r.id,
      chamadoId: r.chamadoId,
      usuarioId: r.usuarioId,
      resposta: r.resposta.substring(0, 50) + '...',
      data: r.data
    })));
    
    res.json({
      total: respostas.length,
      respostas: respostas
    });
  } catch (error) {
    console.error('Erro ao testar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar respostas do usuário
exports.minhasRespostas = async (req, res) => {
  try {
    const respostas = await RespostaChamado.findAll({
      where: { usuarioId: req.user.id },
      include: [
        {
          model: Chamado,
          as: 'chamado',
          attributes: ['id', 'titulo', 'status', 'categoria']
        }
      ],
      order: [['data', 'DESC']]
    });

    res.json(respostas);
  } catch (error) {
    console.error('Erro ao listar minhas respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}; 

// Teste: Verificar respostas existentes
exports.testarRespostas = async (req, res) => {
  try {
    const respostas = await RespostaChamado.findAll({
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nome', 'email']
        },
        {
          model: Chamado,
          as: 'chamado',
          attributes: ['id', 'titulo']
        }
      ]
    });
    
    console.log('=== TESTE: Total de respostas no banco:', respostas.length);
    console.log('=== TESTE: Respostas:', respostas.map(r => ({
      id: r.id,
      chamadoId: r.chamadoId,
      usuarioId: r.usuarioId,
      resposta: r.resposta.substring(0, 50) + '...',
      data: r.data
    })));
    
    res.json({
      total: respostas.length,
      respostas: respostas
    });
  } catch (error) {
    console.error('Erro ao testar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}; 