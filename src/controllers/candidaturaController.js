const { Candidatura, Vaga, User } = require('../models');

// Candidato se candidata a uma vaga
exports.criar = async (req, res) => {
  try {
    const { vagaId, mensagem, telefone, linkedin, disponibilidade } = req.body;
    const usuarioId = req.user.id;

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

    // Processar arquivo de currículo se enviado
    let curriculoPath = null;
    if (req.file) {
      curriculoPath = req.file.filename; // Nome do arquivo salvo
      
      // Atualizar o currículo do usuário
      await User.update(
        { curriculo: curriculoPath },
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
      fase: 'recebida',
      historicoFases: JSON.stringify([{
        fase: 'recebida',
        data: new Date().toISOString(),
        observacao: 'Candidatura enviada'
      }])
    });

    // Não atualizar status da capacidade aqui - será atualizado quando candidatos forem aprovados
    
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