const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RespostaChamado = sequelize.define('RespostaChamado', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  chamadoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'chamados',
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
  resposta: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [5, 2000]
    }
  },
  tipo: {
    type: DataTypes.ENUM('resposta', 'proposta', 'duvida'),
    allowNull: false,
    defaultValue: 'resposta'
  },
  orcamento: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  prazo: {
    type: DataTypes.DATE,
    allowNull: true
  },
  aceita: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  visualizada: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  // Campos para avaliação
  avaliacaoCliente: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5
    }
  },
  comentarioCliente: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dataAvaliacao: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'respostas_chamados',
  timestamps: true,
  createdAt: 'data',
  updatedAt: 'updatedAt'
});

module.exports = RespostaChamado; 