const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apoio = sequelize.define('Apoio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true },
  },
  mensagem: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 5000],
    },
  },
  status: {
    type: DataTypes.ENUM('pendente', 'em_atendimento', 'resolvido'),
    allowNull: false,
    defaultValue: 'pendente',
  },
}, {
  tableName: 'apoio',
  timestamps: true,
});

module.exports = Apoio;
