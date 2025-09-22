const sequelize = require('./src/config/database');
const Candidatura = require('./src/models/Candidatura');

async function migrate() {
  try {
    console.log('Iniciando migração...');
    
    // Sincronizar modelo Candidatura
    await Candidatura.sync({ alter: true });
    console.log('Modelo Candidatura sincronizado com sucesso!');
    
    console.log('Migração concluída!');
    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

migrate(); 