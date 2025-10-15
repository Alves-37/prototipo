const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true
    },
    keys: {
      type: DataTypes.JSON,
      allowNull: false
    },
    expirationTime: {
      type: DataTypes.DATE,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
}, {
  tableName: 'push_subscriptions',
  timestamps: true
});

module.exports = PushSubscription;
