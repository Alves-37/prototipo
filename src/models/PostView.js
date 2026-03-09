const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PostView = sequelize.define('PostView', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  viewerUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  viewerIp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'post_views',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    { fields: ['postId'] },
    { fields: ['viewerUserId'] },
  ],
});

module.exports = PostView;
