# MOBILIZA — Integração WhatsApp (Meta Cloud API)

**Versão:** 1.0 · **Data:** 11/08/2026
**Provedor escolhido:** Meta WhatsApp **Cloud API** (oficial)
**Graph API:** `https://graph.facebook.com/v21.0`

Este documento descreve **como conectar um número** de WhatsApp à plataforma e **como o botão de disparo do módulo de Comunicação envia** as mensagens. Serve de especificação para implementar os endpoints no backend (Supabase Edge Functions).

---

## 1. Como funciona (visão de 1 minuto)

1. Cada campanha (candidato) tem um **número oficial** conectado a uma *WhatsApp Business Account* (WABA) dentro do seu **Meta Business**.
2. O envio é feito por uma chamada HTTP à Cloud API, autenticada por um **token permanente**.
3. Duas classes de mensagem:
   - **Template (HSM):** mensagem pré-aprovada pela Meta. **Obrigatória** para iniciar conversa / disparo em massa. É o que a campanha usa.
   - **Texto livre (sessão):** só permitido **dentro de 24h** após a pessoa te responder. Serve para atendimento, não para disparo frio.
4. O botão "Registrar/Enviar" do módulo **não chama a Meta direto do navegador** (o token não pode ficar no cliente). Ele chama uma **Edge Function** no Supabase, que guarda o token e conversa com a Meta.

```
[App/navegador] --(candidate_id, template, segmentação)--> [Edge Function mob-wa-send] --(token seguro)--> [Meta Cloud API] --> WhatsApp dos contatos
```

---

## 2. Pré-requisitos (uma vez por campanha)

Para **conectar o número** de um candidato você precisa de:

| Item | Onde obter |
|---|---|
| **Meta Business Manager** | business.facebook.com |
| **App no Meta for Developers** com o produto *WhatsApp* | developers.facebook.com/apps |
| **WhatsApp Business Account (WABA)** | criada dentro do app/Business |
| **Número de telefone** (não pode estar ativo em outro WhatsApp) | adicionado e verificado na WABA |
| **`WABA_ID`** | painel WhatsApp → Configuração da API |
| **`PHONE_NUMBER_ID`** | painel WhatsApp → Configuração da API (é diferente do número em si) |
| **Token permanente** (System User token) | Business Settings → Usuários do sistema → gerar token com permissões `whatsapp_business_messaging` e `whatsapp_business_management` |
| **`APP_SECRET`** e **`VERIFY_TOKEN`** | para validar o webhook |

> **Verificação do negócio (Business Verification):** para sair do modo de teste e enviar para números não cadastrados, a Meta exige verificar o negócio e o número ter um *display name* aprovado. Planeje isso com antecedência — pode levar dias.

### Dois caminhos para conectar o número

- **Manual (recomendado para começar com 5 candidatos):** você cria WABA + número + token de cada campanha no painel da Meta e cola os identificadores na tela de configuração do MOBILIZA. Simples e direto para poucos candidatos.
- **Embedded Signup (para escalar):** o MOBILIZA embute o fluxo de *Facebook Login for Business + Embedded Signup*. O próprio candidato conecta a WABA dele em uma janela, e a plataforma recebe um `code` que é trocado por token. Vale quando forem muitas campanhas. Fica como evolução futura.

---

## 3. Onde guardar as credenciais

- **Identificadores públicos** (`waba_id`, `phone_number_id`, número exibido, status) → tabela `mobiliza.whatsapp_configs` (uma linha por candidato).
- **Token permanente** → **NUNCA** no banco em texto puro nem no frontend. Guardar como **Secret da Edge Function** (Supabase → Edge Functions → Secrets). Estratégias:
  - **1 token por WABA da agência:** um System User token com acesso a todas as WABAs; a função escolhe o `phone_number_id` pelo `candidate_id`. Mais simples.
  - **1 token por candidato:** guardar cada token como secret nomeado (`WA_TOKEN_<candidateId>`) ou cifrado no banco via Vault/pgsodium. Mais isolado.

A tabela já prevê o campo `token_secret_name` para apontar qual secret usar.

---

## 4. Templates de mensagem (HSM)

Disparo em massa **exige template aprovado**. Fluxo:

1. Criar o template (via Business Manager → WhatsApp Manager → Modelos, ou via API `POST /{WABA_ID}/message_templates`).
2. Definir **categoria**: `MARKETING` (convites, mobilização), `UTILITY` (lembrete de evento/confirmação) ou `AUTHENTICATION` (código). Para campanha, quase tudo é **MARKETING**.
3. Aguardar aprovação da Meta (minutos a horas).
4. Usar variáveis `{{1}}`, `{{2}}`… no corpo (ex.: `Olá {{1}}, hoje tem caminhada em {{2}} às {{3}}`).

Exemplo de criação de template:

```bash
curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/message_templates" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "convite_evento",
    "language": "pt_BR",
    "category": "MARKETING",
    "components": [
      { "type": "BODY",
        "text": "Olá {{1}}! Hoje tem {{2}} em {{3}} às {{4}}. Sua presença é importante. — Equipe do candidato" ,
        "example": { "body_text": [["Maria","caminhada","Savassi","18h"]] } }
    ]
  }'
```

> **Mapa com o módulo atual:** os templates que o app já cria (Convite para plenária, Convocação de militância, etc.) viram templates HSM aqui. As variáveis do app (`{nome}`, `{bairro}`, `{hora}`) mapeiam para `{{1}}`, `{{2}}`, `{{3}}`.

---

## 5. Endpoint de envio

### 5.1 Enviar template (disparo — o que o botão usa)

```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5531999999999",
    "type": "template",
    "template": {
      "name": "convite_evento",
      "language": { "code": "pt_BR" },
      "components": [
        { "type": "body",
          "parameters": [
            { "type": "text", "text": "Maria" },
            { "type": "text", "text": "caminhada" },
            { "type": "text", "text": "Savassi" },
            { "type": "text", "text": "18h" }
          ] }
      ]
    }
  }'
```

- `to`: telefone no formato **E.164 sem `+`** (ex.: `5531999999999`).
- Resposta: `{ "messages": [{ "id": "wamid...." }] }` — guarde o `wamid` para casar com o webhook de status.

### 5.2 Enviar texto livre (só dentro da janela de 24h)

```json
{ "messaging_product": "whatsapp", "to": "5531999999999",
  "type": "text", "text": { "body": "Obrigado pela presença!" } }
```

Fora das 24h isso é **rejeitado** — use template.

---

## 6. Webhook (receber respostas e status de entrega)

1. No app da Meta, configurar o **Webhook** apontando para a Edge Function (`…/functions/v1/mob-wa-webhook`) e assinar os campos `messages`.
2. **Verificação (GET):** a Meta chama com `hub.mode`, `hub.verify_token`, `hub.challenge`. Responder o `challenge` se o `verify_token` bater.
3. **Recebimento (POST):** chegam eventos de:
   - **mensagens** que as pessoas enviaram (abre a janela de 24h),
   - **status** de cada disparo: `sent` → `delivered` → `read` (ou `failed`).
4. Gravar os status para o relatório de campanha (entregues, lidas, falhas) e o opt-out de quem pedir para sair.

---

## 7. Edge Function proposta — `mob-wa-send`

Server-side, guarda o token, valida acesso e dispara. Esboço:

```ts
// supabase/functions/mob-wa-send/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  // 1) Autentica o usuário pelo JWT e confirma acesso ao candidato (RLS/has_access)
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { candidateId, templateName, lang = "pt_BR", recipients } = await req.json();
  // recipients: [{ phone, params: ["Maria","caminhada","Savassi","18h"] }, ...]

  // valida acesso: consulta a config do candidato passa pela RLS do usuário
  const { data: cfg, error } = await sb.schema("mobiliza")
    .from("whatsapp_configs").select("phone_number_id, token_secret_name, status")
    .eq("candidate_id", candidateId).single();
  if (error || !cfg || cfg.status !== "connected")
    return json({ ok: false, error: "WhatsApp não conectado para este candidato" }, 400);

  // 2) Token seguro (secret). 1 token por WABA da agência, ou por candidato.
  const token = Deno.env.get(cfg.token_secret_name ?? "WA_TOKEN") ?? Deno.env.get("WA_TOKEN")!;

  // 3) Dispara com throttle (respeita rate limit da Meta)
  const results = [];
  for (const r of recipients) {
    const body = {
      messaging_product: "whatsapp",
      to: r.phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: templateName, language: { code: lang },
        components: [{ type: "body",
          parameters: (r.params ?? []).map((t: string) => ({ type: "text", text: t })) }],
      },
    };
    const resp = await fetch(`${GRAPH}/${cfg.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    results.push({ phone: r.phone, ok: resp.ok, id: data?.messages?.[0]?.id, error: data?.error?.message });
    await new Promise((s) => setTimeout(s, 120)); // ~8 msg/s, ajustável ao seu tier
  }

  // 4) Registra a campanha/resultados no banco (mobiliza.campaigns)
  return json({ ok: true, sent: results.filter(x => x.ok).length, results });
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
```

Secrets a configurar (Supabase → Edge Functions → Secrets): `WA_TOKEN` (ou `WA_TOKEN_<candidateId>`), e as chaves `SUPABASE_URL`/`SUPABASE_ANON_KEY` já existem no runtime.

---

## 8. Como o botão do módulo dispara

No módulo de Comunicação, ao clicar em **Registrar/Enviar**:

1. O app monta a audiência pela segmentação já existente (bairro/cidade/classe/pessoas) → lista de `{ phone, params }`.
2. Chama `POST …/functions/v1/mob-wa-send` com o JWT do usuário, o `candidate_id` ativo, o `templateName` e os `recipients`.
3. A função valida acesso, dispara pela Meta e grava o resultado em `mobiliza.campaigns` (alcance, custo, status).
4. O app mostra: enviados, falhas e custo. O **custo real** por conversa vem da tabela de preços da Meta (ver §9), substituindo a estimativa de R$ 0,40 quando o número estiver conectado.

Enquanto o número **não** estiver conectado, o botão continua funcionando em **modo simulação** (registra a campanha como rascunho, sem enviar) — como está hoje.

---

## 9. Custos, limites e conformidade

- **Cobrança por conversa** (não por mensagem), por categoria. **Marketing** é pago; **Utility/Service** têm regras próprias. Confirme os preços atuais do Brasil na tabela oficial da Meta antes de orçar a campanha.
- **Tiers de volume:** números novos começam limitados (ex.: 250/1.000 conversas por dia) e escalam com boa reputação. Planeje o aquecimento.
- **Opt-in obrigatório:** só dispare para quem **consentiu** receber mensagens da campanha (o cadastro por QR já captura esse consentimento — registre a data/origem).
- **Opt-out:** respeite pedidos de "SAIR"/"PARAR". Marque o contato como opt-out e não dispare mais.
- **Qualidade:** disparo frio sem opt-in derruba a qualidade do número e pode **banir**. Por isso a base captada por evento/QR (com consentimento) é o ativo mais valioso.

---

## 10. Checklist de conexão (por candidato)

1. [ ] Criar/ვincular WABA no Meta Business da campanha.
2. [ ] Adicionar e verificar o número; aprovar o *display name*.
3. [ ] Gerar token permanente (System User) com as permissões de messaging + management.
4. [ ] Copiar `WABA_ID` e `PHONE_NUMBER_ID`.
5. [ ] Criar e aprovar os templates de campanha (categoria Marketing/Utility).
6. [ ] Salvar identificadores em `mobiliza.whatsapp_configs` (via tela de configuração) e o token como Secret.
7. [ ] Configurar e verificar o webhook.
8. [ ] Fazer um envio de teste para um número próprio.
9. [ ] Verificar Business Verification para liberar volume.

---

## Apêndice — endpoints usados

| Ação | Método | URL |
|---|---|---|
| Enviar mensagem | POST | `/{PHONE_NUMBER_ID}/messages` |
| Criar template | POST | `/{WABA_ID}/message_templates` |
| Listar templates | GET | `/{WABA_ID}/message_templates` |
| Dados do número | GET | `/{PHONE_NUMBER_ID}` |
| Webhook (verificação) | GET | sua Edge Function `mob-wa-webhook` |
| Webhook (eventos) | POST | sua Edge Function `mob-wa-webhook` |
| Embedded Signup (troca de code) | POST | `/{APP_ID}/oauth/access_token` |
