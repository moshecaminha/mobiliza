/**
 * MOBILIZA · Backend de Produção
 * ==================================================
 * Node.js + Express + PostgreSQL + JWT
 *
 * - Multi-tenant via org_id
 * - Autenticação OTP (SMS + email) com Twilio e SendGrid
 * - APIs sociais reais (YouTube, X, Meta, RSS)
 * - Rate limiting + CORS + Helmet (segurança básica)
 * - Logs estruturados
 *
 * RODAR LOCAL:
 *   npm install
 *   npm run migrate     # cria tabelas
 *   npm start
 *
 * VARIÁVEIS OBRIGATÓRIAS (.env):
 *   DATABASE_URL=postgres://user:pass@host:5432/mobiliza
 *   JWT_SECRET=segredo_aleatorio_de_64_chars
 *   PORT=3001
 *
 * VARIÁVEIS OPCIONAIS:
 *   ALLOWED_ORIGIN=https://app.mobiliza.com.br  (CORS)
 *   YOUTUBE_API_KEY=
 *   TWITTER_BEARER_TOKEN=
 *   META_ACCESS_TOKEN=
 *   TWILIO_ACCOUNT_SID= TWILIO_AUTH_TOKEN= TWILIO_FROM_NUMBER=
 *   SENDGRID_API_KEY= EMAIL_FROM=
 *   OPENAI_API_KEY=
 *   NODE_ENV=production
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// ============ CONFIG ============
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.DATABASE_URL) {
  console.error('ERRO: DATABASE_URL não configurada. Veja .env.example');
  process.exit(1);
}
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('ERRO: JWT_SECRET obrigatório em produção');
  process.exit(1);
}

// ============ DATABASE ============
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

async function db(sql, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(sql, params);
    if (NODE_ENV === 'development') console.log(`[SQL ${Date.now() - start}ms]`, sql.slice(0, 80));
    return res;
  } catch (e) {
    console.error('DB error:', e.message, sql);
    throw e;
  }
}

// ============ APP ============
const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.set('trust proxy', 1);

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// ============ AUTH MIDDLEWARE ============
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ error: 'token ausente' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'token inválido ou expirado' });
  }
}

// ============ HELPERS ============
const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);
const hashCode = (code, salt) => crypto.createHash('sha256').update(code + salt).digest('hex');

async function sendSmsCode(to, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const phone = to.replace(/\D/g, '').replace(/^0+/, '');
    const finalPhone = phone.startsWith('55') ? '+' + phone : '+55' + phone;
    const body = new URLSearchParams({
      To: finalPhone,
      From: from,
      Body: `MOBILIZA - seu codigo de acesso e ${code}. Expira em 10 minutos.`,
    });
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) log('Twilio error:', r.status, await r.text());
    return r.ok;
  } catch (e) { log('SMS error:', e.message); return false; }
}

async function sendEmailCode(to, code) {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@mobiliza.app';
  if (!key) return false;
  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: 'MOBILIZA' },
        subject: `Codigo de acesso · ${code}`,
        content: [{
          type: 'text/html',
          value: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:30px;background:#f5f7fa">
            <div style="background:#fff;border-radius:12px;padding:30px">
              <h2 style="color:#0A1628;margin:0">MOBILIZA</h2>
              <p style="color:#475569">Seu código de acesso é:</p>
              <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00A878;background:#F0FDF4;padding:18px;text-align:center;border-radius:10px;font-family:monospace;margin:20px 0">${code}</div>
              <p style="color:#64748B;font-size:13px">Este código expira em 10 minutos.</p>
              <p style="color:#94A3B8;font-size:12px;margin-top:20px">Se você não solicitou, ignore este e-mail.</p>
            </div>
          </div>`
        }],
      }),
    });
    return r.ok;
  } catch (e) { log('Email error:', e.message); return false; }
}

// ============ HEALTH ============
app.get('/api/status', async (req, res) => {
  try {
    const r = await db('SELECT NOW() AS now');
    res.json({
      ok: true,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: 'connected',
      dbTime: r.rows[0].now,
      platforms: {
        youtube: !!process.env.YOUTUBE_API_KEY,
        twitter: !!process.env.TWITTER_BEARER_TOKEN,
        meta: !!process.env.META_ACCESS_TOKEN,
        sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        email: !!process.env.SENDGRID_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
      },
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'database offline' });
  }
});

// ============ PÚBLICO: auto-cadastro via QR / link de convite ============
// Não requer autenticação. Rate-limited pelo generalLimiter global.
app.get('/api/public/leader/:leaderId', async (req, res) => {
  try {
    const r = await db(`
      SELECT l.id, l.name, l.role, l.region_id, l.election_id,
             r.name AS region_name,
             c.name AS candidate_name, c.party AS candidate_party
      FROM leaders l
      LEFT JOIN regions r ON r.id = l.region_id
      JOIN elections e ON e.id = l.election_id
      JOIN candidates c ON c.id = e.candidate_id
      WHERE l.id = $1 AND l.deleted = FALSE
      LIMIT 1
    `, [req.params.leaderId]);
    if (!r.rows.length) return res.status(404).json({ error: 'liderança não encontrada' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/public/join/:leaderId', async (req, res) => {
  try {
    const { name, phone, email, notes } = req.body || {};
    if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'nome obrigatório' });
    if (!phone || String(phone).trim().length < 8) return res.status(400).json({ error: 'WhatsApp obrigatório' });
    // Localiza liderança e escopo
    const lr = await db(`
      SELECT l.id, l.election_id, l.region_id
      FROM leaders l
      WHERE l.id = $1 AND l.deleted = FALSE
      LIMIT 1
    `, [req.params.leaderId]);
    if (!lr.rows.length) return res.status(404).json({ error: 'liderança não encontrada' });
    const leader = lr.rows[0];
    // Anti-duplicata simples: mesmo telefone na mesma eleição
    const normPhone = String(phone).replace(/\D/g, '');
    const dup = await db(`
      SELECT id FROM militants
      WHERE election_id = $1 AND regexp_replace(phone, '\\D', '', 'g') = $2 AND deleted = FALSE
      LIMIT 1
    `, [leader.election_id, normPhone]);
    if (dup.rows.length) return res.status(200).json({ ok: true, duplicate: true, message: 'Você já está cadastrado. Obrigado!' });
    const ins = await db(`
      INSERT INTO militants (election_id, region_id, leader_id, name, phone, email, status, source, opt_in)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', 'qr_public', TRUE)
      RETURNING id, name
    `, [leader.election_id, leader.region_id, leader.id, String(name).trim(), String(phone).trim(), (email || '').trim() || null]);
    log(`Public join: militant ${ins.rows[0].id} joined leader ${leader.id}`);
    res.status(201).json({ ok: true, id: ins.rows[0].id, message: 'Cadastro confirmado' });
  } catch (e) {
    log('Public join error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ============ AUTH (OTP) ============
app.post('/api/auth/send-code', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ error: 'email e phone obrigatórios' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'email inválido' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = hashCode(code, JWT_SECRET);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db(`INSERT INTO otp_codes (email, phone, code_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [email, phone, codeHash, expiresAt]);

  const [emailSent, smsSent] = await Promise.all([
    sendEmailCode(email, code),
    sendSmsCode(phone, code),
  ]);

  log(`OTP generated for ${email}/${phone} · email=${emailSent} sms=${smsSent}`);

  res.json({
    ok: true,
    emailSent,
    smsSent,
    expiresIn: 600,
    // Em desenvolvimento, retorna o código para debug. Em produção, NUNCA.
    code: NODE_ENV === 'development' ? code : undefined,
  });
});

app.post('/api/auth/verify-code', async (req, res) => {
  const { email, phone, code } = req.body;
  if (!email || !phone || !code) return res.status(400).json({ valid: false, error: 'campos obrigatórios' });

  // Código teste 123456 sempre aceito em dev/staging
  if (code === '123456' && NODE_ENV !== 'production') {
    const token = await issueTokenForUser(email, phone);
    return res.json({ valid: true, mode: 'test', token });
  }

  const codeHash = hashCode(code, JWT_SECRET);
  const r = await db(
    `SELECT id FROM otp_codes
     WHERE email=$1 AND phone=$2 AND code_hash=$3
       AND used=FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, phone, codeHash]
  );

  if (r.rows.length === 0) return res.json({ valid: false, error: 'código incorreto ou expirado' });

  await db(`UPDATE otp_codes SET used=TRUE WHERE id=$1`, [r.rows[0].id]);
  const token = await issueTokenForUser(email, phone);
  res.json({ valid: true, mode: 'real', token });
});

async function issueTokenForUser(email, phone) {
  // Encontra ou cria usuário + org
  let userR = await db(`SELECT id, org_id, name, role FROM users WHERE email=$1 LIMIT 1`, [email]);
  let userId, orgId;
  if (userR.rows.length === 0) {
    // Novo usuário: cria org + user (primeira pessoa vira admin)
    const orgR = await db(`INSERT INTO organizations (name, plan) VALUES ($1, 'starter') RETURNING id`, [email]);
    orgId = orgR.rows[0].id;
    const newU = await db(
      `INSERT INTO users (org_id, email, phone, role) VALUES ($1,$2,$3,'admin') RETURNING id`,
      [orgId, email, phone]
    );
    userId = newU.rows[0].id;
  } else {
    userId = userR.rows[0].id;
    orgId = userR.rows[0].org_id;
    await db(`UPDATE users SET last_login_at=NOW(), phone=COALESCE($2, phone) WHERE id=$1`, [userId, phone]);
  }
  return jwt.sign({ userId, orgId, email }, JWT_SECRET, { expiresIn: '30d' });
}

app.get('/api/auth/me', authRequired, async (req, res) => {
  const r = await db(`SELECT u.*, o.name AS org_name, o.plan FROM users u LEFT JOIN organizations o ON o.id=u.org_id WHERE u.id=$1`, [req.user.userId]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'usuário não encontrado' });
  res.json(r.rows[0]);
});

// ============ CRUD GENÉRICO ============
// Mapeia entidades para tabelas e colunas permitidas
const ENTITIES = {
  candidates: { table: 'candidates', orgScoped: true, fields: ['name','party','party_sigla','party_number','photo_url','color','bio'] },
  elections: { table: 'elections', parentTable: 'candidates', parentColumn: 'candidate_id', fields: ['level','position','city','state','ibge_code','date','voter_count','victory_target','multiplier','conversion'] },
  regions: { table: 'regions', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['name','parent_id','voter_count','intensity','ibge_code','microregiao','notes'] },
  leaders: { table: 'leaders', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['region_id','user_id','name','phone','email','role','status','contacts_goal','contacts_made','notes'] },
  militants: { table: 'militants', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['region_id','leader_id','name','phone','email','cpf_hash','status','source','opt_in'] },
  events: { table: 'events', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['title','date','time','location','type','description','notify_email','notify_sms','notify_push'] },
  templates: { table: 'message_templates', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['name','content','preview','channel','status'] },
  campaigns: { table: 'campaigns', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['template_id','name','channel','segments','message','scheduled_at','status','reach','cost_brl'] },
  competitors: { table: 'competitors', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['name','party','party_number','color','current_score','notes'] },
  social_keywords: { table: 'social_keywords', parentTable: 'elections', parentColumn: 'election_id', soft: true, fields: ['term','type','alert_enabled','alert_threshold'] },
  insights: { table: 'insights', parentTable: 'elections', parentColumn: 'election_id', fields: ['score','urgency','category','color','title','description','steps','related_entities','generated_by'] },
};

function pickFields(entity, body) {
  const allowed = ENTITIES[entity].fields;
  const out = {};
  allowed.forEach(f => { if (body[f] !== undefined) out[f] = body[f]; });
  return out;
}

async function checkOrgAccess(userId, electionId) {
  const r = await db(`
    SELECT 1 FROM elections e
    JOIN candidates c ON c.id = e.candidate_id
    JOIN users u ON u.org_id = c.org_id
    WHERE u.id = $1 AND e.id = $2
  `, [userId, electionId]);
  return r.rows.length > 0;
}

// GET /api/:entity/:parentId? — lista
app.get('/api/:entity', authRequired, async (req, res) => {
  const ent = ENTITIES[req.params.entity];
  if (!ent) return res.status(404).json({ error: 'entidade desconhecida' });
  let sql, params;
  if (ent.orgScoped) {
    sql = `SELECT * FROM ${ent.table} WHERE org_id=$1 ORDER BY created_at DESC`;
    params = [req.user.orgId];
  } else if (ent.parentTable === 'elections') {
    const { election_id } = req.query;
    if (!election_id) return res.status(400).json({ error: 'election_id obrigatório' });
    if (!(await checkOrgAccess(req.user.userId, election_id))) return res.status(403).json({ error: 'sem acesso' });
    sql = `SELECT * FROM ${ent.table} WHERE ${ent.parentColumn}=$1 ${ent.soft ? 'AND deleted=FALSE' : ''} ORDER BY created_at DESC`;
    params = [election_id];
  } else {
    const { candidate_id } = req.query;
    if (!candidate_id) return res.status(400).json({ error: 'candidate_id obrigatório' });
    sql = `SELECT * FROM ${ent.table} WHERE ${ent.parentColumn}=$1 ORDER BY created_at DESC`;
    params = [candidate_id];
  }
  const r = await db(sql, params);
  res.json(r.rows);
});

// POST /api/:entity — cria
app.post('/api/:entity', authRequired, async (req, res) => {
  const ent = ENTITIES[req.params.entity];
  if (!ent) return res.status(404).json({ error: 'entidade desconhecida' });
  const data = pickFields(req.params.entity, req.body);
  let cols, values, placeholders;
  if (ent.orgScoped) {
    cols = ['org_id', ...Object.keys(data)];
    values = [req.user.orgId, ...Object.values(data)];
  } else {
    const parentId = req.body[ent.parentColumn];
    if (!parentId) return res.status(400).json({ error: ent.parentColumn + ' obrigatório' });
    cols = [ent.parentColumn, ...Object.keys(data)];
    values = [parentId, ...Object.values(data)];
  }
  placeholders = values.map((_, i) => `$${i+1}`);
  const sql = `INSERT INTO ${ent.table} (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
  try {
    const r = await db(sql, values);
    await logAudit(req, 'create', req.params.entity, r.rows[0].id, null, r.rows[0]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    log('Create error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/:entity/:id — atualiza
app.patch('/api/:entity/:id', authRequired, async (req, res) => {
  const ent = ENTITIES[req.params.entity];
  if (!ent) return res.status(404).json({ error: 'entidade desconhecida' });
  const data = pickFields(req.params.entity, req.body);
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'sem campos para atualizar' });
  const setClause = Object.keys(data).map((k, i) => `${k}=$${i+2}`).join(', ');
  const sql = `UPDATE ${ent.table} SET ${setClause} WHERE id=$1 RETURNING *`;
  const r = await db(sql, [req.params.id, ...Object.values(data)]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'não encontrado' });
  await logAudit(req, 'update', req.params.entity, req.params.id, null, r.rows[0]);
  res.json(r.rows[0]);
});

// DELETE /api/:entity/:id — soft delete (ou hard se ?permanent=true)
app.delete('/api/:entity/:id', authRequired, async (req, res) => {
  const ent = ENTITIES[req.params.entity];
  if (!ent) return res.status(404).json({ error: 'entidade desconhecida' });
  let sql;
  if (ent.soft && req.query.permanent !== 'true') {
    sql = `UPDATE ${ent.table} SET deleted=TRUE, deleted_at=NOW() WHERE id=$1 RETURNING id`;
  } else {
    sql = `DELETE FROM ${ent.table} WHERE id=$1 RETURNING id`;
  }
  const r = await db(sql, [req.params.id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'não encontrado' });
  await logAudit(req, ent.soft && req.query.permanent !== 'true' ? 'soft_delete' : 'hard_delete', req.params.entity, req.params.id, null, null);
  res.json({ ok: true });
});

// POST /api/:entity/:id/restore — restaurar do soft delete
app.post('/api/:entity/:id/restore', authRequired, async (req, res) => {
  const ent = ENTITIES[req.params.entity];
  if (!ent || !ent.soft) return res.status(404).json({ error: 'não restaurável' });
  const r = await db(`UPDATE ${ent.table} SET deleted=FALSE, deleted_at=NULL WHERE id=$1 RETURNING *`, [req.params.id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'não encontrado' });
  await logAudit(req, 'restore', req.params.entity, req.params.id, null, r.rows[0]);
  res.json(r.rows[0]);
});

async function logAudit(req, action, entity, entityId, before, after) {
  try {
    await db(`INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, before_data, after_data, ip, user_agent)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [req.user.orgId, req.user.userId, action, entity, entityId, before, after, req.ip, req.headers['user-agent']]);
  } catch (e) { log('Audit error:', e.message); }
}

// ============ IMPORTAÇÃO DO LOCALSTORAGE ============
app.post('/api/import', authRequired, async (req, res) => {
  const data = req.body;
  if (!data.candidate) return res.status(400).json({ error: 'JSON inválido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query(
      `INSERT INTO candidates (org_id, name, party, party_sigla, party_number, color, bio) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.user.orgId, data.candidate.name, data.candidate.party, data.candidate.partyNumberSigla, data.candidate.partyNumber, data.candidate.color, data.candidate.bio]
    );
    const candidateId = c.rows[0].id;
    const e = await client.query(
      `INSERT INTO elections (candidate_id, level, position, city, state, date, voter_count, victory_target, multiplier, conversion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [candidateId, data.election.level, data.election.position, data.election.city, data.election.state, data.election.date || null, data.election.voterCount, data.election.victoryTarget, data.parameters?.multiplier || 4.2, data.parameters?.conversion || 0.71]
    );
    const electionId = e.rows[0].id;
    const regionMap = {};
    for (const r of (data.regions || [])) {
      const ins = await client.query(`INSERT INTO regions (election_id, name, voter_count, intensity, notes) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [electionId, r.name, r.voterCount || 0, r.intensity || 50, r.notes || '']);
      regionMap[r.id] = ins.rows[0].id;
    }
    for (const l of (data.leaders || [])) {
      await client.query(`INSERT INTO leaders (election_id, region_id, name, phone, email, role, status, contacts_goal, contacts_made, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [electionId, regionMap[l.regionId] || null, l.name, l.phone || '', l.email || '', l.role || 'bairro', l.status || 'active', l.contactsGoal || 0, l.contactsMade || 0, l.notes || '']);
    }
    for (const m of (data.militants || [])) {
      await client.query(`INSERT INTO militants (election_id, region_id, name, phone, email, status, source) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [electionId, regionMap[m.regionId] || null, m.name, m.phone || '', m.email || '', m.status || 'active', m.source || 'import']);
    }
    await client.query('COMMIT');
    res.json({ ok: true, candidate_id: candidateId, election_id: electionId, imported: { regions: data.regions?.length || 0, leaders: data.leaders?.length || 0, militants: data.militants?.length || 0 } });
  } catch (e) {
    await client.query('ROLLBACK');
    log('Import error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ============ EXPORTAÇÃO (backup do usuário) ============
app.get('/api/export/:electionId', authRequired, async (req, res) => {
  const eid = req.params.electionId;
  if (!(await checkOrgAccess(req.user.userId, eid))) return res.status(403).json({ error: 'sem acesso' });
  const [election, regions, leaders, militants, events, templates, campaigns, competitors, keywords, insights] = await Promise.all([
    db('SELECT e.*, c.* FROM elections e JOIN candidates c ON c.id=e.candidate_id WHERE e.id=$1', [eid]).then(r => r.rows[0]),
    db('SELECT * FROM regions WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM leaders WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM militants WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM events WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM message_templates WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM campaigns WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM competitors WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM social_keywords WHERE election_id=$1', [eid]).then(r => r.rows),
    db('SELECT * FROM insights WHERE election_id=$1', [eid]).then(r => r.rows),
  ]);
  res.json({ election, regions, leaders, militants, events, templates, campaigns, competitors, keywords, insights, exportedAt: new Date().toISOString() });
});

// ============ SOCIAL APIS (reaproveitando do MOBILIZA_Backend_Social.js) ============
app.get('/api/social/youtube', async (req, res) => {
  const { q } = req.query;
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !q) return res.json({ items: [] });
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&order=date&relevanceLanguage=pt&key=${key}`);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    const items = (data.items || []).map(item => ({
      id: 'yt-' + item.id.videoId, src: 'yt', acct: item.snippet.channelTitle,
      txt: item.snippet.title + ' — ' + (item.snippet.description || '').slice(0, 140),
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      ts: new Date(item.snippet.publishedAt).getTime(), sent: 'neu', kw: q,
    }));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message, items: [] }); }
});

app.get('/api/social/twitter', async (req, res) => {
  const { q } = req.query;
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token || !q) return res.json({ items: [] });
  try {
    const r = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q + ' lang:pt -is:retweet')}&max_results=10&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('X API ' + r.status);
    const data = await r.json();
    const users = {}; (data.includes?.users || []).forEach(u => users[u.id] = u);
    const items = (data.data || []).map(t => ({
      id: 'tw-' + t.id, src: 'tw', acct: '@' + (users[t.author_id]?.username || 'user'),
      txt: t.text, url: `https://x.com/${users[t.author_id]?.username}/status/${t.id}`,
      ts: new Date(t.created_at).getTime(), sent: 'neu', kw: q,
    }));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message, items: [] }); }
});

// (Endpoints RSS, Instagram, Facebook, TikTok podem ser portados do MOBILIZA_Backend_Social.js)

// ============ ERRO GLOBAL ============
app.use((err, req, res, next) => {
  log('Unhandled:', err);
  res.status(500).json({ error: NODE_ENV === 'production' ? 'erro interno' : err.message });
});

app.get('/', (req, res) => res.json({ name: 'MOBILIZA API', version: '1.0', docs: '/api/status' }));

// ============ START ============
app.listen(PORT, () => {
  log('═══════════════════════════════════════════════');
  log(`  MOBILIZA Backend ${NODE_ENV.toUpperCase()}`);
  log(`  http://localhost:${PORT}`);
  log(`  DB: ${process.env.DATABASE_URL.replace(/:[^:]+@/, ':***@')}`);
  log(`  CORS allowed: ${ALLOWED_ORIGIN}`);
  log('═══════════════════════════════════════════════');
});
