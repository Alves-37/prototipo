/*
  Seed de administrador para o painel Dashboard
  Uso:
    node scripts/seed-admin.js
*/

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Admin } = require('../src/models');

const ADMIN_NOME = 'Hélder Alves';
const ADMIN_EMAIL = 'helderfonseca472@gmail.com';
const ADMIN_SENHA = '@AlvesAmelia37';

(async () => {
  try {
    console.log('Conectando e sincronizando modelos (admins)...');
    await sequelize.authenticate();
    // Garantir tabela criada sem destruir dados
    await sequelize.sync();

    const existente = await Admin.findOne({ where: { email: ADMIN_EMAIL } });
    if (existente) {
      console.log(`Admin já existe: ${existente.email} (id=${existente.id})`);
      process.exit(0);
    }

    const senhaHash = await bcrypt.hash(ADMIN_SENHA, 10);
    const novo = await Admin.create({
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senhaHash,
      role: 'admin',
      ativo: true,
    });

    console.log('Admin criado com sucesso:');
    console.log({ id: novo.id, nome: novo.nome, email: novo.email, role: novo.role, ativo: novo.ativo });
  } catch (err) {
    console.error('Erro no seed de admin:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
