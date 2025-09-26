const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Denuncia = sequelize.define('Denuncia', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  autorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  referenciaTipo: {
    type: DataTypes.ENUM('empresa', 'candidato', 'vaga', 'mensagem', 'outro'),
    allowNull: false
  },
  referenciaId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  motivo: {
    type: DataTypes.ENUM('fraude', 'spam', 'assedio', 'conteudo_inadequado', 'outro'),
    allowNull: true
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [5, 5000]
    }
  },
  anexo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('aberta', 'em_analise', 'resolvida', 'arquivada'),
    allowNull: false,
    defaultValue: 'aberta'
  },
  prioridade: {
    type: DataTypes.ENUM('baixa', 'media', 'alta'),
    allowNull: true
  }
}, {
  tableName: 'denuncias',
  timestamps: true
});

module.exports = Denuncia;
