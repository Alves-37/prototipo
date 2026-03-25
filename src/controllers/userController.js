const { User, Notificacao } = require('../models');

// Util: normaliza valores vindos do frontend
// - Converte string vazia ('') para null
// - Converte 'null' e 'undefined' (strings) para null
// - Mantém 0 e false
const toNullable = (v) => {
  if (v === '' || v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;
    if (s.toLowerCase && (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined')) return null;
  }
  return v;
};

const toNullableInt = (v) => {
  const n = toNullable(v);
  if (n === null) return null;
  const parsed = parseInt(n, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toNullableFloat = (v) => {
  const n = toNullable(v);
  if (n === null) return null;
  const parsed = typeof n === 'string' ? n.replace(',', '.') : n;
  const f = parseFloat(parsed);
  return Number.isNaN(f) ? null : f;
};

// Função para filtrar campos por tipo de usuário (copiada do authController)
const filtrarCamposUsuario = (user) => {
  const userData = user.toJSON();
  delete userData.senha;
  
  if (userData.tipo === 'empresa') {
    // Campos específicos para empresa
    return {
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      tipo: userData.tipo,
      plano: userData.plano,
      statusAssinatura: userData.statusAssinatura,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      perfil: {
        telefone: userData.telefone,
        endereco: userData.endereco,
        capa: userData.capa,
        logo: userData.logo,
        descricao: userData.descricao,
        setor: userData.setor,
        tamanho: userData.tamanho,
        website: userData.website,
        razaoSocial: userData.razaoSocial,
        nuit: userData.nuit,
        alvara: userData.alvara,
        registroComercial: userData.registroComercial,
        inscricaoFiscal: userData.inscricaoFiscal,
        anoFundacao: userData.anoFundacao,
        capitalSocial: userData.capitalSocial,
        moedaCapital: userData.moedaCapital,
        somNotificacoes: Object.prototype.hasOwnProperty.call(userData, 'somNotificacoes') ? userData.somNotificacoes : undefined,
        pushEnabled: Object.prototype.hasOwnProperty.call(userData, 'pushEnabled') ? userData.pushEnabled : undefined,
        pushPromptAnsweredAt: Object.prototype.hasOwnProperty.call(userData, 'pushPromptAnsweredAt') ? userData.pushPromptAnsweredAt : undefined
      }
    };
  } else {
    // Campos específicos para candidato
    return {
      id: userData.id,
      nome: userData.nome,
      email: userData.email,
      tipo: userData.tipo,
      plano: userData.plano,
      statusAssinatura: userData.statusAssinatura,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      perfil: {
        telefone: userData.telefone,
        endereco: userData.endereco,
        bio: userData.bio,
        experiencia: userData.experiencia,
        formacao: userData.formacao,
        instituicao: userData.instituicao,
        resumo: userData.resumo,
        habilidades: userData.habilidades ? JSON.parse(userData.habilidades) : [],
        curriculo: userData.curriculo,
        cvData: userData.cvData,
        dataNascimento: userData.dataNascimento,
        foto: userData.foto,
        capa: userData.capa,
        linkedin: userData.linkedin,
        github: userData.github,
        portfolio: userData.portfolio,
        behance: userData.behance,
        instagram: userData.instagram,
        twitter: userData.twitter,
        tipoTrabalho: userData.tipoTrabalho,
        faixaSalarial: userData.faixaSalarial,
        localizacaoPreferida: userData.localizacaoPreferida,
        disponibilidade: userData.disponibilidade,
        perfilPublico: userData.perfilPublico,
        mostrarTelefone: userData.mostrarTelefone,
        mostrarEndereco: userData.mostrarEndereco,
        alertasVagas: userData.alertasVagas,
        frequenciaAlertas: userData.frequenciaAlertas,
        somNotificacoes: Object.prototype.hasOwnProperty.call(userData, 'somNotificacoes') ? userData.somNotificacoes : undefined,
        pushEnabled: Object.prototype.hasOwnProperty.call(userData, 'pushEnabled') ? userData.pushEnabled : undefined,
        pushPromptAnsweredAt: Object.prototype.hasOwnProperty.call(userData, 'pushPromptAnsweredAt') ? userData.pushPromptAnsweredAt : undefined,
        vagasInteresse: userData.vagasInteresse ? JSON.parse(userData.vagasInteresse) : [],
        idiomas: userData.idiomas ? JSON.parse(userData.idiomas) : [],
        certificacoes: userData.certificacoes ? JSON.parse(userData.certificacoes) : [],
        projetos: userData.projetos ? JSON.parse(userData.projetos) : []
      }
    };
  }
};

// Buscar usuário por ID
exports.buscarPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(filtrarCamposUsuario(user));
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Atualizar usuário
exports.atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar se o usuário existe
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o usuário logado está atualizando seu próprio perfil
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Preparar dados para atualização (somente campos enviados)
    const dadosAtualizacao = {};
    const setIfProvided = (key, val) => {
      if (val !== undefined) {
        const normalized = toNullable(val);
        dadosAtualizacao[key] = normalized;
      }
    };
    setIfProvided('nome', updateData.nome);
    setIfProvided('email', updateData.email);
    
    // Se for candidato, incluir campos do perfil
    if (user.tipo === 'usuario') {
      const perfil = updateData.perfil || {};
      
      // Campos básicos (normalizados)
      setIfProvided('telefone', perfil.telefone);
      setIfProvided('endereco', perfil.endereco);
      setIfProvided('bio', perfil.bio);
      setIfProvided('experiencia', perfil.experiencia);
      setIfProvided('formacao', perfil.formacao);
      setIfProvided('instituicao', perfil.instituicao);
      setIfProvided('resumo', perfil.resumo);
      if (perfil.cv !== undefined) setIfProvided('curriculo', perfil.cv); // Mapear cv -> curriculo
      setIfProvided('cvData', perfil.cvData);
      if (perfil.dataNascimento !== undefined) {
        const n = toNullable(perfil.dataNascimento);
        if (n === null) {
          dadosAtualizacao.dataNascimento = null;
        } else {
          const d = new Date(n);
          dadosAtualizacao.dataNascimento = isNaN(d.getTime()) ? null : d;
        }
      }
      setIfProvided('foto', perfil.foto);
      setIfProvided('capa', perfil.capa);
      
      // Redes sociais
      setIfProvided('linkedin', perfil.linkedin);
      setIfProvided('github', perfil.github);
      setIfProvided('portfolio', perfil.portfolio);
      setIfProvided('behance', perfil.behance);
      setIfProvided('instagram', perfil.instagram);
      setIfProvided('twitter', perfil.twitter);
      
      // Preferências (validar enums quando enviados)
      if (perfil.tipoTrabalho !== undefined) {
        const allowed = ['remoto', 'presencial', 'hibrido'];
        dadosAtualizacao.tipoTrabalho = allowed.includes(perfil.tipoTrabalho) ? perfil.tipoTrabalho : null;
      }
      if (perfil.faixaSalarial !== undefined) {
        const allowed = ['5000-10000','10000-15000','15000-25000','25000-35000','35000-50000','50000+'];
        dadosAtualizacao.faixaSalarial = allowed.includes(perfil.faixaSalarial) ? perfil.faixaSalarial : null;
      }
      setIfProvided('localizacaoPreferida', perfil.localizacaoPreferida);
      if (perfil.disponibilidade !== undefined) {
        const allowed = ['imediata','15dias','30dias','60dias'];
        dadosAtualizacao.disponibilidade = allowed.includes(perfil.disponibilidade) ? perfil.disponibilidade : null;
      }
      
      // Privacidade
      if (perfil.perfilPublico !== undefined) dadosAtualizacao.perfilPublico = !!perfil.perfilPublico;
      if (perfil.mostrarTelefone !== undefined) dadosAtualizacao.mostrarTelefone = !!perfil.mostrarTelefone;
      if (perfil.mostrarEndereco !== undefined) dadosAtualizacao.mostrarEndereco = !!perfil.mostrarEndereco;
      
      // Notificações
      if (perfil.alertasVagas !== undefined) dadosAtualizacao.alertasVagas = !!perfil.alertasVagas;
      setIfProvided('frequenciaAlertas', perfil.frequenciaAlertas);
      if (perfil.somNotificacoes !== undefined) {
        // Atualiza apenas se a coluna existir no modelo
        try {
          const hasField = Object.prototype.hasOwnProperty.call(user.toJSON(), 'somNotificacoes');
          if (hasField) {
            dadosAtualizacao.somNotificacoes = !!perfil.somNotificacoes;
          }
        } catch {}
      }

      if (perfil.pushEnabled !== undefined) {
        dadosAtualizacao.pushEnabled = perfil.pushEnabled === null ? null : !!perfil.pushEnabled;
      }
      if (perfil.pushPromptAnsweredAt !== undefined) {
        if (perfil.pushPromptAnsweredAt === null || perfil.pushPromptAnsweredAt === '') {
          dadosAtualizacao.pushPromptAnsweredAt = null;
        } else {
          const d = new Date(perfil.pushPromptAnsweredAt);
          dadosAtualizacao.pushPromptAnsweredAt = isNaN(d.getTime()) ? new Date() : d;
        }
      }
      
      // Campos JSON
      if (perfil.habilidades !== undefined) {
        dadosAtualizacao.habilidades = Array.isArray(perfil.habilidades) 
          ? JSON.stringify(perfil.habilidades) 
          : perfil.habilidades;
      }
      
      if (perfil.vagasInteresse !== undefined) {
        dadosAtualizacao.vagasInteresse = Array.isArray(perfil.vagasInteresse) 
          ? JSON.stringify(perfil.vagasInteresse) 
          : perfil.vagasInteresse;
      }
      
      if (perfil.idiomas !== undefined) {
        dadosAtualizacao.idiomas = Array.isArray(perfil.idiomas) 
          ? JSON.stringify(perfil.idiomas) 
          : perfil.idiomas;
      }
      
      if (perfil.certificacoes !== undefined) {
        dadosAtualizacao.certificacoes = Array.isArray(perfil.certificacoes) 
          ? JSON.stringify(perfil.certificacoes) 
          : perfil.certificacoes;
      }
      
      if (perfil.projetos !== undefined) {
        dadosAtualizacao.projetos = Array.isArray(perfil.projetos) 
          ? JSON.stringify(perfil.projetos) 
          : perfil.projetos;
      }
    }
    
    // Se for empresa, incluir campos específicos da empresa
    if (user.tipo === 'empresa') {
      // Campos básicos da empresa
      dadosAtualizacao.telefone = toNullable(updateData.telefone);
      dadosAtualizacao.endereco = toNullable(updateData.endereco);
      dadosAtualizacao.descricao = toNullable(updateData.descricao);
      dadosAtualizacao.setor = toNullable(updateData.setor);
      dadosAtualizacao.tamanho = toNullable(updateData.tamanho);
      dadosAtualizacao.website = toNullable(updateData.website);
      dadosAtualizacao.logo = toNullable(updateData.logo);
      
      // Campos de identificação
      dadosAtualizacao.razaoSocial = toNullable(updateData.razaoSocial);
      dadosAtualizacao.nuit = toNullable(updateData.nuit);
      dadosAtualizacao.alvara = toNullable(updateData.alvara);
      dadosAtualizacao.registroComercial = toNullable(updateData.registroComercial);
      dadosAtualizacao.inscricaoFiscal = toNullable(updateData.inscricaoFiscal);
      
      // Campos financeiros
      dadosAtualizacao.anoFundacao = toNullableInt(updateData.anoFundacao);
      dadosAtualizacao.capitalSocial = toNullableFloat(updateData.capitalSocial);
      dadosAtualizacao.moedaCapital = toNullable(updateData.moedaCapital);

      // Preferências gerais também podem ser atualizadas para empresa, quando enviadas via perfil
      const perfil = updateData.perfil || {};
      if (perfil && perfil.somNotificacoes !== undefined) {
        try {
          const hasField = Object.prototype.hasOwnProperty.call(user.toJSON(), 'somNotificacoes');
          if (hasField) {
            dadosAtualizacao.somNotificacoes = !!perfil.somNotificacoes;
          }
        } catch {}
      }

      if (perfil && perfil.pushEnabled !== undefined) {
        dadosAtualizacao.pushEnabled = perfil.pushEnabled === null ? null : !!perfil.pushEnabled;
      }
      if (perfil && perfil.pushPromptAnsweredAt !== undefined) {
        if (perfil.pushPromptAnsweredAt === null || perfil.pushPromptAnsweredAt === '') {
          dadosAtualizacao.pushPromptAnsweredAt = null;
        } else {
          const d = new Date(perfil.pushPromptAnsweredAt);
          dadosAtualizacao.pushPromptAnsweredAt = isNaN(d.getTime()) ? new Date() : d;
        }
      }
    }
    
    // Atualizar usuário
    await user.update(dadosAtualizacao);
    
    // Retornar usuário atualizado
    const userAtualizado = await User.findByPk(id);
    res.json(filtrarCamposUsuario(userAtualizado));
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Solicitar exclusão: pode ser imediata ou agendada para 30 dias
exports.excluir = async (req, res) => {
  try {
    const { id } = req.params;
    const { immediate } = req.query; // Parâmetro para exclusão imediata
    
    // Verificar se o usuário existe
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o usuário logado está excluindo sua própria conta
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Se for exclusão imediata (confirmada pelo usuário)
    if (immediate === 'true') {
      // Excluir todas as candidaturas do usuário
      await Candidatura.destroy({ where: { usuarioId: id } });
      
      // Excluir todas as notificações do usuário
      await Notificacao.destroy({ where: { usuarioId: id } });
      
      // Excluir o usuário permanentemente
      await user.destroy();
      
      return res.json({ message: 'Conta excluída com sucesso', deleted: true });
    }
    
    // Caso contrário, suspender por 30 dias
    const now = new Date();
    const suspendedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Marcar suspensão e data de pedido
    await user.update({
      suspended: true,
      suspendedUntil,
      deletionRequestedAt: now,
    });

    // Enviar notificações (não bloquear fluxo em caso de erro)
    try {
      await Notificacao.bulkCreate([
        {
          usuarioId: user.id,
          titulo: 'Solicitação de exclusão recebida 📴',
          mensagem: 'Sua conta foi marcada para exclusão. Caso mude de ideia, entre em contato com o suporte em até 30 dias para reativá-la.',
          lida: false,
        },
        {
          usuarioId: user.id,
          titulo: 'Suspensão temporária da conta',
          mensagem: 'Durante o período de 30 dias sua conta ficará suspensa e inacessível. Após esse prazo, será removida definitivamente.',
          lida: false,
        },
      ]);
    } catch {}

    return res.json({ message: 'Conta suspensa por 30 dias. Após o prazo, será excluída se não houver contato com o suporte.' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Marcar que o usuário contactou o suporte (cancela exclusão automática)
exports.marcarSuporteContactado = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    await user.update({ supportContacted: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao marcar suporte contactado:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Purga contas expiradas (admin/maintenance): remove usuários suspensos com prazo vencido e sem contato
exports.purgarContasExpiradas = async (req, res) => {
  try {
    const agora = new Date();
    const expirados = await User.findAll({
      where: {
        suspended: true,
        supportContacted: false,
      }
    });
    let removidos = 0;
    for (const u of expirados) {
      if (u.suspendedUntil && new Date(u.suspendedUntil) <= agora) {
        await u.destroy();
        removidos++;
      }
    }
    return res.json({ ok: true, removidos });
  } catch (err) {
    console.error('Erro ao purgar contas expiradas:', err);
    return res.status(500).json({ error: 'Erro ao purgar contas' });
  }
};

// Listar usuários (apenas para admin)
exports.listar = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['senha'] },
      order: User.sequelize.random()
    });
    return res.json(users.map(u => filtrarCamposUsuario(u)));
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// =============================
// Certificações do usuário
// =============================
exports.getCertificacoes = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const certificacoes = user.certificacoes ? JSON.parse(user.certificacoes) : [];
    return res.json(certificacoes);
  } catch (error) {
    console.error('Erro ao obter certificações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.addCertificacao = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const atual = user.certificacoes ? JSON.parse(user.certificacoes) : [];
    const nova = {
      id: Date.now(),
      nome: req.body.nome,
      instituicao: req.body.instituicao,
      data: req.body.data || null,
      link: req.body.link || null,
      arquivo: req.body.arquivo || null
    };
    atual.push(nova);
    await user.update({ certificacoes: JSON.stringify(atual) });
    return res.status(201).json(nova);
  } catch (error) {
    console.error('Erro ao adicionar certificação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.deleteCertificacao = async (req, res) => {
  try {
    const { id, certId } = req.params;
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const atual = user.certificacoes ? JSON.parse(user.certificacoes) : [];
    const filtrado = atual.filter(c => String(c.id) !== String(certId));
    await user.update({ certificacoes: JSON.stringify(filtrado) });
    return res.json({ message: 'Certificação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover certificação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// =============================
// Projetos do usuário
// =============================
exports.getProjetos = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const projetos = user.projetos ? JSON.parse(user.projetos) : [];
    return res.json(projetos);
  } catch (error) {
    console.error('Erro ao obter projetos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.addProjeto = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const atual = user.projetos ? JSON.parse(user.projetos) : [];
    const novo = {
      id: Date.now(),
      nome: req.body.nome,
      descricao: req.body.descricao,
      tecnologias: Array.isArray(req.body.tecnologias) ? req.body.tecnologias : [],
      link: req.body.link || null,
      imagem: req.body.imagem || null
    };
    atual.push(novo);
    await user.update({ projetos: JSON.stringify(atual) });
    return res.status(201).json(novo);
  } catch (error) {
    console.error('Erro ao adicionar projeto:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

exports.deleteProjeto = async (req, res) => {
  try {
    const { id, projetoId } = req.params;
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const atual = user.projetos ? JSON.parse(user.projetos) : [];
    const filtrado = atual.filter(p => String(p.id) !== String(projetoId));
    await user.update({ projetos: JSON.stringify(filtrado) });
    return res.json({ message: 'Projeto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover projeto:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// =============================
// Estatísticas do usuário
// =============================
exports.getEstatisticas = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Placeholder: substituir por contagens reais quando disponível
    const stats = {
      candidaturas: { total: 0, esteMes: 0, aprovadas: 0 },
      entrevistas: { total: 0, agendadas: 0, realizadas: 0 },
      vagasSalvas: 0,
      visualizacoes: 0
    };

    return res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
