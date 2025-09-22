const sequelize = require('./src/config/database');

async function migrateMensagens() {
  try {
    console.log('🔄 Iniciando migração de mensagens...');
    
    // Verificar se as tabelas já existem
    const tableInfo = await sequelize.query(
      "PRAGMA table_info(mensagens)",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableInfo.length === 0) {
      console.log('📝 Criando tabela mensagens...');
      await sequelize.query(`
        CREATE TABLE mensagens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          remetenteId INTEGER NOT NULL,
          destinatarioId INTEGER NOT NULL,
          texto TEXT NOT NULL,
          tipo TEXT DEFAULT 'texto',
          arquivo TEXT,
          lida BOOLEAN DEFAULT 0,
          enviada BOOLEAN DEFAULT 1,
          entregue BOOLEAN DEFAULT 0,
          vagaId INTEGER,
          conversaId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (remetenteId) REFERENCES usuarios (id),
          FOREIGN KEY (destinatarioId) REFERENCES usuarios (id),
          FOREIGN KEY (vagaId) REFERENCES vagas (id)
        )
      `);
      console.log('✅ Tabela mensagens criada!');
    } else {
      console.log('ℹ️ Tabela mensagens já existe');
    }

    // Verificar se a tabela conversas existe
    const conversaTableInfo = await sequelize.query(
      "PRAGMA table_info(conversas)",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (conversaTableInfo.length === 0) {
      console.log('📝 Criando tabela conversas...');
      await sequelize.query(`
        CREATE TABLE conversas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversaId TEXT UNIQUE NOT NULL,
          usuario1Id INTEGER NOT NULL,
          usuario2Id INTEGER NOT NULL,
          vagaId INTEGER,
          ultimaMensagem TEXT,
          ultimaMensagemData DATETIME,
          mensagensNaoLidas1 INTEGER DEFAULT 0,
          mensagensNaoLidas2 INTEGER DEFAULT 0,
          ativa BOOLEAN DEFAULT 1,
          silenciada1 BOOLEAN DEFAULT 0,
          silenciada2 BOOLEAN DEFAULT 0,
          bloqueada1 BOOLEAN DEFAULT 0,
          bloqueada2 BOOLEAN DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario1Id) REFERENCES usuarios (id),
          FOREIGN KEY (usuario2Id) REFERENCES usuarios (id),
          FOREIGN KEY (vagaId) REFERENCES vagas (id)
        )
      `);
      console.log('✅ Tabela conversas criada!');
    } else {
      console.log('ℹ️ Tabela conversas já existe');
    }

    // Criar índices para melhor performance
    console.log('📝 Criando índices...');
    
    try {
      await sequelize.query('CREATE INDEX idx_mensagens_conversaId ON mensagens(conversaId)');
      console.log('✅ Índice idx_mensagens_conversaId criado');
    } catch (e) {
      console.log('ℹ️ Índice idx_mensagens_conversaId já existe');
    }

    try {
      await sequelize.query('CREATE INDEX idx_mensagens_remetenteId ON mensagens(remetenteId)');
      console.log('✅ Índice idx_mensagens_remetenteId criado');
    } catch (e) {
      console.log('ℹ️ Índice idx_mensagens_remetenteId já existe');
    }

    try {
      await sequelize.query('CREATE INDEX idx_mensagens_destinatarioId ON mensagens(destinatarioId)');
      console.log('✅ Índice idx_mensagens_destinatarioId criado');
    } catch (e) {
      console.log('ℹ️ Índice idx_mensagens_destinatarioId já existe');
    }

    try {
      await sequelize.query('CREATE INDEX idx_conversas_usuario1Id ON conversas(usuario1Id)');
      console.log('✅ Índice idx_conversas_usuario1Id criado');
    } catch (e) {
      console.log('ℹ️ Índice idx_conversas_usuario1Id já existe');
    }

    try {
      await sequelize.query('CREATE INDEX idx_conversas_usuario2Id ON conversas(usuario2Id)');
      console.log('✅ Índice idx_conversas_usuario2Id criado');
    } catch (e) {
      console.log('ℹ️ Índice idx_conversas_usuario2Id já existe');
    }

    console.log('\n✅ Migração de mensagens concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
  }
}

// Executar migração
migrateMensagens(); 