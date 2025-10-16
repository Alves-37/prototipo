#!/usr/bin/env node
/*
  Lista usuários desativados (suspended = true) do banco PostgreSQL.
  Uso:
    node scripts/list-deactivated-users.js

  Requisitos:
    - Variável de ambiente DATABASE_PUBLIC_URL ou DATABASE_URL configurada
    - Dependências do projeto instaladas
*/

require('dotenv').config();

const { sequelize, User } = require('../src/models');

(async () => {
  try {
    // Testa conexão
    await sequelize.authenticate();

    const users = await User.findAll({
      where: { suspended: true },
      attributes: [
        'id',
        'nome',
        'email',
        'tipo',
        'suspended',
        'suspendedUntil',
        'deletionRequestedAt',
        'createdAt',
        'updatedAt',
      ],
      order: [['updatedAt', 'DESC']],
    });

    if (!users.length) {
      console.log('Nenhum usuário desativado encontrado.');
      process.exit(0);
    }

    // Saída amigável em tabela simples
    const rows = users.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      tipo: u.tipo,
      suspended: !!u.suspended,
      suspendedUntil: u.suspendedUntil ? new Date(u.suspendedUntil).toISOString() : null,
      deletionRequestedAt: u.deletionRequestedAt ? new Date(u.deletionRequestedAt).toISOString() : null,
      updatedAt: new Date(u.updatedAt).toISOString(),
    }));

    // Detecta flag --json para saída em JSON
    const asJson = process.argv.includes('--json');
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      // Formato texto
      console.log(`Total: ${rows.length} usuário(s) desativado(s)\n`);
      for (const r of rows) {
        console.log(
          `#${r.id} | ${r.nome} <${r.email}> | tipo=${r.tipo} | suspended=${r.suspended} | until=${r.suspendedUntil || '-'} | deletionReq=${r.deletionRequestedAt || '-'} | updated=${r.updatedAt}`
        );
      }
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro ao listar usuários desativados:', err.message || err);
    try { await sequelize.close(); } catch {}
    process.exit(1);
  }
})();
