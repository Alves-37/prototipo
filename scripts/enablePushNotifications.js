#!/usr/bin/env node

/**
 * Script para ativar notificações push para todos os usuários cadastrados
 * Uso: node scripts/enablePushNotifications.js [--dry-run]
 * --dry-run: Apenas mostra quantos usuários serão atualizados, sem executar
 */

const { sequelize, User } = require('../src/models');

async function enablePushNotifications(dryRun = false) {
  try {
    console.log('🔧 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida com sucesso');

    console.log('\n📊 Buscando usuários...');
    
    // Buscar todos os usuários que não têm notificações push ativadas
    const usersToUpdate = await User.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { pushEnabled: null },
          { pushEnabled: false },
          { pushPromptAnsweredAt: null }
        ]
      },
      attributes: ['id', 'nome', 'email', 'tipo', 'pushEnabled', 'pushPromptAnsweredAt'],
      order: [['id', 'ASC']]
    });

    console.log(`📋 Encontrados ${usersToUpdate.length} usuários para atualizar:`);
    
    if (usersToUpdate.length === 0) {
      console.log('✅ Todos os usuários já têm notificações push ativadas!');
      await sequelize.close();
      return;
    }

    // Mostrar detalhes dos usuários
    console.log('\n👥 Usuários que serão atualizados:');
    console.log('ID\t| Tipo\t\t| Nome\t\t\t\t| Email\t\t\t\t| Push Atual');
    console.log('---\t| ----\t\t| ----\t\t\t\t| ----\t\t\t\t| ---------');
    
    usersToUpdate.forEach(user => {
      const pushStatus = user.pushEnabled === null ? 'null' : user.pushEnabled ? 'true' : 'false';
      console.log(`${user.id}\t| ${user.tipo}\t\t| ${user.nome.padEnd(20)}\t| ${user.email.padEnd(30)}\t| ${pushStatus}`);
    });

    if (dryRun) {
      console.log('\n🔍 MODO DRY RUN: Nenhuma alteração será realizada');
      await sequelize.close();
      return;
    }

    console.log('\n🚀 Ativando notificações push...');
    
    // Atualizar todos os usuários
    const updateResult = await User.update(
      {
        pushEnabled: true,
        pushPromptAnsweredAt: new Date()
      },
      {
        where: {
          [sequelize.Sequelize.Op.or]: [
            { pushEnabled: null },
            { pushEnabled: false },
            { pushPromptAnsweredAt: null }
          ]
        }
      }
    );

    console.log(`✅ Notificações push ativadas para ${updateResult[0]} usuários!`);
    
    // Estatísticas finais
    const totalUsers = await User.count();
    const activePushUsers = await User.count({
      where: { pushEnabled: true }
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`Total de usuários: ${totalUsers}`);
    console.log(`Com push ativado: ${activePushUsers}`);
    console.log(`Sem push ativado: ${totalUsers - activePushUsers}`);
    console.log(`Taxa de ativação: ${((activePushUsers / totalUsers) * 100).toFixed(2)}%`);

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

console.log('🎯 Script para ativar notificações push em massa');
console.log(`📝 Modo: ${isDryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);
console.log('=====================================\n');

enablePushNotifications(isDryRun);
