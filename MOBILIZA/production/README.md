# MOBILIZA · Deploy em Produção

Guia completo para subir a plataforma em produção com domínio próprio, HTTPS, banco de dados real e tudo funcionando.

---

## O que você vai colocar no ar

```
                ┌──────────────────────────────────────┐
                │  Domínio: app.mobiliza.com.br        │
                │  (Vercel/Netlify · CDN + HTTPS)      │
                │  · MOBILIZA_App.html servido         │
                └────────────────┬─────────────────────┘
                                 │ HTTPS
                ┌────────────────▼─────────────────────┐
                │  Backend: api.mobiliza.com.br        │
                │  (Railway/Render · Node.js)          │
                │  · /api/auth/*  /api/social/*        │
                │  · /api/candidates  /api/militants…  │
                └────────────────┬─────────────────────┘
                                 │
        ┌────────────────────────┼──────────────────────┐
        ▼                        ▼                      ▼
┌────────────────┐    ┌──────────────────┐   ┌─────────────────┐
│ PostgreSQL     │    │  APIs externas   │   │ Comunicação     │
│ (Railway/      │    │  YouTube · X     │   │ Twilio · SendG  │
│  Supabase)     │    │  Meta · TikTok   │   │ Meta WhatsApp   │
└────────────────┘    └──────────────────┘   └─────────────────┘
```

---

## Caminho 1 (recomendado) · Railway · 30 minutos · ~US$ 10/mês

**Railway** hospeda o backend + banco em uma única plataforma. Frontend separado no **Vercel** (grátis).

### Passo 1.1 · Criar conta Railway
1. Acesse [railway.app](https://railway.app/) e crie conta com GitHub
2. Clique **"New Project" → "Provision PostgreSQL"** — banco grátis criado
3. Anote a `DATABASE_URL` em **Variables** (formato `postgres://user:senha@host:5432/railway`)

### Passo 1.2 · Subir o backend
1. Crie repositório GitHub e faça push do conteúdo desta pasta (`production/`)
2. No Railway: **+ New → Deploy from GitHub repo** → escolha o repo
3. Em **Variables** do serviço, configure:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}     # auto-vinculado
   JWT_SECRET=<gere com node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
   NODE_ENV=production
   PORT=3001
   ALLOWED_ORIGIN=https://app.mobiliza.com.br
   ```
4. (Opcional) Adicione `YOUTUBE_API_KEY`, `TWILIO_*`, `SENDGRID_API_KEY`, `OPENAI_API_KEY`
5. Deploy automático — Railway cuida de tudo
6. Aplique o schema: no Railway abra o serviço Postgres → **Data → Query** e cole o conteúdo de `schema.sql` (ou rode `npm run migrate` localmente apontando pra URL pública)
7. Anote a URL pública do backend, ex: `https://mobiliza-backend-production.up.railway.app`

### Passo 1.3 · Subir o frontend
1. No Vercel: **Add New Project → Import Git Repository**
2. Aponte para o repo (ou só faça upload do `MOBILIZA_App.html`)
3. Build settings: **Other** (sem framework)
4. Antes do deploy, edite o HTML pra apontar pro backend de produção:
   - Em **Configurações → Conectar APIs → Servidor backend**, cole a URL do Railway
   - Ou hardcode em `state.apiConfig.backend = 'https://mobiliza-backend...'` no script (linha do DEFAULT_STATE)
5. Deploy
6. Anote a URL do frontend, ex: `https://mobiliza-app.vercel.app`

### Passo 1.4 · Domínio próprio
1. **Vercel** (frontend):
   - Settings → Domains → Add `app.mobiliza.com.br`
   - Adicione registro CNAME no seu DNS: `app → cname.vercel-dns.com`
2. **Railway** (backend):
   - Settings → Networking → Generate Domain → Custom: `api.mobiliza.com.br`
   - CNAME no DNS: `api → <id>.up.railway.app`
3. HTTPS é automático em ambos
4. Atualize `ALLOWED_ORIGIN` no Railway para o novo domínio

**Custo Railway:** ~US$ 5/mês backend + US$ 5/mês Postgres (Hobby plan)
**Custo Vercel:** Grátis (Hobby plan suporta tráfego de uma campanha local)

---

## Caminho 2 · Vercel + Supabase · 30 minutos · ~US$ 0-25/mês

**Supabase** dá Postgres grátis + dashboard visual. Vercel hospeda backend (serverless) + frontend.

### Passo 2.1 · Banco no Supabase
1. Crie projeto em [supabase.com](https://supabase.com/) (grátis até 500MB DB)
2. Em **Settings → Database** copie a connection string
3. No SQL Editor cole e execute `schema.sql`

### Passo 2.2 · Backend em Vercel Functions
Como Vercel Functions tem timeout curto, melhor opção é Railway/Render para backend. Se ainda quiser Vercel:
1. Reorganize código: cada endpoint vira um arquivo em `api/`
2. Ou use Vercel para frontend + Railway para backend (combinação ideal)

### Passo 2.3 · Frontend
Mesmo do Caminho 1 acima.

**Custo:** Grátis até atingir limites · ~US$ 25/mês com tráfego médio (Pro Supabase + Vercel Pro)

---

## Caminho 3 · VPS próprio (Docker) · 1h · ~US$ 5-12/mês

Para controle total. Funciona em DigitalOcean Droplet, AWS Lightsail, Linode, Hetzner, etc.

### Passo 3.1 · Provisionar VPS
1. Crie droplet Ubuntu 22.04 com **2GB RAM mínimo** (US$ 12/mês na DO)
2. SSH no servidor:
   ```bash
   ssh root@<seu-ip>
   apt update && apt upgrade -y
   curl -fsSL https://get.docker.com | sh
   apt install docker-compose nginx certbot python3-certbot-nginx -y
   ```

### Passo 3.2 · Subir backend com Docker
```bash
git clone <seu-repo> /opt/mobiliza
cd /opt/mobiliza/production
cp .env.example .env
nano .env   # preencha JWT_SECRET, POSTGRES_PASSWORD, ALLOWED_ORIGIN, etc.
docker-compose up -d
docker-compose logs -f
```
Backend rodando em `http://<seu-ip>:3001`.

### Passo 3.3 · Frontend via Nginx
```bash
# Servir o HTML estático
mkdir -p /var/www/mobiliza
cp /opt/mobiliza/MOBILIZA_App.html /var/www/mobiliza/index.html

# Configurar Nginx
cat > /etc/nginx/sites-available/mobiliza <<'EOF'
server {
    server_name app.mobiliza.com.br;
    root /var/www/mobiliza;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
server {
    server_name api.mobiliza.com.br;
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
ln -s /etc/nginx/sites-available/mobiliza /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Passo 3.4 · HTTPS gratuito
```bash
certbot --nginx -d app.mobiliza.com.br -d api.mobiliza.com.br
# Renovação automática já configurada
```

### Passo 3.5 · DNS
Aponte os subdomínios no seu provedor de DNS:
```
A    app    <ip_do_vps>
A    api    <ip_do_vps>
```

**Custo:** US$ 5-12/mês (VPS) · domínio US$ 30-60/ano

---

## Passo final · Apontar o app frontend para o backend

Abra `MOBILIZA_App.html` no editor e ajuste a linha do DEFAULT_STATE:

```javascript
apiConfig: {
  useRealApi: true,
  backend: 'https://api.mobiliza.com.br',  // ← URL do seu backend
  backendStatus: 'untested',
  // ...
}
```

Ou deixe o usuário configurar manualmente em **Configurações → Conectar APIs**.

---

## Checklist de produção

Antes de divulgar:

- [ ] `JWT_SECRET` é único, aleatório, com 64+ caracteres
- [ ] `NODE_ENV=production` setado
- [ ] `ALLOWED_ORIGIN` restrito ao seu domínio (não `*`)
- [ ] HTTPS funcionando (certbot ou Vercel/Railway automático)
- [ ] Backup do banco configurado (Railway/Supabase fazem auto; em VPS use `pg_dump` em cron)
- [ ] Variáveis de ambiente NÃO commitadas no Git (`.env` no `.gitignore`)
- [ ] Schema aplicado (`schema.sql` rodou sem erro)
- [ ] Rate limiting ativo (já incluso no código)
- [ ] Helmet ativo (já incluso)
- [ ] Logs sendo coletados (Railway/Render fazem auto; em VPS use `journalctl`)
- [ ] Monitoramento básico (UptimeRobot grátis para checar `/api/status`)
- [ ] Cadastrou pelo menos 1 usuário admin de teste (faça login na plataforma)
- [ ] Política de privacidade e termos de uso publicados
- [ ] Compliance LGPD: opt-in registrado, opt-out funcional, política de retenção

---

## Custo total estimado de produção

| Item | Stack barato | Stack médio | Stack escalável |
|------|--------------|-------------|-----------------|
| Backend | Railway US$ 5 | Render US$ 7 | AWS ECS US$ 30 |
| Banco | Railway PG US$ 5 | Supabase US$ 25 | RDS US$ 50 |
| Frontend | Vercel grátis | Vercel grátis | CloudFront US$ 10 |
| Domínio | US$ 3/mês | US$ 3/mês | US$ 3/mês |
| SMS Twilio | ~US$ 0,05/SMS | igual | igual |
| Email SendGrid | grátis 100/dia | US$ 19 | US$ 90 |
| WhatsApp Business | ~R$ 0,09/conv | igual | igual |
| **Total fixo/mês** | **~US$ 13** | **~US$ 54** | **~US$ 180** |

Custos variáveis (SMS, WhatsApp, mídia paga) crescem com volume.

---

## Manutenção contínua

**Diária:**
- Verificar logs do backend (Railway Dashboard → Logs ou `docker logs`)
- Monitorar uso de APIs (não estourar limites do Twitter/Meta)

**Semanal:**
- Verificar uso de cota: YouTube Data API, Twilio, SendGrid
- Conferir backup do banco
- Atualizar dependências (`npm outdated`)

**Mensal:**
- Auditar logs (tabela `audit_logs`)
- Esvaziar `otp_codes` expirados: `DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '7 days'`
- Backup completo manual
- Atualizar Node.js patch versions

**Antes da campanha começar:**
- Stress test: simular 100 logins simultâneos
- Aprovar templates WhatsApp na Meta (24-48h de antecedência)
- Testar disparos com base pequena antes do massivo
- Treinar coordenadores

---

## Suporte e troubleshooting

| Sintoma | Diagnóstico |
|---------|-------------|
| `503 database offline` | Verifique `DATABASE_URL` e firewall do banco |
| `401 token inválido` | JWT_SECRET pode ter mudado · usuário precisa relogar |
| `429 too many requests` | Rate limit atingido (120 req/min) · ajuste `generalLimiter` no `server.js` |
| Frontend não conecta | Confira `ALLOWED_ORIGIN` no backend · deve incluir o domínio do frontend |
| SMS não envia | Verifique status da conta Twilio + saldo + número aprovado pro Brasil |
| Login funciona com 123456 em prod | Defina `NODE_ENV=production` — código teste só funciona em dev/staging |

---

## Próximos passos para escalar

Quando atingir 5+ campanhas simultâneas ou 100k+ militantes:

1. **Database**: migrar para RDS PostgreSQL com read replica
2. **Cache**: adicionar Redis para sessões + cache de queries pesadas
3. **Workers async**: BullMQ + Redis para disparos massivos de WhatsApp
4. **Storage**: S3 para fotos e mídia (em vez de URLs direto no banco)
5. **CDN**: CloudFront na frente do frontend
6. **Observability**: Sentry para erros + Grafana para métricas

Documento atualizado: 2026
