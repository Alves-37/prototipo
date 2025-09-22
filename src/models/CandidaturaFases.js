const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Candidatura = sequelize.define('Candidatura', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vagaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'vagas',
      key: 'id'
    }
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Sistema de fases de candidatura
  fase: {
    type: DataTypes.ENUM(
      'recebida',           // Candidatura recebida
      'em_analise',         // Em análise pela empresa
      'entrevista_agendada', // Entrevista marcada
      'entrevista_realizada', // Entrevista concluída
      'teste_tecnico',      // Teste técnico aplicado
      'aprovada',           // Candidatura aprovada
      'reprovada',          // Candidatura reprovada
      'contratada'          // Candidato contratado
    ),
    defaultValue: 'recebida',
    allowNull: false
  },
  // Status geral (para compatibilidade)
  status: {
    type: DataTypes.ENUM('recebida', 'em_analise', 'entrevista_agendada', 'entrevista_realizada', 'aprovado', 'reprovado'),
    defaultValue: 'recebida',
    allowNull: false
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  telefone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkedin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  disponibilidade: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Campos específicos para cada fase
  dataEntrevista: {
    type: DataTypes.DATE,
    allowNull: true
  },
  localEntrevista: {
    type: DataTypes.STRING,
    allowNull: true
  },
  observacoesEmpresa: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  feedbackEntrevista: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  avaliacaoEmpresa: {
    type: DataTypes.INTEGER, // 1-5 estrelas
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  
  // Novos campos para fases avançadas
  dataTesteTecnico: {
    type: DataTypes.DATE,
    allowNull: true
  },
  resultadoTesteTecnico: {
    type: DataTypes.ENUM('aprovado', 'reprovado', 'pendente'),
    allowNull: true
  },
  notaTesteTecnico: {
    type: DataTypes.DECIMAL(5, 2), // Nota de 0 a 100
    allowNull: true,
    validate: {
      min: 0,
      max: 100
    }
  },
  
  // Campos para fase de contratação
  dataContratacao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  salarioProposto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  dataInicio: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Histórico de mudanças de fase
  historicoFases: {
    type: DataTypes.TEXT, // JSON string com histórico
    allowNull: true
  }
}, {
  tableName: 'candidaturas',
  timestamps: true,
  hooks: {
    beforeUpdate: async (candidatura) => {
      // Atualizar status baseado na fase
      const faseToStatus = {
        'recebida': 'recebida',
        'em_analise': 'em_analise',
        'entrevista_agendada': 'entrevista_agendada',
        'entrevista_realizada': 'entrevista_realizada',
        'teste_tecnico': 'entrevista_realizada',
        'aprovada': 'aprovado',
        'reprovada': 'reprovado',
        'contratada': 'aprovado'
      };
      
      candidatura.status = faseToStatus[candidatura.fase] || candidatura.status;
      
      // Registrar mudança no histórico
      if (candidatura.changed('fase')) {
        const historico = JSON.parse(candidatura.historicoFases || '[]');
        historico.push({
          fase: candidatura.fase,
          data: new Date().toISOString(),
          observacao: candidatura.observacoesEmpresa || 'Mudança de fase'
        });
        candidatura.historicoFases = JSON.stringify(historico);
      }
    }
  }
});

module.exports = Candidatura; 