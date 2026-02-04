const { Mensagem, Conversa, User, Vaga } = require('../models');
const { Op } = require('sequelize');

// Função utilitária para gerar ID de conversa
const gerarConversaId = (userId1, userId2, vagaId = null) => {
  const ids = [userId1, userId2].sort((a, b) => a - b);
  return vagaId ? `${ids[0]}_${ids[1]}_${vagaId}` : `${ids[0]}_${ids[1]}`;
};

// Função para obter ou criar conversa
const obterOuCriarConversa = async (userId1, userId2, vagaId = null) => {
  const conversaId = gerarConversaId(userId1, userId2, vagaId);
  
  let conversa = await Conversa.findOne({
    where: { conversaId },
    include: [
      { model: User, as: 'usuario1', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
      { model: User, as: 'usuario2', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
      { model: Vaga, as: 'vaga', attributes: ['id', 'titulo'] }
    ]
  });

  if (!conversa) {
    conversa = await Conversa.create({
      conversaId,
      usuario1Id: Math.min(userId1, userId2),
      usuario2Id: Math.max(userId1, userId2),
      vagaId
    });

    // Recarregar com includes
    conversa = await Conversa.findOne({
      where: { conversaId },
      include: [
        { model: User, as: 'usuario1', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
        { model: User, as: 'usuario2', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo'] }
      ]
    });
  }

  return conversa;
};

// Listar conversas do usuário
exports.listarConversas = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversas = await Conversa.findAll({
      where: {
        [Op.or]: [
          { usuario1Id: userId },
          { usuario2Id: userId }
        ],
        ativa: true
      },
      include: [
        { model: User, as: 'usuario1', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
        { model: User, as: 'usuario2', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
        { model: Vaga, as: 'vaga', attributes: ['id', 'titulo'] }
      ],
      order: [['ultimaMensagemData', 'DESC']]
    });

    // Formatar dados para o frontend
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const toAbsolute = (foto) => {
      if (!foto) return 'https://via.placeholder.com/150';
      const f = String(foto);
      // já é URL absoluta ou data URL (base64)
      if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
      // garantir que tenha uma barra inicial para caminhos relativos
      const path = f.startsWith('/') ? f : `/${f}`;
      return `${baseUrl}${path}`;
    };

    const conversasFormatadas = conversas.map(conversa => {
      const outroUsuario = conversa.usuario1Id === userId ? conversa.usuario2 : conversa.usuario1;
      const mensagensNaoLidas = conversa.usuario1Id === userId ? 
        conversa.mensagensNaoLidas1 : conversa.mensagensNaoLidas2;
      const silenciada = conversa.usuario1Id === userId ? 
        conversa.silenciada1 : conversa.silenciada2;
      const bloqueada = conversa.usuario1Id === userId ? 
        conversa.bloqueada1 : conversa.bloqueada2;

      return {
        id: conversa.conversaId,
        candidato: outroUsuario.nome,
        empresa: outroUsuario.nome,
        email: outroUsuario.email,
        telefone: outroUsuario.telefone || '',
        vaga: conversa.vaga?.titulo || 'Conversa geral',
        data: conversa.ultimaMensagemData,
        ultimaMensagem: conversa.ultimaMensagem || 'Nenhuma mensagem',
        lida: mensagensNaoLidas === 0,
        status: 'ativo',
        tipo: outroUsuario.tipo === 'usuario' ? 'candidato' : 'empresa',
        online: false, // TODO: Implementar sistema de online
        ultimaAtividade: conversa.ultimaMensagemData ? 
          new Date(conversa.ultimaMensagemData).toLocaleString('pt-BR') : 'Nunca',
        foto: toAbsolute(outroUsuario.foto || outroUsuario.logo),
        prioridade: 'media',
        silenciada,
        bloqueada,
        mensagensNaoLidas,
        vagaId: conversa.vagaId,
        destinatarioId: outroUsuario.id
      };
    });

    res.json(conversasFormatadas);
  } catch (error) {
    console.error('Erro ao listar conversas:', error);
    res.status(500).json({ error: 'Erro ao listar conversas' });
  }
};

// Obter mensagens de uma conversa
exports.obterMensagens = async (req, res) => {
  try {
    const { conversaId } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem acesso à conversa
    const conversa = await Conversa.findOne({
      where: { conversaId },
      include: [
        { model: User, as: 'usuario1', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] },
        { model: User, as: 'usuario2', attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo'] }
      ]
    });

    if (!conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (conversa.usuario1Id !== userId && conversa.usuario2Id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar mensagens
    const mensagens = await Mensagem.findAll({
      where: { conversaId },
      include: [
        { model: User, as: 'remetente', attributes: ['id', 'nome', 'foto'] },
        { model: User, as: 'destinatario', attributes: ['id', 'nome', 'foto'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Marcar mensagens como lidas
    const mensagensParaMarcar = mensagens.filter(msg => 
      msg.destinatarioId === userId && !msg.lida
    );

    if (mensagensParaMarcar.length > 0) {
      await Mensagem.update(
        { lida: true },
        { 
          where: { 
            id: { [Op.in]: mensagensParaMarcar.map(m => m.id) }
          }
        }
      );

      // Atualizar contador de mensagens não lidas
      const campoNaoLidas = conversa.usuario1Id === userId ? 'mensagensNaoLidas1' : 'mensagensNaoLidas2';
      await conversa.update({
        [campoNaoLidas]: 0
      });
    }

    // Formatar mensagens para o frontend
    const mensagensFormatadas = mensagens.map(msg => ({
      id: msg.id,
      remetente: msg.remetenteId === userId ? (req.user.tipo === 'empresa' ? 'empresa' : 'candidato') : 
                (msg.remetente.tipo === 'empresa' ? 'empresa' : 'candidato'),
      remetenteId: msg.remetenteId,
      destinatarioId: msg.destinatarioId,
      texto: msg.texto,
      data: msg.createdAt.toLocaleString('pt-BR'),
      tipo: msg.tipo,
      arquivo: msg.arquivo,
      lida: msg.lida,
      enviada: msg.enviada,
      entregue: msg.entregue
    }));

    res.json(mensagensFormatadas);
  } catch (error) {
    console.error('Erro ao obter mensagens:', error);
    res.status(500).json({ error: 'Erro ao obter mensagens' });
  }
};

// Enviar mensagem
exports.enviarMensagem = async (req, res) => {
  try {
    const { destinatarioId, texto, tipo = 'texto', arquivo = null, vagaId = null } = req.body;
    const remetenteId = req.user.id;

    if (!texto || !destinatarioId) {
      return res.status(400).json({ error: 'Texto e destinatário são obrigatórios' });
    }

    // Verificar se o destinatário existe
    const destinatario = await User.findByPk(destinatarioId);
    if (!destinatario) {
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    // Obter ou criar conversa
    const conversa = await obterOuCriarConversa(remetenteId, destinatarioId, vagaId);

    // Verificar se a conversa está bloqueada
    const campoBloqueada = conversa.usuario1Id === remetenteId ? 'bloqueada1' : 'bloqueada2';
    if (conversa[campoBloqueada]) {
      return res.status(403).json({ error: 'Conversa bloqueada' });
    }

    // Criar mensagem
    const mensagem = await Mensagem.create({
      remetenteId,
      destinatarioId,
      texto,
      tipo,
      arquivo,
      conversaId: conversa.conversaId,
      vagaId
    });

    // Atualizar conversa
    const campoNaoLidas = conversa.usuario1Id === destinatarioId ? 'mensagensNaoLidas1' : 'mensagensNaoLidas2';
    await conversa.update({
      ultimaMensagem: texto,
      ultimaMensagemData: new Date(),
      [campoNaoLidas]: conversa[campoNaoLidas] + 1
    });

    // Buscar mensagem com includes
    const mensagemCompleta = await Mensagem.findOne({
      where: { id: mensagem.id },
      include: [
        { model: User, as: 'remetente', attributes: ['id', 'nome', 'foto'] },
        { model: User, as: 'destinatario', attributes: ['id', 'nome', 'foto'] }
      ]
    });

    // Formatar resposta
    const mensagemFormatada = {
      id: mensagemCompleta.id,
      remetente: mensagemCompleta.remetenteId === remetenteId ? 
                (req.user.tipo === 'empresa' ? 'empresa' : 'candidato') : 
                (mensagemCompleta.remetente.tipo === 'empresa' ? 'empresa' : 'candidato'),
      remetenteId: mensagemCompleta.remetenteId,
      destinatarioId: mensagemCompleta.destinatarioId,
      texto: mensagemCompleta.texto,
      data: mensagemCompleta.createdAt.toLocaleString('pt-BR'),
      tipo: mensagemCompleta.tipo,
      arquivo: mensagemCompleta.arquivo,
      lida: false,
      enviada: true,
      entregue: false
    };

    res.status(201).json(mensagemFormatada);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};

// Marcar mensagens como lidas
exports.marcarComoLidas = async (req, res) => {
  try {
    const { conversaId } = req.params;
    const userId = req.user.id;

    // Verificar se o usuário tem acesso à conversa
    const conversa = await Conversa.findOne({
      where: { conversaId }
    });

    if (!conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (conversa.usuario1Id !== userId && conversa.usuario2Id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Marcar mensagens como lidas
    await Mensagem.update(
      { lida: true },
      { 
        where: { 
          conversaId,
          destinatarioId: userId,
          lida: false
        }
      }
    );

    // Atualizar contador de mensagens não lidas
    const campoNaoLidas = conversa.usuario1Id === userId ? 'mensagensNaoLidas1' : 'mensagensNaoLidas2';
    await conversa.update({
      [campoNaoLidas]: 0
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar como lidas:', error);
    res.status(500).json({ error: 'Erro ao marcar como lidas' });
  }
};

// Silenciar/desilenciar conversa
exports.silenciarConversa = async (req, res) => {
  try {
    const { conversaId } = req.params;
    const userId = req.user.id;

    const conversa = await Conversa.findOne({
      where: { conversaId }
    });

    if (!conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (conversa.usuario1Id !== userId && conversa.usuario2Id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const campoSilenciada = conversa.usuario1Id === userId ? 'silenciada1' : 'silenciada2';
    const silenciadaAtual = conversa[campoSilenciada];

    await conversa.update({
      [campoSilenciada]: !silenciadaAtual
    });

    res.json({ 
      success: true, 
      silenciada: !silenciadaAtual 
    });
  } catch (error) {
    console.error('Erro ao silenciar conversa:', error);
    res.status(500).json({ error: 'Erro ao silenciar conversa' });
  }
};

// Bloquear/desbloquear usuário
exports.bloquearUsuario = async (req, res) => {
  try {
    const { conversaId } = req.params;
    const userId = req.user.id;

    const conversa = await Conversa.findOne({
      where: { conversaId }
    });

    if (!conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (conversa.usuario1Id !== userId && conversa.usuario2Id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const campoBloqueada = conversa.usuario1Id === userId ? 'bloqueada1' : 'bloqueada2';
    const bloqueadaAtual = conversa[campoBloqueada];

    await conversa.update({
      [campoBloqueada]: !bloqueadaAtual
    });

    res.json({ 
      success: true, 
      bloqueada: !bloqueadaAtual 
    });
  } catch (error) {
    console.error('Erro ao bloquear usuário:', error);
    res.status(500).json({ error: 'Erro ao bloquear usuário' });
  }
};

// Apagar conversa
exports.apagarConversa = async (req, res) => {
  try {
    const { conversaId } = req.params;
    const userId = req.user.id;

    const conversa = await Conversa.findOne({
      where: { conversaId }
    });

    if (!conversa) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    if (conversa.usuario1Id !== userId && conversa.usuario2Id !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Marcar conversa como inativa
    await conversa.update({ ativa: false });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao apagar conversa:', error);
    res.status(500).json({ error: 'Erro ao apagar conversa' });
  }
};

// Buscar usuários para nova conversa
exports.buscarUsuarios = async (req, res) => {
  try {
    const { busca = '', tipo = '' } = req.query;
    const userId = req.user.id;

    const whereClause = {
      id: { [Op.ne]: userId },
    };

    // Filtro por tipo opcional (empresa ou usuario)
    if (tipo === 'empresa' || tipo === 'usuario') {
      whereClause.tipo = tipo;
    }

    if (busca) {
      whereClause[Op.or] = [
        { nome: { [Op.like]: `%${busca}%` } },
        { email: { [Op.like]: `%${busca}%` } }
      ];
    }

    const usuarios = await User.findAll({
      where: whereClause,
      attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo', 'telefone'],
      limit: 20
    });

    // Formatar dados
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const toAbsolute = (foto) => {
      if (!foto) return 'https://via.placeholder.com/150';
      const f = String(foto);
      if (f.startsWith('http://') || f.startsWith('https://') || f.startsWith('data:')) return f;
      const path = f.startsWith('/') ? f : `/${f}`;
      return `${baseUrl}${path}`;
    };

    const usuariosFormatados = usuarios.map(usuario => ({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      foto: toAbsolute(usuario.foto || usuario.logo),
      telefone: usuario.telefone || '',
      localizacao: usuario.localizacao || '',
      profissao: usuario.profissao || '',
      setor: usuario.setor || '',
      ultimaAtividade: 'Online',
      online: true
    }));

    res.json(usuariosFormatados);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
};

// Iniciar nova conversa
exports.iniciarConversa = async (req, res) => {
  try {
    const { destinatarioId, vagaId = null } = req.body;
    const remetenteId = req.user.id;

    if (!destinatarioId) {
      return res.status(400).json({ error: 'Destinatário é obrigatório' });
    }

    // Verificar se o destinatário existe
    const destinatario = await User.findByPk(destinatarioId);
    if (!destinatario) {
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    // Verificar se não está tentando conversar consigo mesmo
    if (remetenteId === destinatarioId) {
      return res.status(400).json({ error: 'Não é possível iniciar conversa consigo mesmo' });
    }

    // Obter ou criar conversa
    const conversa = await obterOuCriarConversa(remetenteId, destinatarioId, vagaId);

    res.status(201).json({
      conversaId: conversa.conversaId,
      message: 'Conversa iniciada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao iniciar conversa:', error);
    res.status(500).json({ error: 'Erro ao iniciar conversa' });
  }
}; 