/**
 * MOBILIZA — Backend para integração com APIs sociais
 * ===================================================
 *
 * Servidor Node.js que conecta o radar social a:
 *   - YouTube Data API v3
 *   - X (Twitter) API v2
 *   - Instagram Graph API
 *   - Facebook Graph API
 *   - TikTok Display API (limitado)
 *   - RSS feeds (blogs/portais)
 *
 * COMO RODAR:
 *   1. Instale Node.js 18+ em https://nodejs.org
 *   2. Coloque este arquivo numa pasta junto com package.json
 *   3. Abra terminal na pasta e rode:
 *        npm install
 *        node MOBILIZA_Backend_Social.js
 *   4. No app MOBILIZA, vá em Configurações → Conectar APIs
 *      e cole a URL: http://localhost:3001
 *
 * CONFIGURAR API KEYS:
 *   Crie arquivo .env na mesma pasta com:
 *     YOUTUBE_API_KEY=AIzaSy...
 *     TWITTER_BEARER_TOKEN=AAAA...
 *     META_ACCESS_TOKEN=EAAB...   (Instagram + Facebook)
 *     TIKTOK_ACCESS_TOKEN=...
 *     PORT=3001
 *
 * Obs: APIs como X (paga $100+/mês), Instagram/Facebook (Meta Business
 * verification obrigatória) e TikTok (Research API por aprovação)
 * requerem registros e custos específicos.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

const KEYS = {
  youtube: process.env.YOUTUBE_API_KEY || '',
  twitter: process.env.TWITTER_BEARER_TOKEN || '',
  meta: process.env.META_ACCESS_TOKEN || '',
  tiktok: process.env.TIKTOK_ACCESS_TOKEN || '',
  twilio_sid: process.env.TWILIO_ACCOUNT_SID || '',
  twilio_token: process.env.TWILIO_AUTH_TOKEN || '',
  twilio_from: process.env.TWILIO_FROM_NUMBER || '',
  sendgrid: process.env.SENDGRID_API_KEY || '',
  email_from: process.env.EMAIL_FROM || 'noreply@mobiliza.app',
};

// In-memory storage de códigos OTP (em produção, usar Redis)
const otpStore = new Map();
function genOtp(){ return String(Math.floor(100000 + Math.random()*900000)); }

app.use(cors());
app.use(express.json());

// ============ STATUS ============
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    version: '1.1',
    timestamp: new Date().toISOString(),
    platforms: {
      youtube: !!KEYS.youtube,
      twitter: !!KEYS.twitter,
      instagram: !!KEYS.meta,
      facebook: !!KEYS.meta,
      tiktok: !!KEYS.tiktok,
      blogs: true,
    },
    auth: {
      twilio: !!(KEYS.twilio_sid && KEYS.twilio_token && KEYS.twilio_from),
      sendgrid: !!KEYS.sendgrid,
    }
  });
});

// ============ AUTH (envio + verificação de código OTP) ============
async function sendEmailCode(to, code){
  if(!KEYS.sendgrid) return false;
  try {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEYS.sendgrid}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: KEYS.email_from, name: 'MOBILIZA' },
        subject: `Seu código de acesso · ${code}`,
        content: [{
          type: 'text/html',
          value: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:30px">
            <h2 style="color:#0A1628">MOBILIZA</h2>
            <p>Seu código de acesso é:</p>
            <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00A878;background:#F0FDF4;padding:18px;text-align:center;border-radius:10px;font-family:monospace">${code}</div>
            <p style="color:#64748B;font-size:13px;margin-top:20px">Este código expira em 10 minutos. Se você não solicitou, ignore este e-mail.</p>
          </div>`
        }],
      }),
    });
    return r.ok;
  } catch (e) { console.error('SendGrid:', e.message); return false; }
}

async function sendSmsCode(to, code){
  if(!KEYS.twilio_sid || !KEYS.twilio_token || !KEYS.twilio_from) return false;
  try {
    const auth = Buffer.from(`${KEYS.twilio_sid}:${KEYS.twilio_token}`).toString('base64');
    const phone = to.replace(/\D/g,'').replace(/^0+/,'');
    const finalPhone = phone.startsWith('55') ? '+' + phone : '+55' + phone;
    const body = new URLSearchParams({
      To: finalPhone,
      From: KEYS.twilio_from,
      Body: `MOBILIZA · seu código de acesso é ${code}. Expira em 10 minutos.`,
    });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${KEYS.twilio_sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return r.ok;
  } catch (e) { console.error('Twilio:', e.message); return false; }
}

app.post('/api/auth/send-code', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ error: 'email e phone obrigatórios' });
  const code = genOtp();
  const key = `${email}:${phone}`;
  otpStore.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
  const [emailSent, smsSent] = await Promise.all([
    sendEmailCode(email, code),
    sendSmsCode(phone, code),
  ]);
  res.json({ ok: true, emailSent, smsSent, code: process.env.NODE_ENV === 'development' ? code : undefined });
});

app.post('/api/auth/verify-code', (req, res) => {
  const { email, phone, code } = req.body;
  if (!email || !phone || !code) return res.status(400).json({ valid: false, error: 'campos obrigatórios' });
  // 123456 sempre aceito (modo desenvolvimento)
  if (code === '123456') return res.json({ valid: true, mode: 'test' });
  const key = `${email}:${phone}`;
  const stored = otpStore.get(key);
  if (!stored) return res.json({ valid: false, error: 'código não encontrado · solicite novo' });
  if (Date.now() > stored.expiresAt) return res.json({ valid: false, error: 'código expirado' });
  if (stored.code !== code) return res.json({ valid: false, error: 'código incorreto' });
  otpStore.delete(key);
  res.json({ valid: true, mode: 'real' });
});

// ============ YOUTUBE ============
app.get('/api/social/youtube', async (req, res) => {
  const { q, max = 5 } = req.query;
  if (!KEYS.youtube) return res.json({ error: 'YOUTUBE_API_KEY não configurada', items: [] });
  if (!q) return res.json({ items: [] });
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=${Math.min(max, 25)}&order=date&relevanceLanguage=pt&key=${KEYS.youtube}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    const items = (data.items || []).map((item) => ({
      id: 'yt-' + item.id.videoId,
      src: 'yt',
      acct: item.snippet.channelTitle,
      txt: item.snippet.title + (item.snippet.description ? ' — ' + item.snippet.description.slice(0, 140) : ''),
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      ts: new Date(item.snippet.publishedAt).getTime(),
      sent: 'neu',
      kw: q,
    }));
    res.json({ items, source: 'youtube', count: items.length });
  } catch (e) {
    console.error('YouTube error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  }
});

// ============ X / TWITTER ============
app.get('/api/social/twitter', async (req, res) => {
  const { q, max = 10 } = req.query;
  if (!KEYS.twitter) return res.json({ error: 'TWITTER_BEARER_TOKEN não configurado', items: [] });
  if (!q) return res.json({ items: [] });
  try {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q + ' lang:pt -is:retweet')}&max_results=${Math.min(max, 100)}&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,name,verified`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${KEYS.twitter}` } });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`X API ${r.status}: ${errText.slice(0, 200)}`);
    }
    const data = await r.json();
    const users = {};
    (data.includes?.users || []).forEach((u) => { users[u.id] = u; });
    const items = (data.data || []).map((t) => {
      const user = users[t.author_id] || {};
      return {
        id: 'tw-' + t.id,
        src: 'tw',
        acct: '@' + (user.username || 'user'),
        txt: t.text,
        url: `https://x.com/${user.username || 'i'}/status/${t.id}`,
        ts: new Date(t.created_at).getTime(),
        sent: 'neu',
        kw: q,
        reach: t.public_metrics?.impression_count || 0,
      };
    });
    res.json({ items, source: 'twitter', count: items.length });
  } catch (e) {
    console.error('Twitter error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  }
});

// ============ INSTAGRAM (Graph API - hashtag search) ============
app.get('/api/social/instagram', async (req, res) => {
  const { q, igUserId } = req.query;
  if (!KEYS.meta) return res.json({ error: 'META_ACCESS_TOKEN não configurado', items: [] });
  if (!q) return res.json({ items: [] });
  try {
    // 1. Buscar ID do hashtag
    const tag = q.replace(/[^a-zA-Z0-9]/g, '');
    const tagUrl = `https://graph.facebook.com/v18.0/ig_hashtag_search?user_id=${igUserId}&q=${tag}&access_token=${KEYS.meta}`;
    const tagR = await fetch(tagUrl);
    const tagData = await tagR.json();
    if (tagData.error) throw new Error(tagData.error.message);
    const hashtagId = tagData.data?.[0]?.id;
    if (!hashtagId) return res.json({ items: [], source: 'instagram', count: 0 });

    // 2. Buscar mídia recente
    const mediaUrl = `https://graph.facebook.com/v18.0/${hashtagId}/recent_media?user_id=${igUserId}&fields=id,caption,permalink,timestamp,like_count&access_token=${KEYS.meta}`;
    const mediaR = await fetch(mediaUrl);
    const mediaData = await mediaR.json();
    const items = (mediaData.data || []).slice(0, 10).map((m) => ({
      id: 'ig-' + m.id,
      src: 'ig',
      acct: '@instagram',
      txt: (m.caption || '').slice(0, 240),
      url: m.permalink,
      ts: new Date(m.timestamp).getTime(),
      sent: 'neu',
      kw: q,
      reach: m.like_count || 0,
    }));
    res.json({ items, source: 'instagram', count: items.length });
  } catch (e) {
    console.error('Instagram error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  }
});

// ============ FACEBOOK (Graph API - own page posts) ============
app.get('/api/social/facebook', async (req, res) => {
  const { pageId } = req.query;
  if (!KEYS.meta || !pageId) return res.json({ error: 'META_ACCESS_TOKEN ou pageId ausente', items: [] });
  try {
    const url = `https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,message,created_time,permalink_url&limit=10&access_token=${KEYS.meta}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    const items = (data.data || []).map((p) => ({
      id: 'fb-' + p.id,
      src: 'fb',
      acct: 'Página oficial',
      txt: (p.message || '').slice(0, 240),
      url: p.permalink_url,
      ts: new Date(p.created_time).getTime(),
      sent: 'neu',
      kw: pageId,
    }));
    res.json({ items, source: 'facebook', count: items.length });
  } catch (e) {
    console.error('Facebook error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  }
});

// ============ TIKTOK (Display API - own content only) ============
app.get('/api/social/tiktok', async (req, res) => {
  if (!KEYS.tiktok) return res.json({ error: 'TIKTOK_ACCESS_TOKEN não configurado', items: [] });
  try {
    const url = 'https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,share_url,view_count';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEYS.tiktok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 10 }),
    });
    const data = await r.json();
    if (data.error?.code !== 'ok' && data.error) throw new Error(data.error.message);
    const items = (data.data?.videos || []).map((v) => ({
      id: 'tk-' + v.id,
      src: 'tk',
      acct: 'Conta oficial',
      txt: v.title || '',
      url: v.share_url,
      ts: (v.create_time || 0) * 1000,
      sent: 'neu',
      kw: '',
      reach: v.view_count || 0,
    }));
    res.json({ items, source: 'tiktok', count: items.length });
  } catch (e) {
    console.error('TikTok error:', e.message);
    res.status(500).json({ error: e.message, items: [] });
  }
});

// ============ RSS ============
const DEFAULT_FEEDS = [
  { name: 'G1 PE', url: 'https://g1.globo.com/dynamo/pernambuco/rss2.xml' },
  { name: 'Diário PE', url: 'https://www.diariodepernambuco.com.br/rss/politica.xml' },
  { name: 'Folha PE', url: 'https://folha.uol.com.br/rss/folha.xml' },
];

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(content);
      return r ? r[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
    };
    items.push({
      title: get('title'),
      link: get('link'),
      description: get('description').slice(0, 200),
      pubDate: get('pubDate'),
      guid: get('guid') || get('link'),
    });
  }
  return items;
}

app.get('/api/social/rss', async (req, res) => {
  const { q, feeds: feedsParam } = req.query;
  const feedList = feedsParam
    ? feedsParam.split(',').map((u) => ({ name: new URL(u).hostname, url: u.trim() }))
    : DEFAULT_FEEDS;
  const allItems = [];
  for (const feed of feedList) {
    try {
      const r = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRSS(xml);
      items.forEach((item) => {
        const hay = (item.title + ' ' + (item.description || '')).toLowerCase();
        if (!q || hay.includes(q.toLowerCase())) {
          allItems.push({
            id: 'rss-' + (item.guid || item.link),
            src: 'web',
            acct: feed.name,
            txt: item.title + (item.description ? ' — ' + item.description : ''),
            url: item.link,
            ts: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
            sent: 'neu',
            kw: q || '',
          });
        }
      });
    } catch (e) {
      console.error(`RSS ${feed.name}:`, e.message);
    }
  }
  allItems.sort((a, b) => b.ts - a.ts);
  res.json({ items: allItems.slice(0, 20), source: 'rss', count: allItems.length });
});

// ============ AGGREGATE ============
app.get('/api/social/aggregate', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ items: [] });
  const sources = [];
  if (KEYS.youtube) sources.push(`http://localhost:${PORT}/api/social/youtube?q=${encodeURIComponent(q)}`);
  if (KEYS.twitter) sources.push(`http://localhost:${PORT}/api/social/twitter?q=${encodeURIComponent(q)}`);
  sources.push(`http://localhost:${PORT}/api/social/rss?q=${encodeURIComponent(q)}`);
  const results = await Promise.allSettled(sources.map((url) => fetch(url).then((r) => r.json())));
  const allItems = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled' && r.value.items) allItems.push(...r.value.items);
  });
  allItems.sort((a, b) => b.ts - a.ts);
  res.json({ items: allItems.slice(0, 30), sources: sources.length });
});

// ============ SENTIMENT ============
app.post('/api/sentiment', (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ sentiment: 'neu' });
  const lower = text.toLowerCase();
  const pos = ['ótimo','excelente','apoio','parabéns','amei','gostei','incrível','forte','vamos','esperança','melhor','positivo','sucesso','vitória'];
  const neg = ['péssimo','horrível','crítica','errado','fraco','mentira','corrupção','escândalo','odeio','cansei','crise','problema','denúncia'];
  let pc = 0, nc = 0;
  pos.forEach((w) => { if (lower.includes(w)) pc++; });
  neg.forEach((w) => { if (lower.includes(w)) nc++; });
  res.json({ sentiment: pc > nc ? 'pos' : nc > pc ? 'neg' : 'neu', positive: pc, negative: nc });
});

// ============ START ============
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  MOBILIZA · Backend Social rodando');
  console.log('═══════════════════════════════════════════════');
  console.log(`  URL: http://localhost:${PORT}`);
  console.log('  Plataformas configuradas:');
  console.log(`    YouTube:   ${KEYS.youtube ? '✓' : '✗ (sem chave)'}`);
  console.log(`    Twitter/X: ${KEYS.twitter ? '✓' : '✗ (sem token)'}`);
  console.log(`    Meta IG:   ${KEYS.meta ? '✓' : '✗ (sem token)'}`);
  console.log(`    Meta FB:   ${KEYS.meta ? '✓' : '✗ (sem token)'}`);
  console.log(`    TikTok:    ${KEYS.tiktok ? '✓' : '✗ (sem token)'}`);
  console.log(`    RSS:       ✓ (sempre disponível)`);
  console.log('');
  console.log('  Auth (login OTP):');
  console.log(`    SMS (Twilio):    ${KEYS.twilio_sid && KEYS.twilio_token ? '✓' : '✗ (sem credenciais)'}`);
  console.log(`    Email (SendGrid): ${KEYS.sendgrid ? '✓' : '✗ (sem chave)'}`);
  console.log('    Modo teste:      ✓ (código 123456 sempre aceito)');
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET  /api/status`);
  console.log(`    GET  /api/social/youtube?q=:query`);
  console.log(`    GET  /api/social/twitter?q=:query`);
  console.log(`    GET  /api/social/instagram?q=:hashtag&igUserId=:id`);
  console.log(`    GET  /api/social/facebook?pageId=:id`);
  console.log(`    GET  /api/social/tiktok`);
  console.log(`    GET  /api/social/rss?q=:query`);
  console.log(`    GET  /api/social/aggregate?q=:query`);
  console.log(`    POST /api/auth/send-code  {email, phone}`);
  console.log(`    POST /api/auth/verify-code  {email, phone, code}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});
