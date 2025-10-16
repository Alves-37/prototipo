const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  p256dh: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  auth: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  expirationTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'push_subscriptions',
  timestamps: true,
});

module.exports = PushSubscription;
