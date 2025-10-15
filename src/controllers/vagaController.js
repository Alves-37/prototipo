const { Vaga, User, Candidatura, Notificacao } = require('../models');
const { Op } = require('sequelize');

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
        },
        {
          model: Candidatura,
          as: 'candidaturas',
          include: [
            {
              model: User,
              as: 'usuario',
              attributes: ['id', 'nome', 'email', 'foto']
            }
          ]
        }
      ]
    });
    
    if (!vaga) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }
    
    // Atualizar status da capacidade baseado nos aprovados
    await exports.atualizarStatusCapacidade(id);
    
    // Incrementar visualizações
    await vaga.increment('visualizacoes');
    
    res.json(vaga);
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
    
    // Verificar se pode publicar vaga premium
    if (premium && !['premium', 'empresarial'].includes(empresa.plano)) {
      return res.status(403).json({ 
        error: 'Apenas empresas com plano Premium ou Empresarial podem publicar vagas premium' 
      });
    }
    
    // Criar a vaga
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
      statusCapacidade: 'aberta'
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

      // Enviar notificações push para todos os candidatos
      const pushController = require('./pushController');
      const pushPayload = {
        title: '💼 Nova Vaga Disponível!',
        body: `${empresaNome} publicou: ${vagaTitulo}`,
        icon: '/nevu.png',
        url: `/vaga/${vagaCompleta.id}`,
        tag: `vaga-${vagaCompleta.id}`
      };
      
      // Enviar para todos os usuários (não bloquear o fluxo)
      pushController.sendToAll(pushPayload, empresaId).catch(err => {
        console.warn('Erro ao enviar push notifications:', err);
      });
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
      'area', 'dataExpiracao', 'premium', 'status'
    ];
    
    const dadosAtualizacao = {};
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        dadosAtualizacao[campo] = req.body[campo];
      }
    });
    
    // Verificar se pode tornar premium
    if (dadosAtualizacao.premium && !['premium', 'empresarial'].includes(req.user.plano)) {
      return res.status(403).json({ 
        error: 'Apenas empresas com plano Premium ou Empresarial podem publicar vagas premium' 
      });
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
      include: [
        {
          model: User,
          as: 'empresa',
          attributes: ['id', 'nome', 'logo', 'setor', 'tamanho']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Adicionar contagem de candidaturas para cada vaga
    const vagasComCandidaturas = await Promise.all(
      vagas.map(async (vaga) => {
        const candidaturas = await Candidatura.count({
          where: { vagaId: vaga.id }
        });
        return {
          ...vaga.toJSON(),
          candidaturas: candidaturas
        };
      })
    );

    res.json(vagasComCandidaturas);
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