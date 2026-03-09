// Script para verificar usuários com telefone
require('dotenv').config();
const { User } = require('./src/models');

async function checkUsersWithPhone() {
  try {
    const users = await User.findAll({
      where: {
        telefone: { [require('sequelize').Op.ne]: null }
      },
      attributes: ['id', 'nome', 'email', 'telefone']
    });
    
    console.log('Usuários com telefone cadastrado:');
    console.log('=====================================');
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado com telefone!');
      console.log('\nPara adicionar telefone a um usuário, execute:');
      console.log('UPDATE users SET telefone = "11987654321" WHERE email = "email@exemplo.com";');
    } else {
      users.forEach(user => {
        console.log(`✅ ID: ${user.id} | Nome: ${user.nome} | Email: ${user.email} | Telefone: ${user.telefone}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkUsersWithPhone();
