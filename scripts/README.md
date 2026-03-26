# Scripts de Gerenciamento de Notificações Push

Esta pasta contém scripts para gerenciar as configurações de notificações push dos usuários em massa.

## Scripts Disponíveis

### 1. enablePushNotifications.js
Ativa notificações push para todos os usuários que ainda não têm configurado.

```bash
# Simular (ver quantos serão atualizados)
node scripts/enablePushNotifications.js --dry-run

# Executar realmente
node scripts/enablePushNotifications.js
```

**O que faz:**
- Busca usuários onde `pushEnabled` é `null`, `false` ou `pushPromptAnsweredAt` é `null`
- Define `pushEnabled = true` e `pushPromptAnsweredAt = data atual`
- Mostra estatísticas antes e depois

### 2. resetPushPreferences.js
Reseta todas as preferências de notificação para o estado inicial.

```bash
# Simular reset para usuários com preferências existentes
node scripts/resetPushPreferences.js --dry-run

# Resetar apenas usuários que já têm preferências configuradas
node scripts/resetPushPreferences.js

# Resetar TODOS os usuários (inclusive os que já estão null)
node scripts/resetPushPreferences.js --all

# Simular reset de todos
node scripts/resetPushPreferences.js --all --dry-run
```

**O que faz:**
- Define `pushEnabled = null` e `pushPromptAnsweredAt = null`
- Remove todas as preferências de notificação
- Útil para "começar do zero"

## Fluxo Recomendado

1. **Primeira vez**: Use `enablePushNotifications.js` para ativar para todos
2. **Se precisar recomeçar**: Use `resetPushPreferences.js --all` depois `enablePushNotifications.js`
3. **Para testar**: Sempre use `--dry-run` primeiro para ver o impacto

## Exemplos de Saída

### enablePushNotifications.js --dry-run
```
📋 Encontrados 150 usuários para atualizar:

👥 Usuários que serão atualizados:
ID  | Tipo       | Nome                | Email                        | Push Atual
--- | ----       | ----                | ----                        | ---------
1   | usuario    | João Silva          | joao@email.com               | null
2   | empresa    | Tech Solutions      | contato@tech.com             | false
...

🔍 MODO DRY RUN: Nenhuma alteração será realizada
```

### enablePushNotifications.js (execução real)
```
✅ Notificações push ativadas para 150 usuários!

📈 Estatísticas finais:
Total de usuários: 200
Com push ativado: 180
Sem push ativado: 20
Taxa de ativação: 90.00%
```

## Segurança

- Os scripts apenas modificam campos de preferência no banco de dados
- Não afetam inscrições push existentes (PushSubscription)
- Não enviam notificações, apenas configuram preferências
- Use sempre `--dry-run` antes de executar em produção

## Requisitos

- Node.js instalado
- Acesso ao banco de dados
- Variáveis de ambiente configuradas (mesmas do aplicativo)

## Troubleshooting

**Erro de conexão**: Verifique se as variáveis de ambiente do banco estão configuradas
**Permissão negada**: Verifique se o usuário do banco tem permissão de UPDATE na tabela users
