const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notificacao = sequelize.define('Notificacao', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM('vaga_nova', 'chamado_novo', 'candidatura_fase', 'geral'),
    allowNull: false,
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  dados: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  lida: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'notificacoes',
  timestamps: true,
  indexes: [
    { fields: ['usuarioId'] },
    { fields: ['lida'] },
    { fields: ['createdAt'] },
  ],
});

module.exports = Notificacao;
