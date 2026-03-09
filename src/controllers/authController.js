const { User, Notificacao, PasswordResetToken } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const whatsappService = require('../services/whatsappService');

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
    const { email, senha, tipo } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Preencha email e senha.' });
    }
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Se o frontend informou o tipo esperado, validar contra o tipo real da conta
    if (tipo !== undefined && tipo !== null && String(tipo).trim() !== '') {
      if (!['usuario', 'empresa'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de usuário inválido.' });
      }
      if (user.tipo !== tipo) {
        return res.status(403).json({
          error: 'Tipo de conta incorreto.',
          message: 'Você selecionou um tipo de conta diferente do cadastro. Selecione o tipo correto e tente novamente.',
          wrongType: true,
          expectedType: tipo,
          actualType: user.tipo,
        });
      }
    }
    
    // Verificar se a conta está desativada/suspensa -> bloquear sempre
    if (user.suspended) {
      const now = new Date();
      const suspendedUntil = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
      let payload = {
        error: 'Conta desativada',
        message: 'Sua conta está desativada. Entre em contato com o suporte para reativação.',
        suspended: true,
      };
      if (suspendedUntil && suspendedUntil > now) {
        const diasRestantes = Math.ceil((suspendedUntil - now) / (1000 * 60 * 60 * 24));
        payload = {
          error: 'Conta suspensa',
          message: `Sua conta está suspensa e será excluída em ${diasRestantes} dia(s). Entre em contato com o suporte para cancelar a exclusão.`,
          suspended: true,
          diasRestantes,
        };
      }
      return res.status(403).json(payload);
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
    // Bloquear usuários suspensos também no OAuth
    if (user.suspended) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/login?error=suspended`);
    }
    const token = jwt.sign({ id: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '7d' });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Erro no callback do Google:', err);
    return res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=google');
  }
};

// Função para solicitar recuperação de senha
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Informe email ou número de telefone.' });
    }

    // Buscar usuário por email ou telefone
    let user;
    if (email) {
      user = await User.findOne({ where: { email } });
    } else {
      user = await User.findOne({ where: { telefone: phoneNumber } });
    }

    if (!user) {
      // Não revelar se o usuário existe ou não por segurança
      return res.json({ message: 'Se o usuário existir, você receberá um código de recuperação.' });
    }

    // Verificar se usuário tem telefone cadastrado
    if (!user.telefone) {
      return res.status(400).json({ error: 'Usuário não possui número de telefone cadastrado para recuperação via WhatsApp.' });
    }

    // Validar e formatar número de telefone
    const formattedPhone = whatsappService.validatePhoneNumber(user.telefone);
    if (!formattedPhone) {
      return res.status(400).json({ error: 'Número de telefone inválido.' });
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash do código para armazenar seguro
    const hashedCode = await bcrypt.hash(code, 10);
    
    // Data de expiração (15 minutos)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidar tokens anteriores deste usuário
    await PasswordResetToken.update(
      { used: true },
      { where: { userId: user.id, used: false } }
    );

    // Criar novo token
    await PasswordResetToken.create({
      userId: user.id,
      token: code,
      hashedToken: hashedCode,
      expiresAt,
      phoneNumber: formattedPhone,
      used: false,
    });

    // Enviar código via WhatsApp
    const sent = await whatsappService.sendVerificationCode(formattedPhone, code, user.nome);

    if (!sent && !whatsappService.isEnabled()) {
      // Em desenvolvimento, retorna sucesso mesmo sem enviar
      return res.json({ 
        message: 'Código de recuperação gerado (modo desenvolvimento).',
        developmentMode: true,
        code: code // Apenas em desenvolvimento
      });
    }

    if (!sent) {
      return res.status(500).json({ error: 'Erro ao enviar código de recuperação.' });
    }

    return res.json({ message: 'Código de recuperação enviado via WhatsApp.' });
  } catch (err) {
    console.error('Erro na recuperação de senha:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Função para validar código e redefinir senha
exports.resetPassword = async (req, res) => {
  try {
    const { code, newPassword, email } = req.body;

    if (!code || !newPassword) {
      return res.status(400).json({ error: 'Código e nova senha são obrigatórios.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // Buscar token válido
    const resetToken = await PasswordResetToken.findOne({
      where: {
        token: code,
        used: false,
        expiresAt: {
          [require('sequelize').Op.gt]: new Date(),
        },
      },
      include: [{ model: User, as: 'user' }],
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    // Verificar se o email corresponde (se fornecido)
    if (email && resetToken.user.email !== email) {
      return res.status(400).json({ error: 'Email não corresponde ao usuário do código.' });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha do usuário
    await resetToken.user.update({ senha: hashedPassword });

    // Marcar token como usado
    await resetToken.update({ used: true });

    // Invalidar todos os outros tokens deste usuário
    await PasswordResetToken.update(
      { used: true },
      { where: { userId: resetToken.user.id, used: false } }
    );

    return res.json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Função para verificar se código é válido (opcional, para validação no frontend)
exports.verifyResetCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código é obrigatório.' });
    }

    const resetToken = await PasswordResetToken.findOne({
      where: {
        token: code,
        used: false,
        expiresAt: {
          [require('sequelize').Op.gt]: new Date(),
        },
      },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Código inválido ou expirado.' });
    }

    return res.json({ valid: true, message: 'Código válido.' });
  } catch (err) {
    console.error('Erro ao verificar código:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
 