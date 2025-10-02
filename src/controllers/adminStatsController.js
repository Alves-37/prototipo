const { User, Denuncia } = require('../models');
const { Op } = require('sequelize');

exports.overview = async (req, res) => {
  try {
    const [usuariosTotal, usuariosAtivos, usuariosInativos] = await Promise.all([
      User.count(),
      // Considera ativos como todos usuários (não há campo status; manter simples)
      User.count(),
      Promise.resolve(0)
    ]);

    const [denunciasTotal, denunciasAbertas, denunciasEmAnalise, denunciasResolvidas] = await Promise.all([
      Denuncia.count(),
      Denuncia.count({ where: { status: 'aberta' } }),
      Denuncia.count({ where: { status: 'em_analise' } }),
      Denuncia.count({ where: { status: 'resolvida' } }),
    ]);

    // Atividade recente (últimos eventos)
    const [ultimosUsuarios, ultimasDenunciasCriadas, ultimasDenunciasResolvidas] = await Promise.all([
      User.findAll({ order: [['createdAt', 'DESC']], limit: 5, attributes: ['id','nome','email','createdAt'] }),
      Denuncia.findAll({ order: [['createdAt', 'DESC']], limit: 5, attributes: ['id','motivo','status','createdAt'] }),
      Denuncia.findAll({ where: { status: 'resolvida' }, order: [['updatedAt', 'DESC']], limit: 5, attributes: ['id','motivo','status','updatedAt'] }),
    ]);

    const atividadeUsuarios = ultimosUsuarios.map(u => ({
      type: 'user_created',
      title: 'Novo usuário cadastrado',
      icon: '👤',
      at: u.createdAt,
      meta: { id: u.id, nome: u.nome, email: u.email },
    }));
    const atividadeDenunciaCriada = ultimasDenunciasCriadas.map(d => ({
      type: 'denuncia_created',
      title: 'Nova denúncia recebida',
      icon: '⚠️',
      at: d.createdAt,
      meta: { id: d.id, motivo: d.motivo },
    }));
    const atividadeDenunciaResolvida = ultimasDenunciasResolvidas.map(d => ({
      type: 'denuncia_resolvida',
      title: 'Denúncia resolvida',
      icon: '✅',
      at: d.updatedAt,
      meta: { id: d.id, motivo: d.motivo },
    }));

    const atividade = [...atividadeUsuarios, ...atividadeDenunciaCriada, ...atividadeDenunciaResolvida]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 15);

    return res.json({
      usuarios: { total: usuariosTotal, ativos: usuariosAtivos, inativos: usuariosInativos },
      denuncias: { total: denunciasTotal, abertas: denunciasAbertas, emAnalise: denunciasEmAnalise, resolvidas: denunciasResolvidas },
      atividade,
    });
  } catch (err) {
    console.error('Erro em admin overview:', err);
    return res.status(500).json({ error: 'Erro ao obter overview' });
  }
};
