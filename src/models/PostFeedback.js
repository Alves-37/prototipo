const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostFeedback = sequelize.define('PostFeedback', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  interested: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
}, {
  tableName: 'post_feedback',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      unique: true,
      fields: ['postId', 'userId'],
    },
  ],
});

module.exports = PostFeedback;
