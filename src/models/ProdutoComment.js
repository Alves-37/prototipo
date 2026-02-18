const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProdutoComment = sequelize.define('ProdutoComment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  produtoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  texto: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  anexoUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  anexoTipo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'produto_comments',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = ProdutoComment;
