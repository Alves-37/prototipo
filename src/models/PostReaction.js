const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostReaction = sequelize.define('PostReaction', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: 'uniq_post_reaction_user',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: 'uniq_post_reaction_user',
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'like',
  },
}, {
  tableName: 'post_reactions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = PostReaction;
