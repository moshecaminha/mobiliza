# MOBILIZA · Conectar ao GitHub e Testar

Guia passo-a-passo para colocar o projeto no GitHub e ter um ambiente de testes rodando em produção em ~20 minutos.

---

## Pré-requisitos

- **Git instalado** ([download](https://git-scm.com/downloads))
- **Conta GitHub** ([github.com/signup](https://github.com/signup) — grátis)
- **Conta Railway** OU **Render** (para deploy do backend)
- **Conta Vercel** (para o frontend) — opcional

---

## Parte 1 · Preparar repositório local · 2 minutos

### Opção A — Script automático (recomendado)

**Windows:**
1. Abra a pasta `production/` no Explorer
2. Clique duplo em `setup-git.bat`
3. Siga as instruções na tela

**Linux/Mac:**
```bash
cd production
chmod +x setup-git.sh
./setup-git.sh
```

O script faz:
- `git init`
- Cria `.env` a partir de `.env.example`
- Garante que `.env` está no `.gitignore`
- `git add . && git commit`

### Opção B — Manual

```bash
cd production
cp .env.example .env       # depois edite com seus segredos
git init
git branch -M main
git add .
git commit -m "Initial commit · MOBILIZA platform"
```

---

## Parte 2 · Criar repo no GitHub · 1 minuto

1. Acesse [github.com/new](https://github.com/new)
2. Preencha:
   - **Repository name:** `mobiliza-backend` (ou outro nome)
   - **Visibility:** **🔒 Private** (recomendado — contém código sensível)
   - **NÃO** marque "Initialize with README" (já temos um)
3. Clique **Create repository**
4. GitHub mostra a página com comandos. **Use a opção "push an existing repository"**:

```bash
git remote add origin https://github.com/SEU_USUARIO/mobiliza-backend.git
git push -u origin main
```

5. Quando o git pedir credenciais, use:
   - Username: seu usuário GitHub
   - Password: **um Personal Access Token** (não a senha da conta!)
   - Criar token: [github.com/settings/tokens/new](https://github.com/settings/tokens/new) → marque `repo` → gere

---

## Parte 3 · Deploy automático no Railway · 10 minutos

Railway sincroniza com GitHub: cada push vira deploy automático.

### 3.1 · Criar projeto Railway
1. Acesse [railway.app](https://railway.app/) e login com GitHub
2. **+ New Project** → **Deploy from GitHub repo**
3. Autorize o Railway a acessar seus repos privados (se for primeiro uso)
4. Selecione `mobiliza-backend`
5. Railway detecta automaticamente que é um app Node.js

### 3.2 · Adicionar PostgreSQL
1. No projeto: **+ New** → **Database** → **Add PostgreSQL**
2. Railway provisiona um banco e gera `DATABASE_URL` automaticamente

### 3.3 · Configurar variáveis de ambiente
1. Clique no serviço Node.js (não no Postgres) → aba **Variables**
2. Adicione (uma por vez ou via "Raw Editor"):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<cole_aqui_um_segredo_aleatorio>
NODE_ENV=production
PORT=3001
ALLOWED_ORIGIN=*
```

Para gerar o `JWT_SECRET`, rode no seu terminal local:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

3. (Opcional) Adicione as keys de APIs externas conforme `.env.example`

### 3.4 · Aplicar o schema do banco
Em outra aba, abra o serviço **Postgres** no Railway → **Data** → **Query**.
Cole o conteúdo COMPLETO de `schema.sql` e clique **Run**.

Ou, melhor: localmente, rode:
```bash
# Pegue a DATABASE_URL pública nas Variables do Postgres no Railway
DATABASE_URL="postgres://..." npm run migrate
```

### 3.5 · Gerar URL pública
1. No serviço Node.js → **Settings** → **Networking** → **Generate Domain**
2. Railway dá um URL tipo `https://mobiliza-backend-production-abc1.up.railway.app`
3. Copie. Vai usar no próximo passo.

### 3.6 · Testar
```bash
curl https://mobiliza-backend-production-abc1.up.railway.app/api/status
```

Deve retornar JSON com `"ok": true, "db": "connected"`.

---

## Parte 4 · Deploy do frontend no Vercel · 3 minutos

O frontend é o `MOBILIZA_App.html` (fora da pasta `production/`). Vamos hospedar separado.

### 4.1 · Subir HTML pro mesmo repo (ou outro)
```bash
# Voltar pra raiz do projeto
cd ..
cp MOBILIZA_App.html production/public/index.html
cd production
git add public/
git commit -m "Add frontend"
git push
```

Ou crie um repo separado só para o frontend.

### 4.2 · Conectar Vercel
1. Acesse [vercel.com/new](https://vercel.com/new) e login com GitHub
2. **Import** → escolha `mobiliza-backend`
3. **Framework Preset:** Other
4. **Root Directory:** `production/public` (se você colocou o HTML lá)
5. **Build Command:** (deixe vazio)
6. **Output Directory:** `.`
7. Clique **Deploy**

### 4.3 · Atualizar CORS
De volta no Railway → Variables do backend → edite:
```
ALLOWED_ORIGIN=https://mobiliza-backend.vercel.app
```
(use a URL real do seu Vercel)

### 4.4 · Apontar o app para o backend
Abra `MOBILIZA_App.html` no editor, encontre a linha:
```javascript
apiConfig:{useRealApi:false,youtube:'',backend:'',...}
```
Mude para:
```javascript
apiConfig:{useRealApi:true,youtube:'',backend:'https://mobiliza-backend-production-abc1.up.railway.app',backendStatus:'online',...}
```
Faça commit e push — Vercel atualiza automaticamente.

---

## Parte 5 · Testar de ponta a ponta · 3 minutos

1. Acesse a URL do Vercel
2. **Login:** qualquer email + telefone com DDD → código `123456`
   - Em produção (NODE_ENV=production), `123456` **NÃO** funciona — você precisa de Twilio/SendGrid configurados para receber código real
   - Para testar em produção sem SMS/email real, mude temporariamente `NODE_ENV=staging` no Railway
3. **Demo Pernambuco** ou **Configurar do zero**
4. Cadastre uma liderança — abra Console do Browser (F12) → Network — você verá `POST` para `/api/leaders` no Railway
5. Confirme no Railway: aba **Postgres → Data → Tables → leaders** — o registro está lá

✓ Está tudo funcionando.

---

## Parte 6 · Cada push vira deploy automático

Agora qualquer mudança que você fizer:
```bash
# editar código...
git add .
git commit -m "Adicionar feature X"
git push
```

Railway detecta o push e refaz deploy do backend automaticamente em ~1 min.
Vercel faz o mesmo para o frontend em ~30 segundos.

---

## Troubleshooting

### `git push` pede senha e não aceita a da conta GitHub
Use um **Personal Access Token** ao invés da senha:
1. Vá em [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
2. Marque o scope **`repo`**
3. Gere e copie (não vai aparecer de novo)
4. Use ele no lugar da senha quando o git pedir

Para não digitar toda vez, configure:
```bash
git config --global credential.helper store
```

### Railway diz "Application failed to respond"
- Confira se `PORT=3001` está nas Variables
- Veja logs: aba **Deployments → View Logs**
- Geralmente é `DATABASE_URL` faltando ou schema não aplicado

### `Migration failed: relation "organizations" already exists`
Schema já foi aplicado. Pode ignorar — `CREATE TABLE IF NOT EXISTS` evita duplicação.

### CORS error no console do browser
- Confira `ALLOWED_ORIGIN` no Railway aponta para o domínio do Vercel
- Restart do serviço após mudar variável de ambiente

### Login com `123456` não funciona em produção
Comportamento esperado em `NODE_ENV=production` (segurança).
Para testar:
- Configure Twilio + SendGrid (veja `.env.example`), OU
- Mude temporariamente `NODE_ENV=staging` no Railway

---

## Custos durante teste

- **GitHub:** grátis para repos privados (com Pro: US$4/mês ilimitados)
- **Railway:** ~US$5 de crédito grátis no signup, depois US$5/mês (Hobby)
- **Vercel:** grátis para Hobby (suporta dezenas de milhares de visitas/mês)
- **Total testes iniciais:** US$0 nas primeiras semanas

---

## Próximos passos após testar

Quando estiver pronto pra usuários reais:
1. Configure **Twilio** + **SendGrid** para SMS/email real
2. Mude `ALLOWED_ORIGIN` para domínio final
3. Adicione domínio customizado em Vercel e Railway
4. Configure **UptimeRobot** (grátis) para monitorar `/api/status`
5. Leia o `README.md` para checklist completo de produção

Bom deploy. 🚀
