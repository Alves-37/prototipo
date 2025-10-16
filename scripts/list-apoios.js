#!/usr/bin/env node
/*
  Lista apoios (tickets) disponíveis/abertos do banco PostgreSQL.
  Por padrão mostra status pendente e em_atendimento (abertos).

  Uso:
    node scripts/list-apoios.js                   # abertos (pendente + em_atendimento)
    node scripts/list-apoios.js --status=todos    # todos os status
    node scripts/list-apoios.js --status=pendente # filtra por um status
    node scripts/list-apoios.js --busca="joao"      # busca por nome/email/mensagem
    node scripts/list-apoios.js --limit=50        # limitar quantidade
    node scripts/list-apoios.js --json            # saída em JSON

  Requisitos:
    - Variável de ambiente DATABASE_PUBLIC_URL ou DATABASE_URL configurada
    - Dependências do projeto instaladas
*/

require('dotenv').config();

const { sequelize, Apoio, User } = require('../src/models');
const { Op } = require('sequelize');

function parseArgs(argv) {
  const args = { status: 'abertos', busca: null, json: false, limit: 100 };
  for (const a of argv.slice(2)) {
    if (a === '--json') args.json = true;
    else if (a.startsWith('--status=')) args.status = a.split('=')[1];
    else if (a.startsWith('--busca=')) args.busca = a.split('=')[1];
    else if (a.startsWith('--limit=')) args.limit = Math.max(1, parseInt(a.split('=')[1], 10) || 100);
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  try {
    await sequelize.authenticate();

    // Construir filtro de status
    let statusWhere;
    if (!args.status || args.status === 'abertos') {
      statusWhere = { status: { [Op.in]: ['pendente', 'em_atendimento'] } };
    } else if (args.status === 'todos') {
      statusWhere = {};
    } else if (['pendente', 'em_atendimento', 'resolvido'].includes(args.status)) {
      statusWhere = { status: args.status };
    } else {
      console.error('Status inválido. Use: abertos|todos|pendente|em_atendimento|resolvido');
      process.exit(2);
    }

    const where = { ...statusWhere };
    if (args.busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${args.busca}%` } },
        { email: { [Op.iLike]: `%${args.busca}%` } },
        { mensagem: { [Op.iLike]: `%${args.busca}%` } },
      ];
    }

    const itens = await Apoio.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: args.limit,
      include: [
        { model: User, as: 'usuario', attributes: ['id','nome','email'], required: false },
      ],
      attributes: ['id','usuarioId','nome','email','mensagem','status','createdAt','updatedAt'],
    });

    const rows = itens.map(a => ({
      id: a.id,
      status: a.status,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
      nome: a.nome || (a.usuario ? a.usuario.nome : null),
      email: a.email || (a.usuario ? a.usuario.email : null),
      usuarioId: a.usuarioId || (a.usuario ? a.usuario.id : null),
      mensagem: a.mensagem,
    }));

    if (args.json) {
      console.log(JSON.stringify({ total: rows.length, items: rows }, null, 2));
    } else {
      console.log(`Total: ${rows.length} apoio(s)${args.status === 'abertos' ? ' abertos' : ''}`);
      for (const r of rows) {
        const who = r.nome || r.email ? `${r.nome || ''} <${r.email || ''}>` : (r.usuarioId ? `usuarioId=${r.usuarioId}` : 'anônimo');
        console.log(`#${r.id} | ${r.status} | ${who} | ${r.createdAt}`);
        // Para ver mensagem completa, o operador pode usar --json; aqui mantemos uma linha
      }
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro ao listar apoios:', err.message || err);
    try { await sequelize.close(); } catch {}
    process.exit(1);
  }
})();
