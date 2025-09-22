const http = require('http');

// Criar usuário de teste
function createTestUser() {
  console.log('=== Criando Usuário de Teste ===');
  
  const userData = JSON.stringify({
    nome: 'Empresa Teste',
    email: 'teste@empresa.com',
    senha: '123456',
    tipo: 'empresa'
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(userData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Usuário criado com sucesso!');
        console.log('Dados do usuário:', response);
        console.log('\nAgora você pode testar a atualização com:');
        console.log('node test-simple.js');
      } catch (error) {
        console.log('❌ Erro ao criar usuário:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.log('❌ Erro na requisição:', error.message);
  });
  
  req.write(userData);
  req.end();
}

// Executar
createTestUser(); 