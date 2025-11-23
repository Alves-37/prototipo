const { Vaga, User, Chamado } = require('../models');
const { Op } = require('sequelize');

// Obter estatísticas da plataforma
exports.getStats = async (req, res) => {
  try {
    // Contar vagas ativas (status = 'publicada')
    const vagas = await Vaga.count({
      where: {
        status: 'publicada'
      }
    });

    // Contar empresas únicas com vagas ativas
    const empresas = await Vaga.count({
      where: {
        status: 'publicada'
      },
      distinct: true,
      col: 'empresaId'
    });

    // Contar empresas totais na plataforma (robusto):
    // - Usuários com tipo 'empresa'
    // - E também quaisquer usuários que já publicaram vagas (empresaId em Vaga)
    const empresasUsuarios = await User.findAll({
      where: { tipo: 'empresa' },
      attributes: ['id']
    });

    const empresasDeVagas = await Vaga.findAll({
      attributes: ['empresaId'],
      group: ['empresaId']
    });

    const setEmpresas = new Set([
      ...empresasUsuarios.map(u => u.id),
      ...empresasDeVagas.map(v => v.empresaId)
    ]);

    const empresasTotal = setEmpresas.size;

    // Contar candidatos (usuários com tipo 'usuario')
    const candidatos = await User.count({
      where: {
        tipo: 'usuario'
      }
    });

    // Contar chamados ativos
    const chamados = await Chamado.count({
      where: {
        status: {
          [Op.in]: ['aberto', 'em_andamento']
        }
      }
    });

    res.json({
      vagas,
      empresas,
      empresasTotal,
      candidatos,
      chamados
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar estatísticas',
      vagas: 0,
      empresas: 0,
      empresasTotal: 0,
      candidatos: 0,
      chamados: 0
    });
  }
};
