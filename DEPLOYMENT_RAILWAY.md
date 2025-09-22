# Deploy do Backend Nevú no Railway

Este guia descreve como publicar o backend (na raiz do repositório) no Railway utilizando PostgreSQL.

## Pré-requisitos
- Conta no Railway ([https://railway.app](https://railway.app))
- Repositório com o diretório `backend/` na raiz do projeto

## O que já está preparado
- Dockerfile pronto em `Dockerfile` (o Railway detecta e usa automaticamente)
- `.dockerignore` para reduzir o tamanho da imagem
- Suporte ao PostgreSQL no Sequelize via `pg` e `pg-hstore` no `package.json`
- Configuração de banco em `src/config/database.js` que:
  - Usa `DATABASE_PUBLIC_URL` (proxy pública) por padrão
  - Faz fallback para `DATABASE_URL` (host interno, para quando rodar no ambiente do Railway)
  - Habilita SSL quando `DATABASE_SSL=true`
  - Faz fallback para SQLite local se nenhuma URL for informada
- Sincronização do banco em `src/models/index.js` com `sync({ alter: true })` e fallbacks

## Variáveis de Ambiente (Railway)
Configure no Railway (Project > Variables):

- `PORT` = 5000
- `JWT_SECRET` = umsegredoseguro (ou outro segredo seguro)
- `DATABASE_PUBLIC_URL` = postgresql://postgres:...@switchback.proxy.rlwy.net:18944/railway
- `DATABASE_URL` = postgresql://postgres:...@postgres.railway.internal:5432/railway
- `DATABASE_SSL` = true

Obs.: Nunca exponha variáveis sensíveis em commits. Use apenas as variáveis no painel do Railway.

## Passos de Deploy
1. Crie um novo projeto no Railway
2. Conecte o repositório do GitHub
3. Em "Service Settings" confirme:
   - Root Directory: `.` (raiz do repositório)
   - Build: Dockerfile (auto-detectado)
4. Adicione as variáveis de ambiente acima
5. Faça o deploy

O Railway vai:
- Executar a build do Dockerfile
- Rodar `npm ci --omit=dev` (ou `npm install --omit=dev`) e iniciar com `npm start`

## Testes
- Após o deploy, teste o endpoint de health:
  - GET `https://<seu-dominio>.railway.app/api/health`

## CORS
O backend usa `cors()` aberto por padrão em `src/app.js`. Se precisar restringir origens, ajuste:

```js
const allowedOrigins = [
  'http://localhost:5173',
  'https://seu-front.app',
];
app.use(cors({ origin: allowedOrigins }));
```

## Migrações
As tabelas são criadas/sincronizadas automaticamente por `sequelize.sync()`. Se precisar migrações específicas, use os scripts existentes (`backend/`) como referência:
- `npm run migrate-capacidade`
- `npm run check-capacidade`

## Dicas
- Em produção, mantenha `DATABASE_SSL=true` (requerido pela proxy pública)
- Prefira `DATABASE_URL` quando backend e banco estiverem no mesmo projeto Railway (rede interna)
- Acompanhe logs no Railway para ver mensagens de sincronização do banco
