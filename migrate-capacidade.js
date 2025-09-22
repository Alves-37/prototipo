const { sequelize } = require('./src/models');

async function migrateCapacidade() {
  try {
    console.log('🔄 Iniciando migração de capacidade de vagas...');
    
    // Verificar se as colunas já existem
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(vagas)",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const existingColumns = tableInfo.map(col => col.name);
    console.log('Colunas existentes em vagas:', existingColumns);
    
    // Adicionar coluna capacidadeVagas se não existir
    if (!existingColumns.includes('capacidadeVagas')) {
      console.log('📝 Adicionando coluna capacidadeVagas...');
      await sequelize.query(`
        ALTER TABLE vagas 
        ADD COLUMN capacidadeVagas INTEGER DEFAULT 1
      `);
      console.log('✅ Coluna capacidadeVagas adicionada!');
    } else {
      console.log('ℹ️ Coluna capacidadeVagas já existe');
    }
    
    // Adicionar coluna statusCapacidade se não existir
    if (!existingColumns.includes('statusCapacidade')) {
      console.log('📝 Adicionando coluna statusCapacidade...');
      await sequelize.query(`
        ALTER TABLE vagas 
        ADD COLUMN statusCapacidade TEXT DEFAULT 'aberta'
      `);
      console.log('✅ Coluna statusCapacidade adicionada!');
    } else {
      console.log('ℹ️ Coluna statusCapacidade já existe');
    }
    
    // Atualizar vagas existentes para ter capacidade padrão
    console.log('🔄 Atualizando vagas existentes...');
    
    // Primeiro, verificar se há vagas sem os novos campos
    const vagasParaAtualizar = await sequelize.query(`
      SELECT COUNT(*) as total FROM vagas 
      WHERE capacidadeVagas IS NULL OR statusCapacidade IS NULL
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`Vagas que precisam ser atualizadas: ${vagasParaAtualizar[0].total}`);
    
    if (vagasParaAtualizar[0].total > 0) {
      await sequelize.query(`
        UPDATE vagas 
        SET capacidadeVagas = 1, statusCapacidade = 'aberta' 
        WHERE capacidadeVagas IS NULL OR statusCapacidade IS NULL
      `);
      console.log('✅ Vagas existentes atualizadas!');
    } else {
      console.log('ℹ️ Todas as vagas já estão atualizadas');
    }
    
    console.log('\n✅ Migração de capacidade concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar migração
migrateCapacidade(); 