// Script para resetar o banco de dados com backup automático
const { syncDb } = require('./src/models');
const fs = require('fs');
const path = require('path');

async function resetDatabase() {
  console.log('⚠️  ATENÇÃO: Isso vai apagar todos os dados do banco!');
  console.log('Pressione Ctrl+C para cancelar ou aguarde 5 segundos...');

  setTimeout(async () => {
    try {
      // Fazer backup antes de resetar
      console.log('📦 Fazendo backup do banco atual...');
      const dbPath = './nevu.sqlite';
      const backupPath = `./backup/nevu_backup_before_reset_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
      
      // Criar pasta de backup se não existir
      const backupDir = './backup';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`✅ Backup criado: ${backupPath}`);
      }
      
      console.log('🔄 Resetando banco de dados...');
      await syncDb();
      console.log('✅ Banco de dados resetado com sucesso!');
      console.log('💡 Backup salvo em:', backupPath);
      process.exit(0);
    } catch (error) {
      console.error('❌ Erro ao resetar banco:', error);
      process.exit(1);
    }
  }, 5000);
}

resetDatabase(); 