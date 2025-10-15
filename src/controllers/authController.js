const { User, Notificacao } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'umsegredoseguro';

// Função para filtrar campos por tipo de usuário
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
        habilidades: userData.habilidades,
        curriculo: userData.curriculo,
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
        vagasInteresse: userData.vagasInteresse
      }
    };
  }
};

exports.register = async (req, res) => {
  try {
    const { nome, email, senha, tipo } = req.body;
    if (!nome || !email || !senha || !tipo) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    if (!['usuario', 'empresa'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de usuário inválido.' });
    }
    const existe = await User.findOne({ where: { email } });
    if (existe) {
      return res.status(400).json({ error: 'Este email já está cadastrado.' });
    }
    const hash = await bcrypt.hash(senha, 10);
    const user = await User.create({ nome, email, senha: hash, tipo });

    // Criar notificações de boas-vindas (não bloquear fluxo em caso de erro)
    try {
      const now = new Date();
      await Notificacao.bulkCreate([
        {
          usuarioId: user.id,
          titulo: 'Bem-vindo(a) à Nevú! 🎉',
          mensagem: 'Sua jornada começa agora. Explore vagas, atualize seu perfil e aproveite os recursos da plataforma.',
          lida: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          usuarioId: user.id,
          titulo: 'Conta Nevú criada com sucesso ✅',
          mensagem: 'Sua conta foi criada com sucesso. Você pode gerenciar suas informações no seu perfil.',
          lida: false,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } catch (e) {
      console.warn('Falha ao criar notificações de boas-vindas:', e?.message);
    }

    const userData = filtrarCamposUsuario(user);
    return res.status(201).json(userData);
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Preencha email e senha.' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    // Verificar se a conta está suspensa (aguardando exclusão)
    if (user.suspended) {
      const now = new Date();
      const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
      
      // Se ainda está dentro do período de suspensão
      if (suspendedUntil && suspendedUntil > now) {
        const diasRestantes = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24));
        return res.status(403).json({ 
          error: 'Conta suspensa',
          message: `Sua conta está suspensa e será excluída em ${diasRestantes} dia(s). Entre em contato com o suporte para cancelar a exclusão.`,
          suspended: true,
          diasRestantes
        });
      }
    }
    
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '7d' });
    const userData = filtrarCamposUsuario(user);
    return res.json({ token, user: userData });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Google OAuth callback
exports.googleCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=google');
    }
    const token = jwt.sign({ id: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '7d' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Erro no callback do Google:', err);
    return res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=google');
  }
};
 