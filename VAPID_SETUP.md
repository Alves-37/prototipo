# Configuração de Push Notifications (VAPID Keys)

## Problema
O backend está falhando no Railway porque as chaves VAPID para push notifications não estão configuradas.

## Solução

### Passo 1: Gerar as chaves VAPID

Execute o seguinte comando no seu terminal local:

```bash
npx web-push generate-vapid-keys
```

Isso vai gerar algo como:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3QTnpC_2MYqXhVeY6VkJJQXJJQXJJQXJJQXJJQXI

Private Key:
abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG

=======================================
```

### Passo 2: Configurar no Railway

1. Acesse o dashboard do Railway
2. Selecione o seu projeto backend
3. Vá em **Variables** (Variáveis de ambiente)
4. Adicione as seguintes variáveis:

```
VAPID_PUBLIC_KEY=<sua-chave-publica>
VAPID_PRIVATE_KEY=<sua-chave-privada>
VAPID_SUBJECT=mailto:suporte@nevu.co.mz
```

**IMPORTANTE**: 
- Cole as chaves EXATAMENTE como foram geradas
- Não adicione espaços ou quebras de linha
- A chave privada deve ter exatamente 43 caracteres

### Passo 3: Redeploy

Após adicionar as variáveis, o Railway vai fazer redeploy automaticamente.

## Alternativa: Desabilitar Push Notifications Temporariamente

Se você não precisa de push notifications agora, o servidor vai iniciar normalmente sem as chaves VAPID. As funcionalidades de push simplesmente ficarão desabilitadas até você configurar as chaves.

## Verificação

Após o deploy, verifique os logs do Railway. Você deve ver:

✅ **Com chaves configuradas:**
```
✅ Push notifications configuradas com sucesso
```

⚠️ **Sem chaves configuradas:**
```
⚠️  VAPID keys não configuradas. Push notifications desabilitadas.
```

❌ **Com chaves inválidas:**
```
❌ Erro ao configurar VAPID keys: Vapid private key should be 32 bytes long when decoded.
```

## Testando Localmente

Para testar localmente, adicione as chaves no seu arquivo `.env`:

```env
VAPID_PUBLIC_KEY=sua-chave-publica
VAPID_PRIVATE_KEY=sua-chave-privada
VAPID_SUBJECT=mailto:suporte@nevu.co.mz
```
