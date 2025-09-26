const fs = require('fs');

// Ler o arquivo
const content = fs.readFileSync('c:/Users/saide/backend2/frontend/src/pages/Perfil.jsx', 'utf8');
const lines = content.split('\n');

console.log('Verificando linhas ao redor do erro...');

// Verificar linhas 460-480
for (let i = 460; i <= 480; i++) {
  if (lines[i-1]) {
    console.log(`${i}: ${lines[i-1]}`);
  }
}

// Procurar por problemas específicos
console.log('\n=== Procurando por problemas ===');

// Verificar se há funções não fechadas
let inFunction = false;
let functionDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Detectar início de função
  if (line.includes('function ') || line.includes('const ') && line.includes('= (') || line.includes('= () =>')) {
    inFunction = true;
    functionDepth = 0;
  }
  
  // Contar chaves
  for (const char of line) {
    if (char === '{') functionDepth++;
    if (char === '}') functionDepth--;
  }
  
  // Se chegou a 0 e estava em função, saiu da função
  if (inFunction && functionDepth === 0 && line.includes('}')) {
    inFunction = false;
  }
  
  // Verificar se há return fora de função
  if (line.includes('return') && !inFunction && i > 400 && i < 500) {
    console.log(`❌ PROBLEMA ENCONTRADO na linha ${i+1}: return fora de função`);
    console.log(`Linha: ${line}`);
    console.log(`Contexto:`);
    for (let j = Math.max(0, i-3); j <= Math.min(lines.length-1, i+3); j++) {
      console.log(`  ${j+1}: ${lines[j]}`);
    }
  }
}
