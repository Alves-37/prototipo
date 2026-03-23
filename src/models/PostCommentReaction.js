const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostCommentReaction = sequelize.define('PostCommentReaction', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  commentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'like',
  },
}, {
  tableName: 'post_comment_reactions',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      unique: true,
      fields: ['commentId', 'userId'],
    },
  ],
});

module.exports = PostCommentReaction;
