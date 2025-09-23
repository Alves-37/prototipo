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
    comment: 'Destinatário da notificação'
  },
  tipo: {
    type: DataTypes.ENUM('vaga_publicada', 'chamado_publicado', 'candidatura_fase', 'sistema'),
    defaultValue: 'sistema',
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  referenciaTipo: {
    type: DataTypes.ENUM('vaga', 'chamado', 'candidatura', 'outro'),
    allowNull: true,
  },
  referenciaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  lida: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: 'notificacoes',
  timestamps: true,
  indexes: [
    { fields: ['usuarioId'] },
    { fields: ['lida'] },
    { fields: ['createdAt'] },
  ]
});

module.exports = Notificacao;
