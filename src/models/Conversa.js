const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Conversa = sequelize.define('Conversa', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversaId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'ID único da conversa (formato: userId1_userId2 ou userId1_userId2_vagaId)'
  },
  usuario1Id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  usuario2Id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  vagaId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ultimaMensagem: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ultimaMensagemData: {
    type: DataTypes.DATE,
    allowNull: true
  },
  mensagensNaoLidas1: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens não lidas pelo usuário 1'
  },
  mensagensNaoLidas2: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Mensagens não lidas pelo usuário 2'
  },
  ativa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  silenciada1: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Conversa silenciada pelo usuário 1'
  },
  silenciada2: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Conversa silenciada pelo usuário 2'
  },
  bloqueada1: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Usuário 2 bloqueado pelo usuário 1'
  },
  bloqueada2: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Usuário 1 bloqueado pelo usuário 2'
  }
}, {
  tableName: 'conversas',
  timestamps: true,
  indexes: [
    {
      fields: ['usuario1Id']
    },
    {
      fields: ['usuario2Id']
    },
    {
      fields: ['vagaId']
    },
    {
      fields: ['ultimaMensagemData']
    }
  ]
});

module.exports = Conversa;