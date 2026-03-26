#!/usr/bin/env node

/**
 * Script para ativar notificações push E depois notificar todos os usuários
 * Ordem correta: 1) Ativa push → 2) Envia notificação
 * Uso: node scripts/activateAndNotify.js [--dry-run]
 */

const { sequelize, User, Notificacao } = require('../src/models');

async function activateAndNotify(dryRun = false) {
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
      attributes: ['id', 'nome', 'email', 'tipo', 'pushEnabled', 'pushPromptAnsweredAt'],
      order: [['id', 'ASC']]
    });

    console.log(`📋 Encontrados ${allUsers.length} usuários ativos`);
    
    if (allUsers.length === 0) {
      console.log('❌ Nenhum usuário ativo encontrado!');
      await sequelize.close();
      return;
    }

    // Mostrar usuários
    console.log('\n👥 Usuários que serão processados:');
    console.log('ID\t| Tipo\t\t| Nome\t\t\t\t| Push Atual');
    console.log('---\t| ----\t\t| ----\t\t\t\t| ---------');
    
    allUsers.forEach(user => {
      const pushStatus = user.pushEnabled === null ? 'null' : user.pushEnabled ? 'true' : 'false';
      console.log(`${user.id}\t| ${user.tipo}\t\t| ${user.nome.padEnd(20)}\t| ${pushStatus}`);
    });

    if (dryRun) {
      console.log('\n🔍 MODO DRY RUN: Nenhuma alteração será realizada');
      await sequelize.close();
      return;
    }

    // ETAPA 1: ATIVAR NOTIFICAÇÕES PUSH
    console.log('\n🚀 ETAPA 1: Ativando notificações push...');
    
    const usersToActivate = allUsers.filter(user => 
      user.pushEnabled === null || 
      user.pushEnabled === false || 
      user.pushPromptAnsweredAt === null
    );

    console.log(`📝 ${usersToActivate.length} usuários precisam ativar push`);

    if (usersToActivate.length > 0) {
      const updateResult = await User.update(
        {
          pushEnabled: true,
          pushPromptAnsweredAt: new Date()
        },
        {
          where: {
            id: usersToActivate.map(u => u.id)
          }
        }
      );
      console.log(`✅ Push ativado para ${updateResult[0]} usuários!`);
    } else {
      console.log('✅ Todos os usuários já têm push ativado!');
    }

    // ETAPA 2: ENVIAR NOTIFICAÇÃO
    console.log('\n📢 ETAPA 2: Enviando notificações sobre ativação...');
    
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
    const activePushUsers = await User.count({ 
      where: { suspended: false, pushEnabled: true } 
    });
    const totalNotifications = await Notificacao.count({
      where: { tipo: 'sistema', titulo: '🔔 Notificações Push Ativadas' }
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`Total de usuários ativos: ${totalUsers}`);
    console.log(`Com push ativado: ${activePushUsers}`);
    console.log(`Taxa de ativação: ${((activePushUsers / totalUsers) * 100).toFixed(2)}%`);
    console.log(`Notificações de ativação: ${totalNotifications}`);

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

console.log('🎯 Script para ATIVAR PUSH e NOTIFICAR usuários');
console.log(`📝 Modo: ${isDryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);
console.log('🔄 Ordem: 1) Ativa Push → 2) Envia Notificação');
console.log('=====================================\n');

activateAndNotify(isDryRun);
