#!/usr/bin/env node

/**
 * Script para notificar todos os usuários sobre a ativação das notificações push
 * Uso: node scripts/notifyPushActivation.js [--dry-run]
 */

const { sequelize, User, Notificacao } = require('../src/models');

async function notifyPushActivation(dryRun = false) {
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
    console.log('\n👥 Usuários que receberão notificação:');
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

    console.log('\n📢 Criando notificações sobre ativação push...');
    
    // Criar notificações individualmente para evitar problemas com bulkCreate
    const createdNotifications = [];
    for (const user of allUsers) {
      try {
        const notification = await Notificacao.create({
          usuarioId: user.id,
          tipo: 'sistema',
          titulo: '🔔 Notificações Push Ativadas',
          mensagem: `Olá, ${user.nome}! As notificações push foram ativadas para sua conta. Agora você receberá alertas em tempo real sobre novas vagas, chamados, produtos e conexões diretamente no seu dispositivo.`,
          referenciaTipo: 'outro',
          referenciaId: 0,
          lida: false
        });
        createdNotifications.push(notification);
      } catch (err) {
        console.error(`❌ Erro ao criar notificação para usuário ${user.id}:`, err.message);
      }
    }

    console.log(`✅ ${createdNotifications.length} notificações criadas com sucesso!`);
    
    // Estatísticas finais
    const totalUsers = await User.count({ where: { suspended: false } });
    const totalNotifications = await Notificacao.count({
      where: { tipo: 'sistema', titulo: '🔔 Notificações Push Ativadas' }
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`Total de usuários ativos: ${totalUsers}`);
    console.log(`Notificações criadas nesta sessão: ${createdNotifications.length}`);
    console.log(`Total de notificações de ativação push: ${totalNotifications}`);

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

console.log('📢 Script para notificar usuários sobre ativação push');
console.log(`📝 Modo: ${isDryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);
console.log('=====================================\n');

notifyPushActivation(isDryRun);
