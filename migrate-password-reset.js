const { sequelize } = require('./src/config/database');
const PasswordResetToken = require('./src/models/PasswordResetToken');

async function migratePasswordReset() {
  try {
    console.log('Iniciando migração de PasswordResetToken...');
    
    // Sincroniza apenas a tabela PasswordResetToken
    await PasswordResetToken.sync({ alter: true });
    
    console.log('Tabela password_reset_tokens criada/atualizada com sucesso!');
    
    // Limpa tokens expirados
    const deletedCount = await PasswordResetToken.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: new Date(),
        },
      },
    });
    
    if (deletedCount > 0) {
      console.log(`Limpos ${deletedCount} tokens expirados.`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migratePasswordReset();
}

module.exports = migratePasswordReset;
