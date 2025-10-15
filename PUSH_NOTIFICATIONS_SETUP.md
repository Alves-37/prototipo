# 🔔 Configuração de Notificações Push - Nevú

## 📋 Visão Geral

Sistema de notificações push implementado usando **Web Push API** e **Service Workers**. Permite que usuários recebam notificações na barra de notificações do celular/desktop mesmo quando não estão usando a aplicação.

## 🚀 Configuração Inicial

### 1. Instalar Dependência

```bash
cd backend
npm install web-push
```

### 2. Gerar Chaves VAPID

As chaves VAPID são necessárias para autenticar o servidor ao enviar notificações push.

```bash
npx web-push generate-vapid-keys
```

Você receberá algo como:

```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDJo3QTnpC_2MYqXhVeY6VkJJQXJJQXJJQXJJQXJJQXI

Private Key:
your-private-key-here-keep-it-secret
=======================================
```

### 3. Configurar Variáveis de Ambiente

Adicione ao arquivo `.env` do backend:

```env
VAPID_PUBLIC_KEY=sua-chave-publica-aqui
VAPID_PRIVATE_KEY=sua-chave-privada-aqui
VAPID_SUBJECT=mailto:suporte@nevu.co.mz
```

### 4. Atualizar Chave Pública no Frontend

Edite o arquivo `frontend/src/services/pushNotificationService.js`:

```javascript
const VAPID_PUBLIC_KEY = 'SUA_CHAVE_PUBLICA_AQUI';
```

## 📱 Como Funciona

### Fluxo de Inscrição

1. **Usuário faz login** → Sistema registra Service Worker automaticamente
2. **Após 5 segundos** → Aparece prompt pedindo permissão para notificações
3. **Usuário aceita** → Navegador cria inscrição push
4. **Frontend envia** → Inscrição é salva no banco de dados
5. **Pronto!** → Usuário receberá notificações

### Quando Notificações São Enviadas

#### 🆕 Nova Vaga Publicada
- **Quem recebe:** Todos os candidatos (tipo: 'usuario')
- **Título:** "💼 Nova Vaga Disponível!"
- **Mensagem:** "Empresa X publicou: Desenvolvedor React"
- **Ao clicar:** Abre `/vaga/{id}`

#### 📋 Novo Chamado Publicado
- **Quem recebe:** Todos os usuários exceto o autor
- **Título:** "📋 Novo Chamado Publicado!"
- **Mensagem:** "João publicou: Desenvolvimento de Website"
- **Ao clicar:** Abre `/chamado/{id}`

## 🗄️ Banco de Dados

### Tabela: `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  usuarioId INT NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSON NOT NULL,
  expirationTime DATETIME,
  userAgent VARCHAR(255),
  active BOOLEAN DEFAULT true,
  createdAt DATETIME,
  updatedAt DATETIME,
  FOREIGN KEY (usuarioId) REFERENCES Users(id) ON DELETE CASCADE
);
```

## 🔧 API Endpoints

### POST `/api/push/subscribe`
Inscrever usuário para notificações push.

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### POST `/api/push/unsubscribe`
Cancelar inscrição.

**Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### GET `/api/push/public-key`
Obter chave pública VAPID (público, sem autenticação).

## 💻 Uso Programático

### Enviar para um usuário específico

```javascript
const pushController = require('./controllers/pushController');

await pushController.sendToUser(usuarioId, {
  title: 'Título da Notificação',
  body: 'Mensagem da notificação',
  icon: '/nevu.png',
  url: '/destino',
  tag: 'tag-unica'
});
```

### Enviar para todos os usuários

```javascript
await pushController.sendToAll({
  title: 'Anúncio Importante',
  body: 'Nova funcionalidade disponível!',
  icon: '/nevu.png',
  url: '/novidades'
}, excludeUserId); // opcional: excluir um usuário
```

## 🧪 Testando

### 1. Testar Notificação Local (sem push)

No console do navegador:
```javascript
new Notification('Teste', {
  body: 'Esta é uma notificação de teste',
  icon: '/nevu.png'
});
```

### 2. Testar Service Worker

```javascript
import pushService from './services/pushNotificationService';

// Verificar suporte
console.log('Suportado:', pushService.isSupported());

// Testar notificação
await pushService.testNotification();

// Inscrever
await pushService.subscribe();
```

### 3. Testar do Backend

Crie um endpoint temporário para teste:

```javascript
router.post('/test-push', authMiddleware, async (req, res) => {
  const result = await pushController.sendToUser(req.user.id, {
    title: 'Teste de Push',
    body: 'Se você viu isso, está funcionando!',
    icon: '/nevu.png'
  });
  res.json(result);
});
```

## 🌐 Compatibilidade de Navegadores

| Navegador | Desktop | Mobile |
|-----------|---------|--------|
| Chrome    | ✅ 50+  | ✅ 50+ |
| Firefox   | ✅ 44+  | ✅ 48+ |
| Safari    | ✅ 16+  | ✅ 16.4+ |
| Edge      | ✅ 79+  | ✅ 79+ |
| Opera     | ✅ 37+  | ✅ 37+ |

## 🔒 Segurança

- ✅ Chaves VAPID mantidas em variáveis de ambiente
- ✅ Endpoints protegidos com autenticação JWT
- ✅ Inscrições vinculadas ao usuário autenticado
- ✅ Service Worker servido via HTTPS (obrigatório)
- ✅ Validação de permissões no navegador

## 📊 Monitoramento

### Verificar inscrições ativas

```sql
SELECT 
  u.nome,
  u.email,
  COUNT(ps.id) as total_dispositivos,
  SUM(ps.active) as ativos
FROM Users u
LEFT JOIN push_subscriptions ps ON u.id = ps.usuarioId
GROUP BY u.id;
```

### Limpar inscrições inativas

```sql
DELETE FROM push_subscriptions 
WHERE active = false 
AND updatedAt < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## 🐛 Troubleshooting

### Notificações não aparecem

1. **Verificar permissão:**
   ```javascript
   console.log(Notification.permission); // deve ser "granted"
   ```

2. **Verificar Service Worker:**
   ```javascript
   navigator.serviceWorker.getRegistration().then(reg => {
     console.log('SW registrado:', !!reg);
   });
   ```

3. **Verificar inscrição:**
   ```javascript
   navigator.serviceWorker.ready.then(reg => {
     reg.pushManager.getSubscription().then(sub => {
       console.log('Inscrito:', !!sub);
     });
   });
   ```

### Erro: "Push subscription has expired"

- Inscrições podem expirar
- Sistema marca automaticamente como `active: false`
- Usuário precisa aceitar permissão novamente

### HTTPS Obrigatório

- Service Workers só funcionam em HTTPS
- Exceção: `localhost` para desenvolvimento
- Use ngrok ou similar para testar em dispositivos móveis

## 📝 Próximos Passos

- [ ] Adicionar preferências de notificação por usuário
- [ ] Implementar notificações agendadas
- [ ] Analytics de taxa de clique
- [ ] Suporte a imagens ricas nas notificações
- [ ] Notificações personalizadas por categoria de vaga

## 🆘 Suporte

Para problemas ou dúvidas:
- Email: suporte@nevu.co.mz
- Documentação Web Push: https://web.dev/push-notifications-overview/
