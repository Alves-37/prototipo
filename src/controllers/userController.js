const { User } = require('../models');

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
        moedaCapital: userData.moedaCapital
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
    
    // Preparar dados para atualização
    const dadosAtualizacao = {
      nome: updateData.nome,
      email: updateData.email
    };
    
    // Se for candidato, incluir campos do perfil
    if (user.tipo === 'usuario') {
      const perfil = updateData.perfil || {};
      
      // Campos básicos
      dadosAtualizacao.telefone = perfil.telefone;
      dadosAtualizacao.endereco = perfil.endereco;
      dadosAtualizacao.bio = perfil.bio;
      dadosAtualizacao.experiencia = perfil.experiencia;
      dadosAtualizacao.formacao = perfil.formacao;
      dadosAtualizacao.instituicao = perfil.instituicao;
      dadosAtualizacao.resumo = perfil.resumo;
      dadosAtualizacao.curriculo = perfil.cv; // Mapear cv para curriculo
      dadosAtualizacao.cvData = perfil.cvData; // Dados do CV em base64
      dadosAtualizacao.dataNascimento = perfil.dataNascimento;
      dadosAtualizacao.foto = perfil.foto;
      
      // Redes sociais
      dadosAtualizacao.linkedin = perfil.linkedin;
      dadosAtualizacao.github = perfil.github;
      dadosAtualizacao.portfolio = perfil.portfolio;
      dadosAtualizacao.behance = perfil.behance;
      dadosAtualizacao.instagram = perfil.instagram;
      dadosAtualizacao.twitter = perfil.twitter;
      
      // Preferências
      dadosAtualizacao.tipoTrabalho = perfil.tipoTrabalho;
      dadosAtualizacao.faixaSalarial = perfil.faixaSalarial;
      dadosAtualizacao.localizacaoPreferida = perfil.localizacaoPreferida;
      dadosAtualizacao.disponibilidade = perfil.disponibilidade;
      
      // Privacidade
      dadosAtualizacao.perfilPublico = perfil.perfilPublico;
      dadosAtualizacao.mostrarTelefone = perfil.mostrarTelefone;
      dadosAtualizacao.mostrarEndereco = perfil.mostrarEndereco;
      
      // Notificações
      dadosAtualizacao.alertasVagas = perfil.alertasVagas;
      dadosAtualizacao.frequenciaAlertas = perfil.frequenciaAlertas;
      
      // Campos JSON
      if (perfil.habilidades) {
        dadosAtualizacao.habilidades = Array.isArray(perfil.habilidades) 
          ? JSON.stringify(perfil.habilidades) 
          : perfil.habilidades;
      }
      
      if (perfil.vagasInteresse) {
        dadosAtualizacao.vagasInteresse = Array.isArray(perfil.vagasInteresse) 
          ? JSON.stringify(perfil.vagasInteresse) 
          : perfil.vagasInteresse;
      }
      
      if (perfil.idiomas) {
        dadosAtualizacao.idiomas = Array.isArray(perfil.idiomas) 
          ? JSON.stringify(perfil.idiomas) 
          : perfil.idiomas;
      }
      
      if (perfil.certificacoes) {
        dadosAtualizacao.certificacoes = Array.isArray(perfil.certificacoes) 
          ? JSON.stringify(perfil.certificacoes) 
          : perfil.certificacoes;
      }
      
      if (perfil.projetos) {
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

// Excluir usuário
exports.excluir = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o usuário existe
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o usuário logado está excluindo sua própria conta
    if (req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    // Excluir usuário
    await user.destroy();
    
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar usuários (apenas para admin)
exports.listar = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['senha'] }
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
