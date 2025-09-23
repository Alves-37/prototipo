// Lista usuários do banco com opções de filtro/limite
// Uso:
//   node list-users.js                      -> lista até 50 usuários (campos principais)
//   node list-users.js --limit 100          -> define limite
//   node list-users.js --offset 0           -> deslocamento (pagina)
//   node list-users.js --json               -> saída em JSON
//   node list-users.js --all                -> mostra todos os campos
//   node list-users.js --count              -> mostra contagens totais (geral e filtrado)
//   node list-users.js --where tipo=empresa -> filtra por campo simples (igualdade)

require('dotenv').config();
const { sequelize, User } = require('./src/models');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 50, offset: 0, json: false, all: false, count: false, where: {} };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--limit') {
      opts.limit = parseInt(args[++i] || '50', 10) || 50;
    } else if (a === '--offset') {
      opts.offset = parseInt(args[++i] || '0', 10) || 0;
    } else if (a === '--json') {
      opts.json = true;
    } else if (a === '--all') {
      opts.all = true;
    } else if (a === '--count') {
      opts.count = true;
    } else if (a === '--where') {
      const cond = args[++i];
      // suporta chave=valor (apenas igualdade simples)
      if (cond && cond.includes('=')) {
        const [k, v] = cond.split('=');
        opts.where[k] = v;
      }
    }
  }
  return opts;
}

(async () => {
  const opts = parseArgs();
  try {
    // Contagens para diagnóstico
    let totalAll = 0, totalFiltered = 0;
    if (opts.count) {
      totalAll = await User.count();
      totalFiltered = await User.count({ where: opts.where });
    }

    const attributes = opts.all ? undefined : [
      'id', 'nome', 'email', 'tipo', 'plano', 'statusAssinatura',
      'telefone', 'perfilPublico', 'createdAt', 'updatedAt'
    ];

    const users = await User.findAll({
      where: opts.where,
      order: [['id', 'ASC']],
      limit: opts.limit,
      offset: opts.offset,
      attributes,
    });

    const rows = users.map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      tipo: u.tipo,
      plano: u.plano,
      assinatura: u.statusAssinatura,
      telefone: u.telefone,
      publico: u.perfilPublico,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    if (opts.json) {
      const out = { limit: opts.limit, offset: opts.offset, countAll: undefined, countFiltered: undefined, rows };
      if (opts.count) { out.countAll = totalAll; out.countFiltered = totalFiltered; }
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`Usuarios (limit=${opts.limit}, offset=${opts.offset})`);
      console.table(rows);
      console.log(`Total retornado: ${rows.length}`);
      if (opts.count) {
        console.log(`Count total (sem filtro): ${totalAll}`);
        console.log(`Count filtrado (where): ${totalFiltered}`);
      }
    }
  } catch (err) {
    console.error('Erro ao listar usuários:', err.message);
    process.exitCode = 1;
  } finally {
    try { await sequelize.close(); } catch {}
  }
})();
