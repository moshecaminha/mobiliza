-- ============================================================
-- MOBILIZA · Schema PostgreSQL (produção)
-- ============================================================
-- Multi-tenant: cada organização tem seus dados isolados via org_id
-- Compatível com PostgreSQL 14+
-- Roda em Railway, Supabase, Neon, RDS, qualquer Postgres

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- busca por texto

-- ============ ORGANIZAÇÕES (multi-tenant root) ============
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ USUÁRIOS ============
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','coordinator','staff','militant','viewer')),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);

-- ============ OTP (códigos de verificação) ============
CREATE TABLE IF NOT EXISTS otp_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT,
  phone         TEXT,
  code_hash     TEXT NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_otp_email_phone ON otp_codes(email, phone) WHERE used = FALSE;
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);

-- ============ CANDIDATO + ELEIÇÃO ============
CREATE TABLE IF NOT EXISTS candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party           TEXT,
  party_sigla     TEXT,
  party_number    TEXT,
  photo_url       TEXT,
  color           TEXT DEFAULT '#00C896',
  bio             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_candidates_org ON candidates(org_id);

CREATE TABLE IF NOT EXISTS elections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  level           TEXT NOT NULL CHECK (level IN ('municipal','estadual','federal','presidencial')),
  position        TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  ibge_code       TEXT,
  date            DATE,
  voter_count     INT,
  victory_target  INT,
  multiplier      NUMERIC(4,2) DEFAULT 4.20,
  conversion      NUMERIC(4,3) DEFAULT 0.710,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_elections_candidate ON elections(candidate_id);

-- ============ REGIÕES ============
CREATE TABLE IF NOT EXISTS regions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES regions(id),
  voter_count     INT DEFAULT 0,
  intensity       INT NOT NULL DEFAULT 50 CHECK (intensity BETWEEN 0 AND 100),
  ibge_code       TEXT,
  microregiao     TEXT,
  notes           TEXT,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_regions_election ON regions(election_id) WHERE NOT deleted;
CREATE INDEX idx_regions_name_trgm ON regions USING gin (name gin_trgm_ops);

-- ============ LIDERANÇAS ============
CREATE TABLE IF NOT EXISTS leaders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  role            TEXT CHECK (role IN ('regional','bairro','outra')) DEFAULT 'bairro',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  contacts_goal   INT DEFAULT 0,
  contacts_made   INT DEFAULT 0,
  notes           TEXT,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_leaders_election ON leaders(election_id) WHERE NOT deleted;
CREATE INDEX idx_leaders_region ON leaders(region_id) WHERE NOT deleted;

-- ============ MILITANTES ============
CREATE TABLE IF NOT EXISTS militants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  region_id       UUID REFERENCES regions(id) ON DELETE SET NULL,
  leader_id       UUID REFERENCES leaders(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  cpf_hash        TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  source          TEXT,
  opt_in          BOOLEAN NOT NULL DEFAULT TRUE,
  opt_in_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_militants_election ON militants(election_id) WHERE NOT deleted;
CREATE INDEX idx_militants_region ON militants(region_id) WHERE NOT deleted;
CREATE INDEX idx_militants_leader ON militants(leader_id) WHERE NOT deleted;

-- ============ EVENTOS ============
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  date            DATE NOT NULL,
  time            TIME,
  location        TEXT,
  type            TEXT CHECK (type IN ('publico','midia','interno','pessoal')) DEFAULT 'publico',
  description     TEXT,
  notify_email    BOOLEAN DEFAULT FALSE,
  notify_sms      BOOLEAN DEFAULT FALSE,
  notify_push     BOOLEAN DEFAULT FALSE,
  notified_at     TIMESTAMPTZ,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_election_date ON events(election_id, date) WHERE NOT deleted;

-- ============ TEMPLATES + CAMPANHAS ============
CREATE TABLE IF NOT EXISTS message_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  content         TEXT NOT NULL,
  preview         TEXT,
  channel         TEXT,
  meta_template_id TEXT,
  status          TEXT DEFAULT 'draft',
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_templates_election ON message_templates(election_id) WHERE NOT deleted;

CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp','sms','email','push','multi')),
  segments        JSONB DEFAULT '{}',
  message         TEXT,
  scheduled_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','canceled')),
  reach           INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count      INT DEFAULT 0,
  replied_count   INT DEFAULT 0,
  cost_brl        NUMERIC(10,2),
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX idx_campaigns_election ON campaigns(election_id) WHERE NOT deleted;

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  militant_id     UUID REFERENCES militants(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  to_address      TEXT,
  status          TEXT,
  provider_id     TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  reply_content   TEXT,
  error           TEXT
);
CREATE INDEX idx_messages_campaign ON messages(campaign_id);
CREATE INDEX idx_messages_militant ON messages(militant_id);

-- ============ RADAR SOCIAL ============
CREATE TABLE IF NOT EXISTS social_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  term            TEXT NOT NULL,
  type            TEXT CHECK (type IN ('candidato','adversario','partido','tema')) DEFAULT 'tema',
  alert_enabled   BOOLEAN DEFAULT FALSE,
  alert_threshold INT DEFAULT 200,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_keywords_election ON social_keywords(election_id) WHERE NOT deleted;

CREATE TABLE IF NOT EXISTS social_mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  keyword_id      UUID REFERENCES social_keywords(id) ON DELETE SET NULL,
  platform        TEXT CHECK (platform IN ('instagram','twitter','facebook','tiktok','youtube','web','telegram')),
  source_url      TEXT,
  author_handle   TEXT,
  author_followers INT,
  content         TEXT NOT NULL,
  sentiment       TEXT CHECK (sentiment IN ('pos','neg','neu')),
  sentiment_score NUMERIC(3,2),
  region_id       UUID REFERENCES regions(id),
  reach           INT DEFAULT 0,
  engagement      INT DEFAULT 0,
  posted_at       TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mentions_election_date ON social_mentions(election_id, collected_at DESC);
CREATE INDEX idx_mentions_keyword ON social_mentions(keyword_id);
CREATE INDEX idx_mentions_content_trgm ON social_mentions USING gin (content gin_trgm_ops);

-- ============ ADVERSÁRIOS ============
CREATE TABLE IF NOT EXISTS competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party           TEXT,
  party_number    TEXT,
  color           TEXT,
  current_score   INT DEFAULT 10,
  history         JSONB DEFAULT '[]',
  notes           TEXT,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_competitors_election ON competitors(election_id) WHERE NOT deleted;

-- ============ IA INSIGHTS ============
CREATE TABLE IF NOT EXISTS insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  score           INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  urgency         TEXT,
  category        TEXT,
  color           TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  steps           JSONB DEFAULT '[]',
  related_entities JSONB DEFAULT '{}',
  generated_by    TEXT DEFAULT 'rules',
  dismissed_at    TIMESTAMPTZ,
  done_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_insights_election ON insights(election_id) WHERE dismissed_at IS NULL;

-- ============ AUDIT LOG ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID,
  user_id       UUID,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  before_data   JSONB,
  after_data    JSONB,
  ip            INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org_date ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============ DRAFTS (autosave) ============
CREATE TABLE IF NOT EXISTS user_drafts (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_key     TEXT NOT NULL,
  data          JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, draft_key)
);

-- ============ DOAÇÕES ============
CREATE TABLE IF NOT EXISTS donations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id     UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  amount_brl      NUMERIC(10,2) NOT NULL,
  donor_name      TEXT,
  donor_cpf_hash  TEXT,
  donor_phone     TEXT,
  donor_email     TEXT,
  method          TEXT CHECK (method IN ('pix','card','boleto')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','refused','refunded')),
  provider_id     TEXT UNIQUE,
  provider        TEXT,
  tse_reported    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);
CREATE INDEX idx_donations_election ON donations(election_id);

-- ============ TRIGGERS para updated_at ============
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER tr_candidates_upd BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER tr_leaders_upd BEFORE UPDATE ON leaders FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============ VIEWS úteis ============
CREATE OR REPLACE VIEW v_active_leaders AS
  SELECT * FROM leaders WHERE NOT deleted;

CREATE OR REPLACE VIEW v_active_militants AS
  SELECT * FROM militants WHERE NOT deleted;

CREATE OR REPLACE VIEW v_election_summary AS
  SELECT
    e.id AS election_id,
    e.position, e.city, e.state, e.voter_count, e.victory_target,
    c.name AS candidate_name, c.party,
    (SELECT COUNT(*) FROM regions r WHERE r.election_id = e.id AND NOT r.deleted) AS regions_count,
    (SELECT COUNT(*) FROM leaders l WHERE l.election_id = e.id AND NOT l.deleted) AS leaders_count,
    (SELECT COUNT(*) FROM militants m WHERE m.election_id = e.id AND NOT m.deleted) AS militants_count
  FROM elections e JOIN candidates c ON c.id = e.candidate_id;
