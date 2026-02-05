const sequelize = require('../src/config/database');
const { DataTypes } = require('sequelize');

async function migrateMensagensColumns() {
  const qi = sequelize.getQueryInterface();

  console.log('[migrate-mensagens-columns] Iniciando...');

  try {
    const tableName = 'mensagens';

    const desc = await qi.describeTable(tableName);

    const addIfMissing = async (columnName, definition) => {
      if (desc && Object.prototype.hasOwnProperty.call(desc, columnName)) {
        console.log(`[migrate-mensagens-columns] OK: coluna ${columnName} já existe`);
        return;
      }
      console.log(`[migrate-mensagens-columns] Adicionando coluna ${columnName}...`);
      await qi.addColumn(tableName, columnName, definition);
      console.log(`[migrate-mensagens-columns] OK: coluna ${columnName} criada`);
    };

    await addIfMissing('editada', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addIfMissing('editadaEm', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    await addIfMissing('apagadaParaTodos', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addIfMissing('apagadaEm', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    await addIfMissing('ocultoPara', {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    });

    console.log('[migrate-mensagens-columns] Finalizado com sucesso');
  } catch (err) {
    console.error('[migrate-mensagens-columns] Falhou:', err?.message || err);
    console.error(err);
    process.exitCode = 1;
  } finally {
    try {
      await sequelize.close();
    } catch {}
  }
}

migrateMensagensColumns();
