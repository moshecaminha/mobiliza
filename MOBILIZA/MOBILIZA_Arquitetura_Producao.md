# MOBILIZA — Arquitetura de Produção (multi-candidato)

**Versão:** 1.0 · **Data:** 11/08/2026
**Backend:** Supabase (projeto `sucesso-no-resultado` / ref `dhxizqszipfnlpojzpbc`, região sa-east-1)
**Schema isolado:** `mobiliza` (o schema `public` é compartilhado com outros apps e **não** deve ser usado)

---

## 1. Visão geral

O MOBILIZA deixa de ser um app de demonstração (dados no navegador via `localStorage`) e passa a ser uma **plataforma SaaS multi-candidato**. Cada candidato é um "inquilino" (tenant) com dados totalmente isolados. Uma mesma pessoa (coordenador, assessor) pode ter acesso a um ou mais candidatos, sempre com um papel definido.

Decisões de arquitetura já validadas:

- **Isolamento:** lógico, por *Row-Level Security* (RLS) — todos os candidatos no mesmo banco, cada um enxergando só o próprio. Escala para dezenas de campanhas com custo baixo.
- **Autenticação:** Supabase Auth (e-mail + senha), com papéis por candidato.
- **WhatsApp:** Meta WhatsApp Cloud API (oficial). Detalhado no documento `MOBILIZA_WhatsApp_Endpoints.md`.
- **Escala:** pronto para 2026 (deputados) e 2028 (prefeitos) — o campo `election_year` separa os ciclos; o mesmo candidato pode ter registros de eleições diferentes como tenants distintos.

---

## 2. Papéis e permissões

| Papel | Escopo | O que pode fazer |
|---|---|---|
| **Superadmin** (plataforma) | Global | Enxerga e administra todos os candidatos. É você / a equipe MOBILIZA. Marcado em `app_users.is_platform_admin = true`. |
| **Admin** (da campanha) | Um candidato | Tudo dentro do candidato **+ gerir a equipe** (adicionar/remover coordenador e assessor). Normalmente o coordenador-chefe. |
| **Coordenador** | Um candidato | Preenche e edita todas as informações da campanha (candidato, regiões, lideranças, militância, financeiro, logística, eventos, disparos). |
| **Assessor** | Um candidato | **Mesmo poder de escrita do coordenador** sobre os dados da campanha (conforme solicitado). Não gerencia equipe. |

> A diferença prática entre coordenador e assessor hoje é apenas a gestão de equipe (reservada ao admin). Ambos preenchem os dados igualmente. Se no futuro você quiser restringir o assessor (ex.: sem acesso ao financeiro), isso é feito refinando as políticas de RLS por módulo — a estrutura já suporta.

A regra que sustenta tudo é a função `mobiliza.has_access(candidate_id)`:

```
Tem acesso ao candidato SE:
  o usuário é superadmin  OU
  existe um vínculo (membership) entre o usuário e o candidato
```

Toda tabela de campanha aplica essa regra no `SELECT/INSERT/UPDATE/DELETE`. Ninguém enxerga o que não é seu — nem por engano de código no frontend, porque a barreira está no banco.

---

## 3. Modelo de dados

Todas as tabelas vivem no schema `mobiliza`. Grupos:

### 3.1 Tenancy (núcleo)

| Tabela | Papel |
|---|---|
| `candidates` | O tenant. Nome, cargo (`office`), ano (`election_year`), partido/número, UF, cidade, **foto (`photo_url`)**, **cor do tema (`theme_color`)**, bio, status. |
| `app_users` | Perfil do usuário (espelha `auth.users`). Nome, telefone, **foto (`photo_url`)**, `is_platform_admin`. Criado automaticamente por gatilho quando alguém se cadastra no Auth. |
| `memberships` | Vínculo usuário ↔ candidato + papel (`admin`/`coordenador`/`assessor`). É a fronteira de acesso. |
| `whatsapp_configs` | Credenciais públicas do WhatsApp por candidato (WABA ID, phone_number_id, número exibido, status). O **token fica em Secret**, nunca aqui. |

### 3.2 Entidades da campanha (todas com `candidate_id` + RLS)

`regions`, `leaders`, `militants`, `agenda_events`, `message_templates`, `campaigns`, `competitors`, `social_keywords`, `insights`, `finance_accounts`, `finance_transactions`, `donations`, `committees`, `products`, `stock_entries`, `purchase_orders`.

Cada uma isola por candidato. Isso conecta ao banco **tudo** que hoje vive solto no `localStorage` — militância, financeiro (prestação de contas), logística (comitês/estoque/pedidos), agenda, disparos, radar competitivo e insights.

### 3.3 Eventos e leads (feature nova)

| Tabela | Papel |
|---|---|
| `events` | Cada evento da campanha. Tem `qr_token` único → gera o QR. Local, data, endereço, candidato. |
| `leads` | Pessoa captada num evento (um registro por pessoa por candidato). Nome, telefone, endereço com **número obrigatório**, status (`lead` → `apoiador`). |
| `lead_checkins` | Presença de um lead num evento (um lead pode ir a vários). Marca `shared_social` quando a pessoa compartilha nas redes. |

---

## 4. Isolamento por RLS — como funciona na prática

1. O usuário faz login (Supabase Auth) → recebe um token JWT com o `user_id`.
2. Toda consulta ao banco carrega esse token. O Postgres sabe quem é `auth.uid()`.
3. Antes de devolver qualquer linha, a política de RLS roda `has_access(candidate_id)`.
4. Se o usuário não tem vínculo com aquele candidato, a linha **não existe** para ele.

Resultado: o candidato A jamais vê a base do candidato B, mesmo que o frontend tenha um bug. O relatório de cada candidato é, por construção, só dele.

As RPCs públicas do fluxo de QR (`mob_event_public`, `mob_lead_check_phone`, `mob_lead_register`, `mob_lead_mark_shared`) são `SECURITY DEFINER`: rodam com privilégio elevado mas **só expõem o necessário** (dados do evento, confirmação de cadastro) e recebem o `qr_token` como chave — quem não tem o token não acessa nada.

---

## 5. Autenticação (Supabase Auth)

- **Cadastro/login:** e-mail + senha. Recuperação de senha nativa.
- **Primeiro acesso:** a pessoa cria a conta → vira `app_users` automaticamente. Um admin da campanha a adiciona via `mob_add_member(candidate, email, papel)`.
- **Fotos de perfil e de candidato:** Supabase Storage (buckets `avatars` e `candidatos`), URL pública salva em `app_users.photo_url` / `candidates.photo_url`.
- **Recomendação de segurança:** ativar *Leaked Password Protection* no painel do Supabase (Auth → Policies) — bloqueia senhas vazadas conhecidas. Hoje está desativado.

### Fluxo de onboarding de uma campanha

1. Superadmin (você) cria o candidato: `mob_create_candidate(nome, cargo, ano, uf, cidade, partido, número, cor)` → o criador já vira **admin** daquele candidato.
2. Admin adiciona coordenador e assessor por e-mail: `mob_add_member(...)`.
3. Coordenador/assessor entram e preenchem os dados da campanha (que gravam direto no banco, isolados por RLS).

---

## 6. Módulo de Eventos + QR + Leads (fluxo completo)

**Objetivo:** transformar quem comparece a eventos em leads geolocalizados, que viram apoiadores depois.

### 6.1 Criar evento (equipe logada)
- A equipe cadastra o evento (título, data, local, endereço). O sistema gera automaticamente um `qr_token` → **um QR por evento**.
- O QR aponta para `…/evento?e=<qr_token>` (página pública, sem login).

### 6.2 Ler o QR (pessoa no evento)
1. A pessoa lê o QR e cai na página pública já com o **branding do candidato** (foto, cor do tema, número) — vindo de `mob_event_public(qr_token)`.
2. **Pede o telefone primeiro.** Chama `mob_lead_check_phone(qr_token, telefone)`:
   - **Já cadastrada** → boas-vindas ("Que bom te ver de novo, {nome}!"), mostra **qual é o evento** e oferece **compartilhar nas redes** que está ali (dá visibilidade à rede dela). A presença já é registrada no check-in. Se compartilhar → `mob_lead_mark_shared(...)`.
   - **Nova** → segue para o cadastro.
3. **Cadastro novo:** nome, telefone, **CEP** (preenche endereço automaticamente pela mesma API de CEP já usada), faltando só o **número da residência (obrigatório)**. Chama `mob_lead_register(...)` → cria o lead + check-in no evento.

### 6.3 Pós-evento (equipe)
- A base de leads aparece no painel, por evento. A equipe promove leads a apoiadores com `mob_promote_lead(lead_id)` (o lead vira militante na base).
- O relatório mostra: leads por evento, quantos compartilharam nas redes, conversão lead→apoiador.

---

## 7. Relatórios

`mob_candidate_report(candidate_id)` devolve, em uma chamada, os números que a campanha olha em tempo real:

- Lideranças, militantes, leads, leads já promovidos a apoiador
- Eventos, check-ins, quantos compartilharam nas redes
- Votos estimados somados e base histórica (votos da última eleição)
- Financeiro: receitas, despesas, doações
- Custo total de disparos
- Leads por evento (ranking)

Como cada candidato é isolado por RLS, o relatório é sempre exclusivo daquele candidato. Superadmin pode consolidar todos.

---

## 8. Fotos e tema (personalização)

- **Foto do candidato:** exibida no dashboard e na página pública do QR. Campo `candidates.photo_url`.
- **Cor do tema:** `candidates.theme_color`. O frontend aplica essa cor como variável CSS (`--brand`) ao entrar no candidato — a plataforma fica na cor da campanha.
- **Foto do usuário:** `app_users.photo_url`.

---

## 9. O que já está pronto x o que falta

### Pronto (banco)
- [x] Schema multi-candidato completo (tenancy + todas as entidades de campanha)
- [x] RLS em todas as tabelas + função `has_access`
- [x] Auth com gatilho de criação de perfil e papéis
- [x] Módulo de eventos/leads com RPCs públicas do QR
- [x] RPCs de app: criar candidato, listar meus candidatos, equipe, promover lead, relatório
- [x] Geocodificação por bairro (Edge Function `mob-geocode`) — já em produção

### Próximas fases (frontend)
1. **Telas de Auth** (login/cadastro/recuperação com Supabase Auth) substituindo o OTP falso.
2. **Seletor de candidato** no topo + aplicação do tema/foto ao entrar.
3. **Migração do estado:** trocar leitura/gravação de `localStorage` por chamadas ao banco (por candidato) em cada módulo — militância, financeiro, logística, agenda, disparos, radar.
4. **Módulo de Eventos** na interface: criar evento, gerar QR, página pública de captação, painel de leads.
5. **Tela de equipe/acessos** (admin adiciona coordenador/assessor).
6. **Relatórios** consumindo `mob_candidate_report`.
7. **Disparo WhatsApp** conectando ao endpoint (ver documento próprio).

---

## 10. Segurança — checklist

- [x] RLS ligada em 100% das tabelas do schema `mobiliza`.
- [x] Token do WhatsApp fora do banco (em Secret), só identificadores públicos em `whatsapp_configs`.
- [x] RPCs públicas recebem `qr_token` como chave e expõem o mínimo.
- [ ] Ativar *Leaked Password Protection* no Auth (painel Supabase).
- [ ] Definir política de retenção/LGPD dos leads (consentimento no cadastro; direito de remoção).
- [ ] Rotacionar a chave `anon` que hoje está embutida no HTML público (é publicável por design, mas convém rotacionar antes do go-live em massa).

---

## Apêndice — Referência das RPCs

| RPC | Quem chama | O que faz |
|---|---|---|
| `mob_create_candidate(...)` | autenticado | Cria candidato + vincula criador como admin |
| `mob_my_candidates()` | autenticado | Lista candidatos do usuário + papel |
| `mob_add_member(candidate, email, papel)` | admin | Adiciona coordenador/assessor |
| `mob_candidate_team(candidate)` | com acesso | Lista a equipe |
| `mob_candidate_report(candidate)` | com acesso | Relatório consolidado |
| `mob_promote_lead(lead_id)` | com acesso | Lead → apoiador (militante) |
| `mob_event_public(qr_token)` | público | Dados do evento + branding |
| `mob_lead_check_phone(qr_token, phone)` | público | Verifica telefone; boas-vindas ou cadastro novo |
| `mob_lead_register(...)` | público | Cadastra lead + check-in |
| `mob_lead_mark_shared(qr_token, phone)` | público | Marca compartilhamento nas redes |
| `mob_upsert_leader`, `mob_join`, `mob_sync_militants`, `mob_get_leader` | público/QR de liderança | Fluxo de QR de liderança (já existente) |
| `mob-geocode` (Edge Function) | app | Geocodifica por bairro com cache |
