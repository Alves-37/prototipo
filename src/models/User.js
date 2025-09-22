const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nome: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  senha: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.ENUM('usuario', 'empresa'),
    allowNull: false,
  },
  
  // Campos de perfil para candidato
  telefone: DataTypes.STRING,
  endereco: DataTypes.STRING,
  bio: DataTypes.TEXT,
  experiencia: DataTypes.TEXT,
  formacao: DataTypes.TEXT,
  instituicao: DataTypes.STRING, // Campo adicionado
  resumo: DataTypes.TEXT, // Campo adicionado
  habilidades: DataTypes.TEXT, // pode ser JSON string
  curriculo: DataTypes.STRING, // path do arquivo
  dataNascimento: DataTypes.DATE,
  foto: DataTypes.TEXT, // Mudado para TEXT para suportar base64
  
  // Redes sociais para candidato
  linkedin: DataTypes.STRING,
  github: DataTypes.STRING,
  portfolio: DataTypes.STRING,
  behance: DataTypes.STRING,
  instagram: DataTypes.STRING,
  twitter: DataTypes.STRING,
  
  // Preferências de trabalho para candidato
  tipoTrabalho: {
    type: DataTypes.ENUM('remoto', 'presencial', 'hibrido'),
    defaultValue: 'remoto',
  },
  faixaSalarial: {
    type: DataTypes.ENUM('5000-10000', '10000-15000', '15000-25000', '25000-35000', '35000-50000', '50000+'),
    defaultValue: '15000-25000',
  },
  localizacaoPreferida: DataTypes.STRING,
  disponibilidade: {
    type: DataTypes.ENUM('imediata', '15dias', '30dias', '60dias'),
    defaultValue: 'imediata',
  },
  
  // Configurações de privacidade
  perfilPublico: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  mostrarTelefone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  mostrarEndereco: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  
  // Configurações de notificações
  alertasVagas: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  frequenciaAlertas: {
    type: DataTypes.ENUM('diario', 'semanal', 'quinzenal'),
    defaultValue: 'diario',
  },
  vagasInteresse: DataTypes.TEXT, // JSON string
  
  // Campos complexos (JSON)
  idiomas: DataTypes.TEXT, // JSON string
  certificacoes: DataTypes.TEXT, // JSON string
  projetos: DataTypes.TEXT, // JSON string
  
  // Campos para empresa
  plano: {
    type: DataTypes.ENUM('gratuito', 'basico', 'premium', 'empresarial'),
    defaultValue: 'gratuito',
  },
  statusAssinatura: {
    type: DataTypes.ENUM('ativa', 'inativa', 'expirada'),
    defaultValue: 'ativa',
  },
  
  // Campos específicos para empresa
  logo: DataTypes.TEXT, // Mudado para TEXT para suportar base64
  descricao: DataTypes.TEXT,
  setor: DataTypes.STRING,
  tamanho: DataTypes.STRING,
  website: DataTypes.STRING,
  razaoSocial: DataTypes.STRING,
  nuit: DataTypes.STRING,
  alvara: DataTypes.STRING,
  registroComercial: DataTypes.STRING,
  inscricaoFiscal: DataTypes.STRING,
  anoFundacao: DataTypes.INTEGER,
  capitalSocial: DataTypes.DECIMAL(15, 2),
  moedaCapital: DataTypes.STRING,
  
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

module.exports = User; 