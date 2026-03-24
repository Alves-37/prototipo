const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  postType: {
    type: DataTypes.ENUM('normal', 'servico'),
    allowNull: false,
    defaultValue: 'normal',
  },
  texto: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  imagens: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  servicePrice: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serviceCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serviceLocation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serviceWhatsapp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ctaText: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ctaUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isHidden: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  hiddenReason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'posts',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = Post;
