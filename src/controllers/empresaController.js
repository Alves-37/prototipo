const { User, Vaga, Candidatura } = require('../models');

// Buscar estatísticas da empresa
exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DEBUG: Buscando estatísticas para empresa ID:', id);
    
    // Verificar se o usuário existe e é uma empresa
    const empresa = await User.findByPk(id);
    if (!empresa || empresa.tipo !== 'empresa') {
      console.log('Empresa não encontrada ou não é do tipo empresa');
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    console.log('Empresa encontrada:', empresa.nome);

    // Buscar vagas da empresa
    const vagas = await Vaga.findAll({ where: { empresaId: id } });
    console.log('Vagas encontradas:', vagas.length);
    
    // Calcular estatísticas
    const vagasPublicadas = vagas.length;
    const vagasAtivas = vagas.filter(v => v.status === 'publicada').length;
    const vagasExpiradas = vagas.filter(v => v.status === 'expirada').length;
    
    // Contar candidaturas reais
    const vagaIds = vagas.map(v => v.id);
    const candidaturasRecebidas = vagaIds.length > 0 ? await Candidatura.count({
      where: { vagaId: vagaIds }
    }) : 0;
    
    // Mock de mensagens (será implementado quando tivermos essa tabela)
    const mensagens = 0; // TODO: implementar quando tivermos tabela de mensagens

    const stats = {
      vagasPublicadas,
      candidaturasRecebidas,
      vagasAtivas,
      mensagens,
      vagasExpiradas
    };

    console.log('Estatísticas calculadas:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
};

// Buscar alertas da empresa
exports.getAlertas = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DEBUG: Buscando alertas para empresa ID:', id);
    
    // Verificar se o usuário existe e é uma empresa
    const empresa = await User.findByPk(id);
    if (!empresa || empresa.tipo !== 'empresa') {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    // Buscar vagas da empresa
    const vagas = await Vaga.findAll({ where: { empresaId: id } });
    
    const alertas = [];

    // Verificar vagas expirando em breve (mock)
    const vagasExpirando = vagas.filter(v => {
      // TODO: implementar lógica real de expiração
      return false;
    });

    if (vagasExpirando.length > 0) {
      alertas.push({
        tipo: 'warning',
        texto: `Você tem ${vagasExpirando.length} vaga(s) expirando em breve.`,
        icon: '⚠️'
      });
    }

    // Se não há vagas, sugerir criar a primeira
    if (vagas.length === 0) {
      alertas.push({
        tipo: 'info',
        texto: 'Bem-vindo! Comece publicando sua primeira vaga.',
        icon: '🎉'
      });
    }

    // Se o perfil não está completo, sugerir completar
    if (!empresa.descricao || !empresa.setor) {
      alertas.push({
        tipo: 'info',
        texto: 'Complete seu perfil para atrair mais candidatos.',
        icon: '👤'
      });
    }

    console.log('Alertas gerados:', alertas);
    res.json(alertas);
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
};

// Buscar atividades recentes da empresa
exports.getAtividades = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== DEBUG: Buscando atividades para empresa ID:', id);
    
    // Verificar se o usuário existe e é uma empresa
    const empresa = await User.findByPk(id);
    if (!empresa || empresa.tipo !== 'empresa') {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const atividades = [];

    // Função para calcular tempo relativo
    const calcularTempoRelativo = (data) => {
      const agora = new Date();
      const diffEmMinutos = Math.floor((agora - new Date(data)) / (1000 * 60));
      
      if (diffEmMinutos < 1) {
        return 'Agora';
      } else if (diffEmMinutos < 60) {
        return `Há ${diffEmMinutos} minuto(s)`;
      } else {
        const diffEmHoras = Math.floor(diffEmMinutos / 60);
        if (diffEmHoras < 24) {
          return `Há ${diffEmHoras} hora(s)`;
        } else {
          const diffEmDias = Math.floor(diffEmHoras / 24);
          if (diffEmDias < 7) {
            return `Há ${diffEmDias} dia(s)`;
          } else {
            const diffEmSemanas = Math.floor(diffEmDias / 7);
            return `Há ${diffEmSemanas} semana(s)`;
          }
        }
      }
    };

    // Adicionar atividade de criação da conta com tempo real
    const tempoCriacao = calcularTempoRelativo(empresa.createdAt);
    atividades.push({
      tipo: 'welcome',
      texto: 'Conta criada com sucesso',
      tempo: tempoCriacao,
      icon: '🎉'
    });

    // Se o perfil foi atualizado recentemente
    if (empresa.updatedAt && empresa.updatedAt !== empresa.createdAt) {
      const tempoAtualizacao = calcularTempoRelativo(empresa.updatedAt);
      
      atividades.push({
        tipo: 'profile',
        texto: 'Perfil atualizado',
        tempo: tempoAtualizacao,
        icon: '👤'
      });
    }

    // Buscar vagas da empresa e adicionar como atividades
    const vagas = await Vaga.findAll({ 
      where: { empresaId: id },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    vagas.forEach(vaga => {
      const tempoVaga = calcularTempoRelativo(vaga.createdAt);

      atividades.push({
        tipo: 'vaga',
        texto: `Vaga "${vaga.titulo}" publicada`,
        tempo: tempoVaga,
        icon: '📢'
      });
    });

    // Ordenar por data (mais recentes primeiro)
    atividades.sort((a, b) => {
      // Se ambos são "Agora", manter ordem original
      if (a.tempo === 'Agora' && b.tempo === 'Agora') return 0;
      // Se apenas um é "Agora", ele vem primeiro
      if (a.tempo === 'Agora') return -1;
      if (b.tempo === 'Agora') return 1;
      // Para outros casos, manter ordem original (já vem ordenada do banco)
      return 0;
    });

    console.log('Atividades geradas:', atividades);
    res.json(atividades);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
}; 