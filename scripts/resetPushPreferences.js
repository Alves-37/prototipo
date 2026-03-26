#!/usr/bin/env node

/**
 * Script para resetar preferências de notificação push
 * Uso: node scripts/resetPushPreferences.js [--all] [--dry-run]
 * --all: Resetar TODOS os usuários (inclusive os que já têm push ativado)
 * --dry-run: Apenas simula, não executa alterações
 */

const { sequelize, User } = require('../src/models');

async function resetPushPreferences(resetAll = false, dryRun = false) {
  try {
    console.log('🔧 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conexão estabelecida com sucesso');

    console.log('\n📊 Buscando usuários...');
    
    // Definir condição where baseada no parâmetro --all
    const whereCondition = resetAll ? {} : {
      [sequelize.Sequelize.Op.or]: [
        { pushEnabled: true },
        { pushPromptAnsweredAt: { [sequelize.Sequelize.Op.ne]: null } }
      ]
    };

    const usersToReset = await User.findAll({
      where: whereCondition,
      attributes: ['id', 'nome', 'email', 'tipo', 'pushEnabled', 'pushPromptAnsweredAt'],
      order: [['id', 'ASC']]
    });

    console.log(`📋 Encontrados ${usersToReset.length} usuários para resetar:`);
    
    if (usersToReset.length === 0) {
      console.log('✅ Nenhum usuário encontrado para resetar!');
      await sequelize.close();
      return;
    }

    // Mostrar detalhes dos usuários
    console.log('\n👥 Usuários que serão resetados:');
    console.log('ID\t| Tipo\t\t| Nome\t\t\t\t| Email\t\t\t\t| Push Atual\t| Prompt At');
    console.log('---\t| ----\t\t| ----\t\t\t\t| ----\t\t\t\t| ---------\t| ---------');
    
    usersToReset.forEach(user => {
      const pushStatus = user.pushEnabled === null ? 'null' : user.pushEnabled ? 'true' : 'false';
      const promptStatus = user.pushPromptAnsweredAt ? 'sim' : 'não';
      console.log(`${user.id}\t| ${user.tipo}\t\t| ${user.nome.padEnd(20)}\t| ${user.email.padEnd(30)}\t| ${pushStatus}\t\t| ${promptStatus}`);
    });

    if (dryRun) {
      console.log('\n🔍 MODO DRY RUN: Nenhuma alteração será realizada');
      await sequelize.close();
      return;
    }

    console.log('\n🔄 Resetando preferências de notificação...');
    
    // Resetar preferências
    const updateResult = await User.update(
      {
        pushEnabled: null,
        pushPromptAnsweredAt: null
      },
      {
        where: whereCondition
      }
    );

    console.log(`✅ Preferências resetadas para ${updateResult[0]} usuários!`);
    
    // Estatísticas finais
    const totalUsers = await User.count();
    const nullPushUsers = await User.count({
      where: { pushEnabled: null }
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`Total de usuários: ${totalUsers}`);
    console.log(`Com preferências nulas: ${nullPushUsers}`);
    console.log(`Taxa de reset: ${((nullPushUsers / totalUsers) * 100).toFixed(2)}%`);

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
const resetAll = process.argv.includes('--all');

console.log('🔄 Script para resetar preferências de notificação push');
console.log(`📝 Modo: ${isDryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);
console.log(`🎯 Alvo: ${resetAll ? 'TODOS os usuários' : 'Apenas usuários com preferências existentes'}`);
console.log('=====================================\n');

resetPushPreferences(resetAll, isDryRun);
