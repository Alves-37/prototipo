const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProdutoReaction = sequelize.define('ProdutoReaction', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  produtoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: 'uniq_produto_reaction_user',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: 'uniq_produto_reaction_user',
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'like',
  },
}, {
  tableName: 'produto_reactions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = ProdutoReaction;
