#!/usr/bin/env node

/**
 * Script para enviar notificação de agradecimento a todos os usuários
 * Uso: node scripts/sendThankYouNotification.js [--dry-run]
 */

const { sequelize, User, Notificacao } = require('../src/models');

async function sendThankYouNotification(dryRun = false) {
  try {
    console.log('🔧 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida com sucesso');

    console.log('\n📊 Buscando todos os usuários ativos...');
    
    // Buscar todos os usuários não suspensos
    const allUsers = await User.findAll({
      where: {
        suspended: false
      },
      attributes: ['id', 'nome', 'email', 'tipo'],
      order: [['id', 'ASC']]
    });

    console.log(`📋 Encontrados ${allUsers.length} usuários para notificar:`);
    
    if (allUsers.length === 0) {
      console.log('❌ Nenhum usuário ativo encontrado!');
      await sequelize.close();
      return;
    }

    // Mostrar detalhes dos usuários
    console.log('\n👥 Usuários que receberão notificação de agradecimento:');
    console.log('ID\t| Tipo\t\t| Nome\t\t\t\t| Email');
    console.log('---\t| ----\t\t| ----\t\t\t\t| ----');
    
    allUsers.forEach(user => {
      console.log(`${user.id}\t| ${user.tipo}\t\t| ${user.nome.padEnd(20)}\t| ${user.email}`);
    });

    if (dryRun) {
      console.log('\n🔍 MODO DRY RUN: Nenhuma notificação será criada');
      await sequelize.close();
      return;
    }

    console.log('\n📢 Enviando notificação de agradecimento...');
    
    // Criar notificações individualmente
    const createdNotifications = [];
    for (const user of allUsers) {
      try {
        // Mensagem personalizada baseada no tipo de usuário
        let mensagemPersonalizada = '';
        
        if (user.tipo === 'empresa') {
          mensagemPersonalizada = `Caros ${user.nome}, da parte de toda a equipe Neotrix Tecnologias, queremos expressar nossa profunda gratidão por confiarem em nossa plataforma. Como empresa, vocês são a espinha dorsal do ecossistema profissional que estamos construindo. Nosso propósito é conectar talentos excecionais a oportunidades extraordinárias, e sua parceria é fundamental para essa missão. Sob a liderança de nosso CEO & Fundador, Hélder Alves Fonseca, estamos comprometidos em revolucionar o mercado de trabalho em Moçambique e além. Continuaremos inovando para oferecer as melhores ferramentas de recrutamento e gestão de talentos. Juntos, estamos construindo o futuro do trabalho!`;
        } else {
          mensagemPersonalizada = `Prezado(a) ${user.nome}, em nome da Neotrix Tecnologias e nosso CEO & Fundador, Hélder Alves Fonseca, agradecemos imensamente por fazer parte da nossa comunidade. Sua presença enriquece nossa plataforma e nos inspira a criar soluções cada vez melhores. Nosso propósito é capacitar profissionais como você a alcançar seus sonhos e objetivos de carreira. Estamos construindo mais que uma plataforma - estamos criando um ecossistema onde talento encontra oportunidade, onde aspirações se transformam em realidade. Cada interação, cada aplicação, cada conexão feita através da Nevú nos aproxima desse objetivo. Conte sempre conosco para apoiar sua jornada profissional!`;
        }

        const notification = await Notificacao.create({
          usuarioId: user.id,
          tipo: 'sistema',
          titulo: '🙏 Agradecimento da Neotrix Tecnologias',
          mensagem: mensagemPersonalizada,
          referenciaTipo: 'outro',
          referenciaId: 0,
          lida: false
        });
        createdNotifications.push(notification);
        
        console.log(`✅ Notificação criada para ${user.nome} (${user.tipo})`);
      } catch (err) {
        console.error(`❌ Erro ao criar notificação para usuário ${user.id}:`, err.message);
      }
    }

    console.log(`\n🎉 ${createdNotifications.length} notificações de agradecimento criadas com sucesso!`);
    
    // Estatísticas finais
    const totalUsers = await User.count({ where: { suspended: false } });
    const empresasCount = await User.count({ where: { suspended: false, tipo: 'empresa' } });
    const usuariosCount = await User.count({ where: { suspended: false, tipo: 'usuario' } });
    const thankYouNotifications = await Notificacao.count({
      where: { tipo: 'sistema', titulo: '🙏 Agradecimento da Neotrix Tecnologias' }
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`Total de usuários ativos: ${totalUsers}`);
    console.log(`Empresas: ${empresasCount}`);
    console.log(`Candidatos: ${usuariosCount}`);
    console.log(`Notificações de agradecimento enviadas: ${thankYouNotifications}`);
    console.log('\n🚀 Mensagem da Neotrix Tecnologias compartilhada com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔚 Conexão com banco de dados fechada');
  }
}

// Verificar argumentos de linha de comando
const isDryRun = process.argv.includes('--dry-run');

console.log('🙏 Script para enviar notificação de agradecimento');
console.log(`📝 Modo: ${isDryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);
console.log('🏢 Por: Neotrix Tecnologias | CEO: Hélder Alves Fonseca');
console.log('=====================================\n');

sendThankYouNotification(isDryRun);
