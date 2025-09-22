const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Chamado = sequelize.define('Chamado', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 255]
    }
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [10, 2000]
    }
  },
  categoria: {
    type: DataTypes.ENUM('tecnologia', 'domestico', 'design', 'educacao', 'manutencao', 'fotografia', 'outros'),
    allowNull: false,
    defaultValue: 'outros'
  },
  localizacao: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  orcamento: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  prazo: {
    type: DataTypes.DATE,
    allowNull: true
  },
  prioridade: {
    type: DataTypes.ENUM('baixa', 'media', 'alta'),
    allowNull: false,
    defaultValue: 'media'
  },
  status: {
    type: DataTypes.ENUM('aberto', 'em_andamento', 'concluido', 'fechado'),
    allowNull: false,
    defaultValue: 'aberto'
  },
  telefone: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  requisitos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  visualizacoes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  respostas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  favoritado: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Campos para controle de ciclo de vida
  dataConclusao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dataFechamento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dataReabertura: {
    type: DataTypes.DATE,
    allowNull: true
  },
  motivoFechamento: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'chamados',
  timestamps: true,
  createdAt: 'data',
  updatedAt: 'updatedAt'
});

module.exports = Chamado; 