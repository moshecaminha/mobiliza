# MOBILIZA — Especificação Técnica do Backend

> Documento de referência para implementação do servidor que transforma o app standalone (`MOBILIZA_App.html`) em uma plataforma multi-tenant production-ready com integrações reais.

**Versão:** 1.0
**Data:** Maio 2026
**Status:** Pronto para implementação

---

## 1. Visão geral da arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Web app (Next.js) · Mobile app militante (React Native)         │
│  Painel de TV (sala de guerra)                                   │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS/WSS
┌──────────────────────────────▼───────────────────────────────────┐
│                       API GATEWAY                                │
│  Autenticação (JWT) · rate limit · audit log · multi-tenant      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐       ┌──────────────┐
│  CORE API    │      │  AI WORKER   │       │ SOCIAL WORKER │
│  CRUD,       │      │  insights,   │       │ scraping +   │
│  cálculos    │      │  briefings   │       │ sentiment    │
└──────┬───────┘      └──────┬───────┘       └──────┬───────┘
       │                     │                      │
       ▼                     ▼                      ▼
┌────────────────────────────────────────────────────────────┐
│  POSTGRESQL  ·  REDIS  ·  S3  ·  PGVECTOR (embeddings)     │
└────────────────────────────────────────────────────────────┘
       │
       ├─→ WhatsApp Business API (Meta)
       ├─→ Twilio (SMS)
       ├─→ SendGrid (e-mail)
       ├─→ Instagram/X/TikTok/YouTube APIs
       ├─→ TSE Dados Abertos
       ├─→ ASAAS/Pix (doações)
       └─→ OpenAI/Anthropic (IA)
```

---

## 2. Stack recomendada

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| API principal | **Node.js + Fastify** (ou Python + FastAPI) | Performance, ecossistema maduro |
| Banco principal | **PostgreSQL 16** | Relacional, JSONB, full-text, PostGIS |
| Cache + Fila | **Redis 7** | Sessões, filas, pub/sub |
| Vector DB | **pgvector** (extensão Postgres) | Embeddings de menções/insights |
| Storage de arquivos | **S3** (ou Cloudflare R2) | Fotos, comprovantes, mídia |
| Workers async | **BullMQ** (Node) ou **Celery** (Python) | Disparos WhatsApp, scraping, IA |
| Frontend web | **Next.js 14 + React 18** | SSR, app router, performance |
| Mobile militante | **React Native + Expo** | Cross-platform, OTA updates |
| Infra | **AWS** (São Paulo) ou **Railway** | LGPD compliance + simplicidade |
| Observability | **OpenTelemetry + Grafana** | Logs, métricas, traces |

---

## 3. Modelo de dados (PostgreSQL)

### 3.1 Tabelas principais

```sql
-- MULTI-TENANT
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  plan          TEXT CHECK (plan IN ('starter','pro','enterprise')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT CHECK (role IN ('admin','coordinator','staff','militant','viewer')),
  phone         TEXT,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- CANDIDATO E ELEIÇÃO
CREATE TABLE candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party           TEXT,
  party_number    TEXT,
  photo_url       TEXT,
  color           TEXT,
  bio             TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE elections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  level           TEXT CHECK (level IN ('municipal','estadual','federal','presidencial')),
  position        TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  date            DATE,
  voter_count     INT,
  victory_target  INT,
  multiplier      NUMERIC(4,2) DEFAULT 4.20,
  conversion      NUMERIC(4,3) DEFAULT 0.710,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TERRITÓRIO
CREATE TABLE regions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES regions(id), -- hierarquia (cidade→bairro→seção)
  voter_count     INT,
  intensity       INT CHECK (intensity BETWEEN 0 AND 100),
  geo             GEOMETRY(MULTIPOLYGON, 4326), -- PostGIS
  notes           TEXT,
  ibge_code       TEXT,
  tse_zone        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_regions_geo ON regions USING GIST (geo);

-- MILITÂNCIA
CREATE TABLE leaders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  region_id       UUID REFERENCES regions(id),
  user_id         UUID REFERENCES users(id), -- se tem login
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  role            TEXT CHECK (role IN ('regional','bairro','outra')),
  status          TEXT DEFAULT 'active',
  contacts_goal   INT DEFAULT 0,
  contacts_made   INT DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE militants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  region_id       UUID REFERENCES regions(id),
  leader_id       UUID REFERENCES leaders(id),
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  cpf_hash        TEXT, -- hash, não armazenar CPF puro
  status          TEXT DEFAULT 'active',
  opt_in          BOOLEAN DEFAULT TRUE,
  opt_in_at       TIMESTAMPTZ,
  source          TEXT, -- como foi cadastrado
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_militants_region ON militants(region_id);
CREATE INDEX idx_militants_leader ON militants(leader_id);

-- AGENDA
CREATE TABLE events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  date            DATE NOT NULL,
  time            TIME,
  location        TEXT,
  geo_point       GEOMETRY(POINT, 4326),
  type            TEXT CHECK (type IN ('publico','midia','interno','pessoal')),
  description     TEXT,
  briefing        JSONB, -- briefing gerado por IA
  notify_email    BOOLEAN DEFAULT FALSE,
  notify_sms      BOOLEAN DEFAULT FALSE,
  notify_push     BOOLEAN DEFAULT FALSE,
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- COMUNICAÇÃO
CREATE TABLE message_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  content         TEXT NOT NULL,
  channel         TEXT,
  meta_template_id TEXT, -- ID do template aprovado no WhatsApp Business
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES message_templates(id),
  name            TEXT NOT NULL,
  channel         TEXT CHECK (channel IN ('whatsapp','sms','email','push','multi')),
  segments        JSONB, -- filtros aplicados
  message         TEXT,
  scheduled_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'draft', -- draft, scheduled, sending, sent, failed
  reach           INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count      INT DEFAULT 0,
  replied_count   INT DEFAULT 0,
  cost_brl        NUMERIC(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  militant_id     UUID REFERENCES militants(id),
  channel         TEXT,
  to_address      TEXT, -- número, email
  status          TEXT, -- pending, sent, delivered, read, failed, opt_out
  provider_id     TEXT, -- ID retornado pelo Twilio/Meta
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  reply_content   TEXT,
  error           TEXT
);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);

-- SOCIAL MONITORING
CREATE TABLE social_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  term            TEXT NOT NULL,
  type            TEXT CHECK (type IN ('candidato','adversario','partido','tema')),
  alert_enabled   BOOLEAN DEFAULT FALSE,
  alert_threshold INT DEFAULT 200, -- % aumento que dispara alerta
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE social_mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  keyword_id      UUID REFERENCES social_keywords(id),
  platform        TEXT CHECK (platform IN ('instagram','twitter','facebook','tiktok','youtube','web','telegram')),
  source_url      TEXT,
  author_handle   TEXT,
  author_followers INT,
  content         TEXT NOT NULL,
  content_embedding VECTOR(1536), -- pgvector
  sentiment       TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  sentiment_score NUMERIC(3,2), -- -1.00 a 1.00
  region_id       UUID REFERENCES regions(id),
  reach           INT,
  engagement      INT,
  posted_at       TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mentions_election_date ON social_mentions(election_id, collected_at DESC);
CREATE INDEX idx_mentions_sentiment ON social_mentions(election_id, sentiment);

-- ADVERSÁRIOS
CREATE TABLE competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party           TEXT,
  party_number    TEXT,
  color           TEXT,
  current_score   INT, -- 0-100
  history         JSONB, -- série histórica do score
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- IA INSIGHTS
CREATE TABLE insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  score           INT CHECK (score BETWEEN 0 AND 100),
  urgency         TEXT, -- 'now', '48h', 'week', 'month'
  category        TEXT, -- 'growth', 'risk', 'comms', 'militancy'
  color           TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  steps           JSONB,
  related_entities JSONB, -- IDs de regiões/eventos/etc relacionados
  generated_by    TEXT, -- 'rule', 'llm', 'manual'
  dismissed_at    TIMESTAMPTZ,
  done_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- DOAÇÕES (Pix/cartão via ASAAS)
CREATE TABLE donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID REFERENCES elections(id) ON DELETE CASCADE,
  amount_brl      NUMERIC(10,2),
  donor_name      TEXT,
  donor_cpf_hash  TEXT,
  donor_phone     TEXT,
  method          TEXT, -- pix, card
  status          TEXT, -- pending, confirmed, refused
  asaas_id        TEXT UNIQUE,
  tse_reported    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOG (compliance)
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID,
  user_id         UUID,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  before          JSONB,
  after           JSONB,
  ip              INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_org_date ON audit_logs(org_id, created_at DESC);
```

### 3.2 Row-Level Security (multi-tenant)

```sql
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
CREATE POLICY election_isolation ON elections
  USING (candidate_id IN (
    SELECT id FROM candidates WHERE org_id = current_setting('app.current_org_id')::UUID
  ));
-- Repetir para todas as tabelas com election_id
```

---

## 4. API REST — Endpoints principais

> Base URL: `https://api.mobiliza.app/v1`
> Autenticação: `Authorization: Bearer <jwt>`

### 4.1 Autenticação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/signup` | Cria org + admin |
| POST | `/auth/login` | Retorna JWT |
| POST | `/auth/refresh` | Renova JWT |
| POST | `/auth/forgot` | E-mail de recuperação |
| POST | `/auth/reset` | Define nova senha |

### 4.2 Candidato e eleição

```
GET    /candidates                Lista candidatos da org
POST   /candidates                Cria candidato
GET    /candidates/:id            Detalhes
PATCH  /candidates/:id            Atualiza
DELETE /candidates/:id            Remove

GET    /elections                 Lista eleições
POST   /elections                 Cria eleição
PATCH  /elections/:id             Atualiza (incluindo parâmetros multiplier/conversion)
```

### 4.3 Regiões, militância, agenda — CRUD padrão

```
GET    /elections/:id/regions
POST   /elections/:id/regions
PATCH  /regions/:id
DELETE /regions/:id

GET    /elections/:id/leaders?region=&status=
POST   /elections/:id/leaders
PATCH  /leaders/:id
DELETE /leaders/:id

GET    /elections/:id/militants?region=&leader=&status=&limit=&offset=
POST   /elections/:id/militants
POST   /elections/:id/militants/bulk    # importação via CSV/Excel
PATCH  /militants/:id
DELETE /militants/:id

GET    /elections/:id/events?from=&to=&type=
POST   /elections/:id/events
PATCH  /events/:id
DELETE /events/:id
POST   /events/:id/notify             # dispara notificações
```

### 4.4 Comunicação

```
GET    /elections/:id/templates
POST   /elections/:id/templates
PATCH  /templates/:id
DELETE /templates/:id
POST   /templates/:id/submit-whatsapp  # submete template ao Meta para aprovação

GET    /elections/:id/campaigns
POST   /elections/:id/campaigns
PATCH  /campaigns/:id
POST   /campaigns/:id/send             # dispara
POST   /campaigns/:id/cancel
GET    /campaigns/:id/messages         # detalhes de cada destinatário

POST   /webhook/whatsapp               # Meta envia status (entregue/lido/resposta)
POST   /webhook/twilio                 # Twilio envia status de SMS
POST   /webhook/sendgrid               # SendGrid envia bounces/opens
```

### 4.5 Social monitoring

```
GET    /elections/:id/social-keywords
POST   /elections/:id/social-keywords
DELETE /social-keywords/:id

GET    /elections/:id/social-mentions?sentiment=&platform=&from=&to=&region=
GET    /elections/:id/social-summary?period=24h|7d|30d
GET    /elections/:id/social-influencers?period=7d
GET    /elections/:id/social-alerts                 # alertas ativos
```

### 4.6 Inteligência

```
GET    /elections/:id/dashboard                     # KPIs consolidados
GET    /elections/:id/projection                    # cálculo de votos
GET    /elections/:id/projection/scenarios          # cenários simulados
POST   /elections/:id/projection/calculate          # recalcula com parâmetros custom

GET    /elections/:id/insights?status=active|done
POST   /elections/:id/insights/:id/dismiss
POST   /elections/:id/insights/:id/done
POST   /elections/:id/insights/generate             # força nova análise de IA

GET    /elections/:id/competitors
POST   /elections/:id/competitors
PATCH  /competitors/:id
```

### 4.7 Doações (compliance TSE)

```
POST   /elections/:id/donations          # cria intenção de doação
POST   /webhook/asaas                    # confirmação Pix/cartão
GET    /elections/:id/donations/report   # relatório formato TSE
```

### 4.8 Backup/Export

```
GET    /elections/:id/export             # JSON completo (mesma estrutura do app)
POST   /elections/:id/import             # importa JSON
```

---

## 5. Integrações externas

### 5.1 WhatsApp Business API (Meta)

- **Conta:** WhatsApp Business Account verificada pela Meta
- **Aprovação:** templates devem ser submetidos e aprovados antes do envio massivo
- **Limites:** tier inicial = 1.000 conversas/24h; escala conforme reputação
- **Custos:** ~R$ 0,09/mensagem ativa (varia por país e categoria)
- **Webhook:** receber status (entregue, lido, resposta) e mensagens inbound
- **Implementação:** SDK oficial Node `whatsapp-business-api` ou Cloud API REST
- **Compliance:** opt-in explícito obrigatório, opt-out fácil

### 5.2 Twilio (SMS)

- **Conta:** Twilio account + número brasileiro habilitado
- **Custos:** ~R$ 0,15/SMS
- **Long codes vs. short codes:** short codes têm melhor entrega mas custam mais

### 5.3 SendGrid (E-mail)

- **Plano:** Essentials ou Pro
- **Custos:** US$15-90/mês até 100k emails
- **Domínio verificado obrigatório** (SPF, DKIM, DMARC)

### 5.4 APIs de redes sociais

| Plataforma | API oficial | Limites | Observações |
|------------|-------------|---------|-------------|
| Instagram | Graph API | 200 req/h/user | Requer conta business |
| X/Twitter | X API v2 | US$100/mês básico | Limites severos |
| Facebook | Graph API | 200 req/h | Páginas públicas |
| TikTok | TikTok Research API | Acesso limitado | Aprovação manual |
| YouTube | YouTube Data API v3 | 10k units/dia | Free |
| Web/Portais | RSS + scraping | — | Cautela legal |

**Alternativa:** usar agregadores como **Brand24**, **Mentionlytics** ou **Talkwalker** (caros mas prontos).

### 5.5 TSE — Dados Abertos

- **Endpoint:** `https://dadosabertos.tse.jus.br/`
- **Conteúdo:** histórico eleitoral completo, prestação de contas, candidaturas
- **Atualização:** anual, com dados consolidados pós-eleição
- **Uso:** baseline para o cálculo de força por região + benchmark

### 5.6 ASAAS / Pix

- **Conta business** com CNPJ da campanha
- **Webhook:** confirmar transações
- **Compliance:** verificação de CPF, limite por doador (TSE), relatório oficial

### 5.7 OpenAI / Anthropic (IA)

- **Modelos sugeridos:**
  - GPT-4o ou Claude Sonnet para insights e briefings
  - text-embedding-3-large para embeddings de menções
  - Whisper para transcrição de áudio (entrevistas)
- **Custo estimado:** US$ 200-800/mês por campanha ativa

---

## 6. Cálculos de negócio

### 6.1 Projeção de votos (já implementada no app)

```python
votos_projetados = apoiadores_ativos × multiplier × conversion
```

### 6.2 Score de vitória (regra inicial; depois substituir por modelo ML)

```python
score = min(100, (votos_projetados / meta_votos) * 100)
```

### 6.3 Modelo preditivo avançado (Fase 2)

Treinar regressão (XGBoost) com features:
- Histórico TSE do candidato/partido na região
- Taxa de crescimento da base (90d)
- Sentimento médio (30d) ponderado por alcance
- Cobertura territorial (% regiões com liderança)
- Gap de comunicação (frequência de campanhas)
- Eventos negativos detectados (escândalo, fake news)
- Variáveis demográficas (IBGE)

Output: probabilidade calibrada de vitória (0-100) por cenário.

### 6.4 Sentimento

Pipeline:
1. Coletar menção via API/scraping
2. Pré-processar (clean, anonimizar dados pessoais)
3. Classificar com LLM ou modelo treinado (Hugging Face PT-BR)
4. Calcular score `-1.0 a 1.0`
5. Geolocalizar (regex de bairros + dados do perfil)
6. Indexar em pgvector para busca semântica
7. Gerar alertas se threshold for ultrapassado

### 6.5 Geração de insights

Job recorrente (a cada 6h) que:
1. Coleta estado atual (KPIs, mudanças desde última execução)
2. Monta prompt estruturado para LLM com regras de campanha eleitoral
3. LLM retorna lista de insights priorizados com score, urgência, plano em N passos
4. Filtra duplicados (similaridade > 0.85 via embedding)
5. Persiste em `insights`
6. Envia push pros usuários admin

---

## 7. Segurança & Compliance

### 7.1 LGPD

- **Consentimento explícito** (opt-in) registrado em `militants.opt_in_at`
- **Direito de exclusão**: endpoint `DELETE /militants/:id` purga dados + audit log
- **Portabilidade**: endpoint de export retorna todos os dados pessoais
- **CPF nunca armazenado em texto plano** — apenas hash SHA-256 com pepper
- **DPO designado** + relatório anual
- **Logs de acesso** a dados sensíveis

### 7.2 Justiça Eleitoral (TSE)

- **Limite de doações** verificado por CPF + ano calendário
- **Prestação de contas** com export no formato do Sistema de Prestação de Contas Eleitorais (SPCE)
- **Disparo de mensagens** com cadastro do tipo e identificação obrigatória "comunicação de campanha"
- **Sem disparo de propaganda paga via mensagens** (vedação TSE)

### 7.3 Segurança técnica

- **Criptografia em trânsito**: TLS 1.3 obrigatório
- **Criptografia em repouso**: AES-256 no banco e S3
- **Senhas**: Argon2id (não bcrypt)
- **2FA obrigatório** para admin e coordinator
- **Audit log imutável** (append-only)
- **Rate limit** por IP e por usuário
- **WAF** (Cloudflare) para mitigar bot/DDoS
- **Backups automáticos** diários, retenção 30 dias, georedundantes

---

## 8. Infraestrutura

### 8.1 Ambientes

- `dev` — local + Docker Compose
- `staging` — clone reduzido em produção
- `production` — alta disponibilidade

### 8.2 Produção (AWS São Paulo)

| Componente | Serviço | Configuração inicial |
|------------|---------|---------------------|
| API | ECS Fargate | 2 tasks × 1 vCPU / 2GB |
| Banco | RDS PostgreSQL | db.t4g.medium (Multi-AZ) |
| Cache | ElastiCache Redis | cache.t4g.small |
| Filas/Workers | ECS Fargate | 1 task × 2 vCPU / 4GB |
| Storage | S3 (SP) | versionamento ativo |
| CDN | CloudFront | cache estático |
| DNS | Route 53 | failover |
| Secrets | Secrets Manager | API keys |
| Monitoring | CloudWatch + Grafana | métricas + alertas |

**Custo estimado infra:** R$ 4.500 - 12.000/mês conforme carga.

### 8.3 CI/CD

- **GitHub Actions** com pipelines `test → build → deploy`
- **Migrations**: Flyway ou Prisma Migrate
- **Blue/green** deploy para zero downtime
- **Feature flags** com LaunchDarkly ou open source

---

## 9. Roadmap de implementação

### Fase 1 — MVP backend (Meses 1-3, R$ 280k)
- Setup infraestrutura + CI/CD
- Auth, users, candidatos, eleições, regiões
- CRUD militância completo
- Agenda + integração SendGrid (email)
- Dashboard com cálculos básicos
- Frontend conectado (substitui localStorage por API)

### Fase 2 — Comunicação real (Meses 4-6, R$ 220k)
- WhatsApp Business API integrada
- Twilio SMS
- Workers async com BullMQ
- Notificações push (FCM)
- Webhooks de status
- App mobile do militante (React Native)

### Fase 3 — Inteligência (Meses 7-9, R$ 320k)
- Coleta social (3 plataformas iniciais)
- Pipeline de sentimento com LLM
- Geração de insights por IA
- Modelo preditivo de vitória (XGBoost)
- Vector DB e busca semântica

### Fase 4 — Compliance & Expansão (Meses 10-12, R$ 180k)
- Doações Pix + relatório TSE
- Auditoria completa LGPD
- White-label
- Multi-eleição por org
- Painel pós-eleição (CRM de mandato)

**Total estimado:** R$ 1,0 milhão em 12 meses + custo operacional infra R$ 60-120k/mês a partir do mês 4.

---

## 10. Equipe sugerida

| Papel | Quantidade | Quando entra |
|-------|-----------|--------------|
| Tech Lead | 1 | Mês 1 |
| Backend Engineer | 2 | Mês 1 |
| Frontend Engineer | 2 | Mês 1 |
| Mobile Engineer | 1 | Mês 4 |
| Data/ML Engineer | 1 | Mês 6 |
| Designer Sr | 1 | Mês 1 |
| DevOps | 1 (part-time) | Mês 1 |
| QA | 1 | Mês 3 |
| PM/Owner | 1 | Mês 1 |

---

## 11. Como o frontend atual conecta ao backend

O app standalone (`MOBILIZA_App.html`) usa `localStorage` com chave `mobiliza_data_v1`. Para conectar ao backend:

1. **Substituir a camada de storage** (`loadState` / `saveState`) por chamadas HTTP autenticadas
2. **Cada entidade** vira chamada async para o endpoint correspondente
3. **Cache local** com SWR ou React Query para offline-first
4. **Export JSON existente** se mapeia 1:1 com o schema do banco — útil para importação inicial

```javascript
// Substituir
function loadState(){ return JSON.parse(localStorage.getItem(KEY)) }
// Por
async function loadState(){
  const res = await fetch('/api/v1/elections/current', { headers:authHeader() });
  return res.json();
}
```

---

## 12. Próximos passos

1. **Validar** este documento com candidato + 1 dev sênior
2. **Detalhar** cada endpoint em OpenAPI 3.1 (Swagger)
3. **Wireframes** completos de telas que faltam (painel admin de superuser, app militante)
4. **Pilot** com 1 candidato real em campanha pequena (vereador) para validar fluxo
5. **Iteração rápida** com feedback diário durante o piloto
6. **Lançamento** alinhado com janela eleitoral mais próxima

---

*Documento vivo — atualizar a cada sprint do desenvolvimento.*
