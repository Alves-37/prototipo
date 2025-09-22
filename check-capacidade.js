const { sequelize } = require('./src/models');

async function checkCapacidade() {
  try {
    console.log('🔍 Verificando dados de capacidade...');
    
    // Verificar vagas sem capacidade definida
    const vagasSemCapacidade = await sequelize.query(`
      SELECT id, titulo, capacidadeVagas, statusCapacidade 
      FROM vagas 
      WHERE capacidadeVagas IS NULL OR statusCapacidade IS NULL
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📊 Vagas sem capacidade definida: ${vagasSemCapacidade.length}`);
    
    if (vagasSemCapacidade.length > 0) {
      console.log('\nVagas que precisam ser corrigidas:');
      vagasSemCapacidade.forEach(vaga => {
        console.log(`- ID ${vaga.id}: ${vaga.titulo} (capacidade: ${vaga.capacidadeVagas}, status: ${vaga.statusCapacidade})`);
      });
      
      // Corrigir dados
      console.log('\n🔄 Corrigindo dados...');
      await sequelize.query(`
        UPDATE vagas 
        SET capacidadeVagas = 1, statusCapacidade = 'aberta' 
        WHERE capacidadeVagas IS NULL OR statusCapacidade IS NULL
      `);
      console.log('✅ Dados corrigidos!');
    } else {
      console.log('✅ Todas as vagas têm capacidade definida corretamente');
    }
    
    // Verificar valores inválidos
    const vagasInvalidas = await sequelize.query(`
      SELECT id, titulo, capacidadeVagas, statusCapacidade 
      FROM vagas 
      WHERE capacidadeVagas < 1 OR capacidadeVagas > 100
      OR statusCapacidade NOT IN ('aberta', 'fechada', 'parcial')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📊 Vagas com valores inválidos: ${vagasInvalidas.length}`);
    
    if (vagasInvalidas.length > 0) {
      console.log('\nVagas com valores inválidos:');
      vagasInvalidas.forEach(vaga => {
        console.log(`- ID ${vaga.id}: ${vaga.titulo} (capacidade: ${vaga.capacidadeVagas}, status: ${vaga.statusCapacidade})`);
      });
      
      // Corrigir valores inválidos
      console.log('\n🔄 Corrigindo valores inválidos...');
      await sequelize.query(`
        UPDATE vagas 
        SET capacidadeVagas = 1 
        WHERE capacidadeVagas < 1 OR capacidadeVagas > 100
      `);
      
      await sequelize.query(`
        UPDATE vagas 
        SET statusCapacidade = 'aberta' 
        WHERE statusCapacidade NOT IN ('aberta', 'fechada', 'parcial')
      `);
      console.log('✅ Valores inválidos corrigidos!');
    } else {
      console.log('✅ Todas as vagas têm valores válidos');
    }
    
    // Resumo final
    const totalVagas = await sequelize.query(`
      SELECT COUNT(*) as total FROM vagas
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📈 Resumo:`);
    console.log(`- Total de vagas: ${totalVagas[0].total}`);
    console.log(`- Vagas corrigidas: ${vagasSemCapacidade.length + vagasInvalidas.length}`);
    console.log(`- Status: ✅ Sistema pronto para uso`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar capacidade:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
checkCapacidade(); 