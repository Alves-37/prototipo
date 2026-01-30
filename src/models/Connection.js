const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Connection = sequelize.define('Connection', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  addresseeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'canceled'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'connections',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      unique: true,
      fields: ['requesterId', 'addresseeId'],
    },
  ],
});

module.exports = Connection;
