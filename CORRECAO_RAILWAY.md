# Correção de Erros - Railway e Vercel

## ✅ Problemas Resolvidos Localmente

1. **Conflito de merge no Home.jsx** - Resolvido
2. **CORS configurado** para permitir `https://nevu.vercel.app`

## 🔧 Ações Necessárias no Railway

### Problema 1: Banco de Dados Vazio

**Erro:**
```
relation "Users" does not exist
Produção: não será executado force=true. Abortando para proteger dados.
```

**Solução:**

1. Acesse o **Railway Dashboard**
2. Vá em **Variables** do seu projeto backend
3. Adicione temporariamente:
   ```
   FORCE_DB_RESET=true
   ```
4. Aguarde o redeploy automático
5. Verifique os logs - deve ver: "Banco sincronizado com sucesso"
6. **IMPORTANTE:** Após o banco ser criado, **REMOVA** a variável `FORCE_DB_RESET`

### Problema 2: VAPID Keys (Opcional)

**Aviso:**
```
⚠️  VAPID keys não configuradas. Push notifications desabilitadas.
```

**Solução (se quiser push notifications):**

1. No seu terminal local:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. No Railway, adicione as variáveis:
   ```
   VAPID_PUBLIC_KEY=<sua-chave-publica>
   VAPID_PRIVATE_KEY=<sua-chave-privada>
   VAPID_SUBJECT=mailto:suporte@nevu.co.mz
   ```

### Problema 3: JWT_SECRET

**Aviso:**
```
[adminAuth] JWT_SECRET não definido no ambiente. Usando fallback padrão (apenas para desenvolvimento).
```

**Solução:**

1. Gere um secret seguro:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. No Railway, adicione:
   ```
   JWT_SECRET=<seu-secret-gerado>
   ```

## 📝 Checklist de Deploy

- [ ] Fazer commit das mudanças locais
- [ ] Push para o repositório
- [ ] Adicionar `FORCE_DB_RESET=true` no Railway
- [ ] Aguardar redeploy e verificar logs
- [ ] Remover `FORCE_DB_RESET` após sucesso
- [ ] (Opcional) Adicionar VAPID keys
- [ ] (Opcional) Adicionar JWT_SECRET
- [ ] Testar frontend no Vercel

## 🧪 Como Testar

1. Acesse https://nevu.vercel.app
2. Verifique se a seção "Oportunidades Disponíveis" carrega
3. Deve mostrar "0" em todos os campos (normal para banco novo)
4. Não deve haver erros de CORS no console

## ⚠️ Importante

- O banco será **completamente resetado** quando usar `FORCE_DB_RESET=true`
- **Remova** essa variável imediatamente após o banco ser criado
- Todos os dados serão perdidos se você deixar essa variável ativa
