const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Produto = sequelize.define('Produto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  empresaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 255],
    },
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  preco: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  precoSobConsulta: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  tipoVenda: {
    type: DataTypes.ENUM('estoque', 'sob_encomenda'),
    allowNull: false,
    defaultValue: 'estoque',
  },
  estoqueQtd: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  tempoPreparoDias: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  categoria: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  imagens: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  entregaDisponivel: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  retiradaDisponivel: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  zonaEntrega: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  custoEntrega: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  localRetirada: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  ativo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'produtos',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = Produto;
