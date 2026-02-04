const { Mensagem, Conversa, User, Vaga } = require('../models');
const { Op } = require('sequelize');

// Função utilitária para gerar ID de conversa
const gerarConversaId = (userId1, userId2, vagaId = null) => {
  const ids = [userId1, userId2].sort((a, b) => a - b);
  return vagaId ? `${ids[0]}_${ids[1]}_${vagaId}` : `${ids[0]}_${ids[1]}`;
};

// Enviar anexo (multipart)
exports.enviarAnexo = async (req, res) => {
  try {
    const remetenteId = req.user.id;
    const { destinatarioId, vagaId = null } = req.body || {};

    if (!destinatarioId) {
      return res.status(400).json({ error: 'Destinatário é obrigatório' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo é obrigatório' });
    }

    const destinatario = await User.findByPk(destinatarioId);
    if (!destinatario) {
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    const conversa = await obterOuCriarConversa(remetenteId, Number(destinatarioId), vagaId);

    const campoBloqueada = conversa.usuario1Id === remetenteId ? 'bloqueada1' : 'bloqueada2';
    if (conversa[campoBloqueada]) {
      return res.status(403).json({ error: 'Conversa bloqueada' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicPath = `/uploads/${req.file.filename}`;
    const url = `${baseUrl}${publicPath}`;

    const mimetype = String(req.file.mimetype || '').toLowerCase();
    let tipo = 'arquivo';
    if (mimetype.startsWith('image/')) tipo = 'imagem';
    if (mimetype.startsWith('audio/')) tipo = 'arquivo';

    const arquivoInfo = {
      url,
      path: publicPath,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    const texto = tipo === 'imagem'
      ? '[Imagem]'
      : (mimetype.startsWith('audio/') ? '[Áudio]' : `[Arquivo] ${req.file.originalname}`);

    const mensagem = await Mensagem.create({
      remetenteId,
      destinatarioId: Number(destinatarioId),
      texto,
      tipo,
      arquivo: arquivoInfo,
      conversaId: conversa.conversaId,
      vagaId,
    });

    const campoNaoLidas = conversa.usuario1Id === Number(destinatarioId) ? 'mensagensNaoLidas1' : 'mensagensNaoLidas2';
    await conversa.update({
      ultimaMensagem: texto,
      ultimaMensagemData: new Date(),
      [campoNaoLidas]: conversa[campoNaoLidas] + 1,
    });

    let entregueAgora = false;
    try {
      const onlineUsers = req.app && req.app.get ? req.app.get('onlineUsers') : null;
      entregueAgora = !!(onlineUsers && typeof onlineUsers.has === 'function' && onlineUsers.has(String(destinatarioId)));
      if (entregueAgora) {
        await Mensagem.update(
          { entregue: true },
          { where: { id: mensagem.id, entregue: false } }
        );
      }
    } catch {}

    const mensagemFormatada = {
      id: mensagem.id,
      remetente: req.user.tipo === 'empresa' ? 'empresa' : 'candidato',
      remetenteId,
      destinatarioId: Number(destinatarioId),
      texto,
      data: mensagem.createdAt.toLocaleString('pt-BR'),
      tipo,
      arquivo: arquivoInfo,
      lida: false,
      enviada: true,
      entregue: entregueAgora,
      editada: false,
      editadaEm: null,
      apagadaParaTodos: false,
    };

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const payload = {
          conversaId: conversa.conversaId,
          mensagem: mensagemFormatada,
          at: Date.now(),
        };
        io.to(`user:${remetenteId}`).emit('message:new', payload);
        io.to(`user:${destinatarioId}`).emit('message:new', payload);
      }
    } catch {}

    res.status(201).json(mensagemFormatada);
  } catch (error) {
    console.error('Erro ao enviar anexo:', error);
    res.status(500).json({ error: 'Erro ao enviar anexo' });
  }
};

// Editar mensagem
exports.editarMensagem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { texto } = req.body || {};

    if (!texto || !String(texto).trim()) {
      return res.status(400).json({ error: 'Texto é obrigatório' });
    }

    const mensagem = await Mensagem.findByPk(id);
    if (!mensagem) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    if (mensagem.remetenteId !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (mensagem.apagadaParaTodos) {
      return res.status(400).json({ error: 'Não é possível editar uma mensagem apagada' });
    }

    await mensagem.update({
      texto: String(texto).trim(),
      editada: true,
      editadaEm: new Date(),
    });

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const payload = {
          conversaId: mensagem.conversaId,
          mensagem: {
            id: mensagem.id,
            texto: mensagem.texto,
            editada: true,
            editadaEm: mensagem.editadaEm ? mensagem.editadaEm.getTime() : Date.now(),
            apagadaParaTodos: !!mensagem.apagadaParaTodos,
          },
          at: Date.now(),
        };
        io.to(`user:${mensagem.remetenteId}`).emit('message:update', payload);
        io.to(`user:${mensagem.destinatarioId}`).emit('message:update', payload);
      }
    } catch {}

    res.json({
      id: mensagem.id,
      conversaId: mensagem.conversaId,
      texto: mensagem.texto,
      editada: true,
      editadaEm: mensagem.editadaEm ? mensagem.editadaEm.getTime() : null,
    });
  } catch (error) {
    console.error('Erro ao editar mensagem:', error);
    res.status(500).json({ error: 'Erro ao editar mensagem' });
  }
};

// Apagar mensagem (para mim / para todos)
exports.apagarMensagem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const scope = String(req.query?.scope || 'me').toLowerCase();

    const mensagem = await Mensagem.findByPk(id);
    if (!mensagem) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    const participa = mensagem.remetenteId === userId || mensagem.destinatarioId === userId;
    if (!participa) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (scope === 'all') {
      if (mensagem.remetenteId !== userId) {
        return res.status(403).json({ error: 'Só o remetente pode apagar para todos' });
      }

      await mensagem.update({
        apagadaParaTodos: true,
        apagadaEm: new Date(),
        texto: 'Mensagem apagada',
        tipo: 'sistema',
        arquivo: null,
      });

      try {
        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          const payload = {
            conversaId: mensagem.conversaId,
            messageId: mensagem.id,
            scope: 'all',
            at: Date.now(),
          };
          io.to(`user:${mensagem.remetenteId}`).emit('message:delete', payload);
          io.to(`user:${mensagem.destinatarioId}`).emit('message:delete', payload);
        }
      } catch {}

      return res.json({ success: true, scope: 'all' });
    }

    const ocultoParaAtual = Array.isArray(mensagem.ocultoPara) ? mensagem.ocultoPara : [];
    const nextOculto = Array.from(new Set([...ocultoParaAtual.map(x => String(x)), String(userId)])).map(x => Number(x));
    await mensagem.update({ ocultoPara: nextOculto });

    return res.json({ success: true, scope: 'me' });
  } catch (error) {
    console.error('Erro ao apagar mensagem:', error);
    res.status(500).json({ error: 'Erro ao apagar mensagem' });
  }
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
    let mensagens = null;
    try {
      mensagens = await Mensagem.findAll({
        where: { conversaId },
        include: [
          { model: User, as: 'remetente', attributes: ['id', 'nome', 'foto'] },
          { model: User, as: 'destinatario', attributes: ['id', 'nome', 'foto'] }
        ],
        order: [['createdAt', 'ASC']]
      });
    } catch (e) {
      const msg = String(e?.message || '')
      const isUnknownColumn = msg.toLowerCase().includes('unknown column') || msg.toLowerCase().includes('does not exist')
      if (!isUnknownColumn) throw e

      // Fallback para banco antigo (produção sem alter): seleciona apenas colunas antigas
      mensagens = await Mensagem.findAll({
        where: { conversaId },
        attributes: ['id', 'remetenteId', 'destinatarioId', 'texto', 'tipo', 'arquivo', 'lida', 'enviada', 'entregue', 'vagaId', 'conversaId', 'createdAt'],
        include: [
          { model: User, as: 'remetente', attributes: ['id', 'nome', 'foto'] },
          { model: User, as: 'destinatario', attributes: ['id', 'nome', 'foto'] }
        ],
        order: [['createdAt', 'ASC']]
      });
    }

    const mensagensVisiveis = (mensagens || []).filter((m) => {
      try {
        const ocultoPara = Array.isArray(m?.ocultoPara) ? m.ocultoPara : []
        return !ocultoPara.map(x => String(x)).includes(String(userId))
      } catch {
        return true
      }
    })

    // Marcar mensagens como lidas
    const mensagensParaMarcar = mensagensVisiveis.filter(msg => 
      msg.destinatarioId === userId && !msg.lida
    );

    if (mensagensParaMarcar.length > 0) {
      const idsMarcadas = mensagensParaMarcar.map(m => m.id);
      await Mensagem.update(
        { lida: true },
        { 
          where: { 
            id: { [Op.in]: idsMarcadas }
          }
        }
      );

      // Atualizar contador de mensagens não lidas
      const campoNaoLidas = conversa.usuario1Id === userId ? 'mensagensNaoLidas1' : 'mensagensNaoLidas2';
      await conversa.update({
        [campoNaoLidas]: 0
      });

      try {
        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          const otherUserId = conversa.usuario1Id === userId ? conversa.usuario2Id : conversa.usuario1Id;
          io.to(`user:${otherUserId}`).emit('message:status', {
            conversaId,
            messageIds: idsMarcadas,
            lida: true,
            at: Date.now(),
          });
        }
      } catch {}
    }

    // Formatar mensagens para o frontend
    const mensagensFormatadas = mensagensVisiveis.map(msg => ({
      id: msg.id,
      remetente: msg.remetenteId === userId ? (req.user.tipo === 'empresa' ? 'empresa' : 'candidato') : 
                (msg.remetente.tipo === 'empresa' ? 'empresa' : 'candidato'),
      remetenteId: msg.remetenteId,
      destinatarioId: msg.destinatarioId,
      texto: msg.apagadaParaTodos ? 'Mensagem apagada' : msg.texto,
      data: msg.createdAt.toLocaleString('pt-BR'),
      tipo: msg.apagadaParaTodos ? 'sistema' : msg.tipo,
      arquivo: msg.apagadaParaTodos ? null : msg.arquivo,
      lida: msg.lida,
      enviada: msg.enviada,
      entregue: msg.entregue,
      editada: !!msg.editada,
      editadaEm: msg.editadaEm ? msg.editadaEm.getTime() : null,
      apagadaParaTodos: !!msg.apagadaParaTodos
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

    let entregueAgora = false;
    try {
      const onlineUsers = req.app && req.app.get ? req.app.get('onlineUsers') : null;
      entregueAgora = !!(onlineUsers && typeof onlineUsers.has === 'function' && onlineUsers.has(String(destinatarioId)));
      if (entregueAgora) {
        await Mensagem.update(
          { entregue: true },
          { where: { id: mensagemCompleta.id, entregue: false } }
        );
      }
    } catch {}

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
      entregue: entregueAgora,
      editada: false,
      editadaEm: null,
      apagadaParaTodos: false
    };

    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        const payload = {
          conversaId: conversa.conversaId,
          mensagem: mensagemFormatada,
          at: Date.now(),
        };
        io.to(`user:${remetenteId}`).emit('message:new', payload);
        io.to(`user:${destinatarioId}`).emit('message:new', payload);

        if (entregueAgora) {
          io.to(`user:${remetenteId}`).emit('message:status', {
            conversaId: conversa.conversaId,
            messageId: mensagemCompleta.id,
            entregue: true,
            lida: false,
            at: Date.now(),
          });
        }
      }
    } catch (e) {
      console.error('Erro ao emitir mensagem via socket:', e);
    }

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
    const [affected] = await Mensagem.update(
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

    if (affected && Number(affected) > 0) {
      try {
        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io) {
          const otherUserId = conversa.usuario1Id === userId ? conversa.usuario2Id : conversa.usuario1Id;
          io.to(`user:${otherUserId}`).emit('message:status', {
            conversaId,
            lida: true,
            at: Date.now(),
          });
        }
      } catch {}
    }

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
      attributes: ['id', 'nome', 'email', 'tipo', 'foto', 'logo', 'telefone', 'updatedAt'],
      limit: 20
    });

    const onlineUsers = req.app && req.app.get ? req.app.get('onlineUsers') : null;
    const lastSeenByUserId = req.app && req.app.get ? req.app.get('lastSeenByUserId') : null;
    const isOnline = (id) => {
      try {
        if (!onlineUsers || typeof onlineUsers.has !== 'function') return false;
        return onlineUsers.has(String(id));
      } catch {
        return false;
      }
    };

    const getLastSeenAt = (id) => {
      try {
        if (!lastSeenByUserId || typeof lastSeenByUserId.get !== 'function') return null;
        return lastSeenByUserId.get(String(id)) || null;
      } catch {
        return null;
      }
    };

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
      ultimaAtividade: usuario.updatedAt ? new Date(usuario.updatedAt).toLocaleString('pt-BR') : 'Nunca',
      online: isOnline(usuario.id),
      lastSeenAt: getLastSeenAt(usuario.id)
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