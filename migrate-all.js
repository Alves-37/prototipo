const { sequelize } = require('./src/models');

async function migrateAll() {
  try {
    console.log('🔄 Iniciando migração completa...');
    
    // Migrar tabela chamados
    console.log('\n📋 Migrando tabela chamados...');
    const chamadosInfo = await sequelize.query(
      "PRAGMA table_info(chamados)",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const chamadosColumns = chamadosInfo.map(col => col.name);
    console.log('Colunas existentes em chamados:', chamadosColumns);
    
    // Novas colunas para chamados
    const newChamadosColumns = [
      { name: 'dataConclusao', type: 'DATETIME' },
      { name: 'dataFechamento', type: 'DATETIME' },
      { name: 'dataReabertura', type: 'DATETIME' },
      { name: 'motivoFechamento', type: 'TEXT' }
    ];
    
    for (const column of newChamadosColumns) {
      if (!chamadosColumns.includes(column.name)) {
        console.log(`📝 Adicionando coluna em chamados: ${column.name}`);
        await sequelize.query(`
          ALTER TABLE chamados 
          ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`✅ Coluna ${column.name} adicionada!`);
      } else {
        console.log(`ℹ️ Coluna ${column.name} já existe em chamados`);
      }
    }
    
    // Migrar tabela respostas_chamados
    console.log('\n📋 Migrando tabela respostas_chamados...');
    const respostasInfo = await sequelize.query(
      "PRAGMA table_info(respostas_chamados)",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    const respostasColumns = respostasInfo.map(col => col.name);
    console.log('Colunas existentes em respostas_chamados:', respostasColumns);
    
    // Novas colunas para respostas
    const newRespostasColumns = [
      { name: 'avaliacaoCliente', type: 'INTEGER' },
      { name: 'comentarioCliente', type: 'TEXT' },
      { name: 'dataAvaliacao', type: 'DATETIME' }
    ];
    
    for (const column of newRespostasColumns) {
      if (!respostasColumns.includes(column.name)) {
        console.log(`📝 Adicionando coluna em respostas_chamados: ${column.name}`);
        await sequelize.query(`
          ALTER TABLE respostas_chamados 
          ADD COLUMN ${column.name} ${column.type}
        `);
        console.log(`✅ Coluna ${column.name} adicionada!`);
      } else {
        console.log(`ℹ️ Coluna ${column.name} já existe em respostas_chamados`);
      }
    }
    
    console.log('\n✅ Migração completa concluída!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar migração
migrateAll(); 