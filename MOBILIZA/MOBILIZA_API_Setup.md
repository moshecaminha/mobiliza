# MOBILIZA · Setup das APIs do Radar Social

Guia passo-a-passo para conectar APIs reais ao radar social. Algumas funcionam **direto do navegador** em 5 minutos. Outras exigem o backend Node.js + tokens pagos.

---

## Resumo: o que dá para conectar e como

| Plataforma | Como funciona | Custo | Tempo de setup |
|---|---|---|---|
| **YouTube** | Direto do navegador com API Key | Grátis (10k req/dia) | **5 minutos** |
| **Blogs/RSS** | Direto do navegador via proxy CORS | Grátis | **Já funciona** |
| **X (Twitter)** | Backend Node.js + Bearer Token | **~US$100/mês** (plano Basic) | 1 hora + pagamento |
| **Instagram** | Backend + Meta Business App + Business Account | Grátis (com verificação) | **Dias** (verificação Meta) |
| **Facebook** | Backend + Meta Business App | Grátis (com verificação) | **Dias** (verificação Meta) |
| **TikTok** | Backend + aprovação manual | Grátis (acesso muito limitado) | **Semanas** (aprovação) |

---

## 1. YouTube · 5 minutos (recomendado começar por aqui)

YouTube Data API funciona direto do navegador. Não precisa de servidor.

### Passos:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie um projeto (ou use um existente)
3. No menu lateral: **APIs e Serviços → Biblioteca**
4. Procure **YouTube Data API v3** → clique → **Ativar**
5. Vá em **APIs e Serviços → Credenciais → Criar credencial → Chave de API**
6. Copie a chave (formato `AIzaSy...`)
7. **No app MOBILIZA:** Configurações → Conectar APIs → cole a chave em "YouTube Data API v3" → marque "Usar APIs reais" → Salvar

Pronto. Vá no Radar Social, clique em **Atualizar busca** — vai trazer vídeos reais do YouTube sobre os termos cadastrados.

**Limites:** 10.000 unidades/dia grátis. Uma busca custa ~100 unidades, então cabem ~100 buscas por dia.

---

## 2. Blogs/RSS · Já funciona

Não precisa configurar nada. O sistema já vem com 3 feeds de Pernambuco pré-configurados:
- G1 PE
- Diário de Pernambuco (política)
- JC online

Para adicionar mais feeds, vá em Configurações → Conectar APIs → no campo "Blogs e portais (RSS)" cole URLs separadas por vírgula. Exemplos:
- `https://noticias.uol.com.br/rss/politica.xml`
- `https://blogs.ne10.uol.com.br/jamildo/feed/`
- `https://www.nordeste.com.br/feed/`

**Como funciona:** o navegador usa o proxy `allorigins.win` (grátis) para contornar restrições CORS dos sites de notícia. Funciona para qualquer feed RSS público.

---

## 3. X (Twitter), Instagram, Facebook e TikTok · Precisa do backend

Estas plataformas **não permitem chamadas diretas do navegador** por OAuth + CORS. É necessário rodar o backend `MOBILIZA_Backend_Social.js`.

### 3.1 Instalar Node.js

1. Baixe Node.js 18+ em [nodejs.org](https://nodejs.org/) — pegue a versão LTS
2. Instale normalmente (next, next, finish)
3. Abra o terminal (cmd no Windows / Terminal no Mac) e teste:
   ```bash
   node --version
   ```
   Deve aparecer algo como `v20.x.x`.

### 3.2 Configurar o backend

1. Crie uma pasta nova, ex: `C:\mobiliza-backend`
2. Copie para dentro dela os 2 arquivos:
   - `MOBILIZA_Backend_Social.js`
   - `MOBILIZA_Backend_package.json` → **renomeie para `package.json`**
3. Crie nessa pasta um arquivo chamado `.env` com este conteúdo (vazio inicialmente):
   ```
   PORT=3001

   # APIs sociais (opcional - configure as que quiser)
   YOUTUBE_API_KEY=
   TWITTER_BEARER_TOKEN=
   META_ACCESS_TOKEN=
   TIKTOK_ACCESS_TOKEN=

   # Login OTP (opcional - se vazio, código 123456 funciona em modo teste)
   TWILIO_ACCOUNT_SID=        # SMS via Twilio (twilio.com)
   TWILIO_AUTH_TOKEN=
   TWILIO_FROM_NUMBER=+15551234567
   SENDGRID_API_KEY=          # Email via SendGrid (sendgrid.com)
   EMAIL_FROM=noreply@mobiliza.app
   ```

   **Para o login funcionar com SMS+email real:**
   - **SMS**: Crie conta em [twilio.com](https://www.twilio.com/) (US$15 de crédito grátis no signup). Pegue Account SID, Auth Token e um número Twilio que envie SMS para Brasil.
   - **Email**: Crie conta em [sendgrid.com](https://sendgrid.com/) (100 emails/dia grátis). Pegue API Key e verifique o domínio do EMAIL_FROM.
   - **Modo teste**: se deixar essas variáveis vazias, o backend retorna `emailSent:false, smsSent:false` mas o código `123456` sempre funciona para login.
4. No terminal, dentro dessa pasta, rode:
   ```bash
   npm install
   node MOBILIZA_Backend_Social.js
   ```
5. Você verá:
   ```
   ═══════════════════════════════════════════════
     MOBILIZA · Backend Social rodando
   ═══════════════════════════════════════════════
     URL: http://localhost:3001
   ```
6. **No app MOBILIZA:** Configurações → Conectar APIs → no campo "Servidor backend" cole `http://localhost:3001` → clique **Testar** → deve mostrar **✓ online**

Pronto. Agora você pode adicionar tokens das plataformas que quiser conectar (próximas seções). A cada token adicionado, edite o `.env` e reinicie o servidor (`Ctrl+C` e `node MOBILIZA_Backend_Social.js` de novo).

### 3.3 Conectar X (Twitter/X API)

1. Acesse [developer.x.com](https://developer.x.com/)
2. Crie uma conta de desenvolvedor (precisa de cartão para o plano Basic — **~US$100/mês**)
3. Crie um App → copie o **Bearer Token**
4. Cole no `.env`: `TWITTER_BEARER_TOKEN=AAAAAAAAAA...`
5. Reinicie o backend
6. Funciona para busca de tweets em tempo real (limites do plano Basic)

### 3.4 Conectar Instagram + Facebook (Meta)

Mais complexo. Requer:

1. Conta Meta Business em [business.facebook.com](https://business.facebook.com/)
2. Criar um App Meta em [developers.facebook.com](https://developers.facebook.com/)
3. Adicionar produtos: **Instagram Graph API** e **Facebook Login**
4. Vincular a página do Facebook do candidato como business asset
5. Vincular a conta Instagram (que precisa ser Business Account)
6. Passar pelo App Review da Meta (pode levar dias/semanas)
7. Gerar **Long-lived Access Token** com permissões `pages_read_engagement`, `instagram_basic`
8. Cole no `.env`: `META_ACCESS_TOKEN=EAA...`
9. Reinicie o backend

**Limitação:** Instagram Graph API só permite buscar:
- Posts da própria conta business do candidato
- Posts contendo hashtags específicas (limitado a 30 hashtags / 7 dias por hashtag)
- **Não permite** monitorar perfis de terceiros ou adversários

### 3.5 Conectar TikTok

TikTok tem 2 APIs:
- **Display API**: só conteúdo da sua própria conta
- **Research API**: requer aprovação de pesquisador acadêmico

Para a campanha:
1. Acesse [developers.tiktok.com](https://developers.tiktok.com/)
2. Crie um app → ative **Login Kit** + **Content Posting API**
3. Vincule conta do candidato
4. OAuth flow para obter access token de longa duração
5. Cole no `.env`: `TIKTOK_ACCESS_TOKEN=...`
6. Reinicie o backend

**Limitação:** só lista vídeos da própria conta. Para monitorar menções de terceiros sobre o candidato, precisaria de scraping (risco de banimento) ou da Research API (aprovação acadêmica).

---

## 4. Como tudo se conecta

```
┌────────────────────────────┐
│   MOBILIZA_App.html        │
│   (rodando no navegador)   │
└──────────────┬─────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  YouTube API     Backend Node.js
  (direto)        (http://localhost:3001)
  ✓ funciona             │
                  ┌──────┴──────┬─────────────┐
                  ▼             ▼             ▼
              Twitter        Meta IG      TikTok
              (Bearer)       (OAuth)      (OAuth)
                  
  RSS Blogs (direto via proxy CORS)
  ✓ funciona
```

Quando você clica **Atualizar busca** no app, ele:
1. Chama YouTube direto (se chave estiver configurada)
2. Chama RSS direto via proxy (sempre)
3. Chama o backend `/api/social/aggregate?q=termo` que internamente chama X, IG, FB, TikTok
4. Combina tudo, deduplica, ordena por data, classifica sentimento
5. Mostra no feed com badge **🔗 real** nas menções verdadeiras

---

## 5. Modo simulação (default)

Se você **não** marcar "Usar APIs reais" em Configurações, o app continua usando o gerador simulado — útil para demos, treinamento ou quando não tem APIs configuradas ainda.

A simulação:
- Gera 1-2 menções por termo cadastrado
- Usa templates plausíveis em português
- Distribui sentimentos de forma realista por tipo de termo
- Atualiza com `refreshSocialFeed()` ou ao adicionar/remover termos

Para alternar entre real e simulado, é só ligar/desligar o toggle "Usar APIs reais" em Configurações → Conectar APIs.

---

## 6. Hospedar o backend em produção

Para um candidato real em campanha, o backend não deve rodar no `localhost`. Opções:

| Opção | Custo | Setup |
|---|---|---|
| **Railway** | US$ 5/mês | Conecta direto do GitHub, 1 clique |
| **Render** | Grátis (com sleep) ou US$ 7/mês | Similar ao Railway |
| **Fly.io** | Grátis até 3 apps | Mais técnico |
| **VPS (DigitalOcean, AWS Lightsail)** | US$ 4-12/mês | Mais controle, mais trabalho |

**Recomendação:** Railway é o mais simples. Crie repositório no GitHub com os 2 arquivos do backend, conecte ao Railway, configure as variáveis de ambiente (YOUTUBE_API_KEY etc.), deploy automático.

URL pública (ex: `https://mobiliza-backend.up.railway.app`) substitui o `http://localhost:3001` no app.

**Importante:** habilite HTTPS e adicione CORS apenas para o domínio do app, não `*`, em produção.

---

## 7. Troubleshooting

**"YouTube: API key not valid"** → Confira se a chave foi copiada inteira (40 caracteres). Confira se a YouTube Data API v3 está habilitada no projeto Google Cloud.

**"X API 401 Unauthorized"** → O Bearer Token expirou ou está incorreto. Gere um novo no developer.x.com.

**"Backend inacessível"** → Confirme que `node MOBILIZA_Backend_Social.js` está rodando, terminal mostra "URL: http://localhost:3001", e o app aponta para o mesmo endereço.

**"RSS: nenhum resultado"** → Verifique se a URL do feed é válida (abra no navegador, deve mostrar XML). Alguns feeds podem ter mudado de URL.

**"Instagram: hashtag not found"** → A hashtag precisa existir e ser pública. Limite de 30 hashtags rastreáveis por conta a cada 7 dias.

---

*Documento mantido junto ao projeto MOBILIZA. Última atualização: 2026.*
