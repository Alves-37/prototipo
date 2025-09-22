const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vaga = sequelize.define('Vaga', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  titulo: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  requisitos: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  beneficios: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  salario: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  localizacao: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tipoContrato: {
    type: DataTypes.ENUM('Efetivo', 'Prestador', 'Freelancer', 'Estagio'),
    defaultValue: 'Efetivo',
  },
  nivelExperiencia: {
    type: DataTypes.ENUM('JUNIOR', 'PLENO', 'SENIOR', 'ESPECIALISTA'),
    defaultValue: 'JUNIOR',
  },
  modalidade: {
    type: DataTypes.ENUM('PRESENCIAL', 'REMOTO', 'HIBRIDO'),
    defaultValue: 'PRESENCIAL',
  },
  area: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('publicada', 'fechada', 'expirada', 'rascunho'),
    defaultValue: 'publicada',
  },
  premium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  dataPublicacao: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  dataExpiracao: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  empresaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  visualizacoes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Capacidade de candidatos para a vaga
  capacidadeVagas: {
    type: DataTypes.INTEGER,
    allowNull: true, // Permitir null temporariamente para dados existentes
    defaultValue: 1,
    validate: {
      min: 1,
      max: 100
    }
  },
  // Status da capacidade (aberta, fechada, parcial)
  statusCapacidade: {
    type: DataTypes.STRING, // Usar STRING em vez de ENUM para compatibilidade
    defaultValue: 'aberta',
    allowNull: true // Permitir null temporariamente para dados existentes
  },
}, {
  tableName: 'vagas',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = Vaga; 