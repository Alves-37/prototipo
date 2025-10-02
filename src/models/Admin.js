const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nome: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(180),
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  senhaHash: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'admin',
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'admins',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['email'] },
  ],
});

module.exports = Admin;
