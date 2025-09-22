const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mensagem = sequelize.define('Mensagem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  remetenteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  destinatarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  texto: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  tipo: {
    type: DataTypes.ENUM('texto', 'arquivo', 'imagem', 'sistema'),
    defaultValue: 'texto'
  },
  arquivo: {
    type: DataTypes.JSON,
    allowNull: true
  },
  lida: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  enviada: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  entregue: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  vagaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'vagas',
      key: 'id'
    }
  },
  conversaId: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'ID único da conversa entre dois usuários'
  }
}, {
  tableName: 'mensagens',
  timestamps: true,
  indexes: [
    {
      fields: ['conversaId']
    },
    {
      fields: ['remetenteId']
    },
    {
      fields: ['destinatarioId']
    },
    {
      fields: ['vagaId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Mensagem;