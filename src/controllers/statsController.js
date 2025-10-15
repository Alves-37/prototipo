const { Vaga, Usuario, Chamado } = require('../models');
const { Op } = require('sequelize');

// Obter estatísticas da plataforma
exports.getStats = async (req, res) => {
  try {
    // Contar vagas ativas
    const vagas = await Vaga.count({
      where: {
        status: 'ativa'
      }
    });

    // Contar empresas únicas com vagas ativas
    const empresas = await Vaga.count({
      where: {
        status: 'ativa'
      },
      distinct: true,
      col: 'empresaId'
    });

    // Contar candidatos (usuários com tipo 'candidato')
    const candidatos = await Usuario.count({
      where: {
        tipo: 'candidato'
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
      candidatos,
      chamados
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar estatísticas',
      vagas: 0,
      empresas: 0,
      candidatos: 0,
      chamados: 0
    });
  }
};
