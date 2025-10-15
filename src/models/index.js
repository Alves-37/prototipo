const sequelize = require('../config/database');

// Carrega e registra models (efeito colateral do require define no sequelize)
require('./User');
require('./Vaga');
require('./Candidatura');
require('./Chamado');
require('./RespostaChamado');
require('./Mensagem');
require('./Conversa');
require('./Notificacao');
require('./Denuncia');
require('./Admin');
require('./Apoio');
require('./PushSubscription');

// Recupera instâncias a partir do registry do Sequelize
const { User, Vaga, Candidatura, Chamado, RespostaChamado, Mensagem, Conversa, Notificacao, Denuncia, Admin, Apoio, PushSubscription } = sequelize.models;

if (!User || !Vaga) {
  console.error('[Models] Registry incompleto. Disponíveis:', Object.keys(sequelize.models || {}));
}

// Associação: Uma empresa (User) tem muitas Vagas
User.hasMany(Vaga, { foreignKey: 'empresaId', as: 'vagas' });
Vaga.belongsTo(User, { foreignKey: 'empresaId', as: 'empresa' });

// Associações de candidatura
Vaga.hasMany(Candidatura, { foreignKey: 'vagaId', as: 'candidaturas' });
Candidatura.belongsTo(Vaga, { foreignKey: 'vagaId', as: 'vaga' });
User.hasMany(Candidatura, { foreignKey: 'usuarioId', as: 'candidaturasUsuario' }); // nome diferente para evitar conflito
Candidatura.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Associações de chamados
User.hasMany(Chamado, { foreignKey: 'usuarioId', as: 'chamados' });
Chamado.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Associações de respostas de chamados
Chamado.hasMany(RespostaChamado, { foreignKey: 'chamadoId', as: 'respostasList' });
RespostaChamado.belongsTo(Chamado, { foreignKey: 'chamadoId', as: 'chamado' });
User.hasMany(RespostaChamado, { foreignKey: 'usuarioId', as: 'respostasChamados' });
RespostaChamado.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Associações de mensagens
User.hasMany(Mensagem, { foreignKey: 'remetenteId', as: 'mensagensEnviadas' });
User.hasMany(Mensagem, { foreignKey: 'destinatarioId', as: 'mensagensRecebidas' });
Mensagem.belongsTo(User, { foreignKey: 'remetenteId', as: 'remetente' });
Mensagem.belongsTo(User, { foreignKey: 'destinatarioId', as: 'destinatario' });

// Associações de conversas
User.hasMany(Conversa, { foreignKey: 'usuario1Id', as: 'conversasComoUsuario1' });
User.hasMany(Conversa, { foreignKey: 'usuario2Id', as: 'conversasComoUsuario2' });
Conversa.belongsTo(User, { foreignKey: 'usuario1Id', as: 'usuario1' });
Conversa.belongsTo(User, { foreignKey: 'usuario2Id', as: 'usuario2' });
Conversa.belongsTo(Vaga, { foreignKey: 'vagaId', as: 'vaga' });

// Associações de mensagens com conversas
Conversa.hasMany(Mensagem, { foreignKey: 'conversaId', sourceKey: 'conversaId', as: 'mensagens' });
Mensagem.belongsTo(Conversa, { foreignKey: 'conversaId', targetKey: 'conversaId', as: 'conversa' });

// Associações de notificações
User.hasMany(Notificacao, { foreignKey: 'usuarioId', as: 'notificacoes' });
Notificacao.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Associações de denúncias (autor -> users.id)
User.hasMany(Denuncia, { foreignKey: 'autorId', as: 'denuncias' });
Denuncia.belongsTo(User, { foreignKey: 'autorId', as: 'autor' });

// Associações de apoio (opcionalmente vinculadas a um usuário)
User.hasMany(Apoio, { foreignKey: 'usuarioId', as: 'apoios' });
Apoio.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Associações de push subscriptions
User.hasMany(PushSubscription, { foreignKey: 'usuarioId', as: 'pushSubscriptions' });
PushSubscription.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

const syncDb = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.log('NODE_ENV=production -> Executando sequelize.sync() SEM alter/force');
      await sequelize.sync();
      console.log('Banco de dados sincronizado (produção, sem alterações destrutivas)');
      return;
    }

    console.log('Sincronizando banco de dados (alter=true)...');
    await sequelize.sync({ alter: true });
    console.log('Banco de dados sincronizado com alterações!');
  } catch (alterError) {
    console.warn('Erro na sincronização com alterações:', alterError.message);
    console.log('Tentando sincronização sem alterações...');
    try {
      await sequelize.sync();
      console.log('Banco de dados sincronizado (sem alterações)!');
    } catch (syncError) {
      console.warn('Erro na sincronização sem alterações:', syncError.message);
      if (process.env.NODE_ENV === 'production') {
        console.error('Produção: não será executado force=true. Abortando para proteger dados.');
        process.exit(1);
      }
      console.log('Última tentativa (dev): reset completo do banco (force=true)...');
      try {
        await sequelize.sync({ force: true });
        console.log('Banco de dados resetado com sucesso!');
      } catch (forceError) {
      }
    }
  }
};

module.exports = { sequelize, User, Vaga, Candidatura, Chamado, RespostaChamado, Mensagem, Conversa, Notificacao, Denuncia, Admin, Apoio, PushSubscription, syncDb };