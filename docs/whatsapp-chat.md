# WhatsApp Chat — arquitetura (Reservas + Vendas)

Visão geral de como o chat do PMS conversa com o WhatsApp via **Evolution API**.
Vale para as duas linhas (`booking`/Reservas e `sales`/Vendas).

## Linhas e instâncias

Cada linha vive em `whatsapp_lines`:

| coluna | papel |
|---|---|
| `provider` | sempre `evolution` |
| `provider_instance` | nome da instância no Evolution (ex.: `milagres_hosp_res`, `milagres`) |
| `provider_token` | **token da instância**. Se `null`, cai no env `EVOLUTION_API_KEY`. |
| `phone` | número E.164 da linha (casado no webhook de entrada) |

> A key do env só autoriza UMA instância. Para a outra, cadastre o `provider_token`
> da instância no painel **Ajustes → WhatsApp → Conexão** (não usar a key global do
> servidor compartilhado — daria acesso a instâncias de outros tenants).

## Conexão / QR (Ajustes → WhatsApp)

- `GET /api/whatsapp/lines/[id]/connection` → `{ state, connected, authorized }`.
  Com `?connect=1` retorna também `{ qr (base64), pairingCode }`.
- Helpers: `getConnectionState` / `connectInstance` em `src/lib/whatsapp/evolution.ts`.
- A UI (`whatsapp-lines-shell.tsx` → `ConnectionModal`) faz polling do estado e
  mostra o QR/código dentro do PMS; fecha sozinha ao conectar. `authorized:false`
  (HTTP 401 do Evolution) → pede o `provider_token` da instância.

## Entrada (inbound)

`Evolution (MESSAGES_UPSERT) → n8n "MILAGRES - WhatsApp Reservas - Inbound" →
POST /api/webhooks/whatsapp/inbound` (autenticado por `x-webhook-secret`).

- O webhook do Evolution deve assinar **apenas `MESSAGES_UPSERT`**. `MESSAGES_UPDATE`
  não é tratado e gera mensagens "[mensagem não suportada]" (o nó Transform tem um
  guard que ignora eventos ≠ `messages.upsert`).
- O nó Transform monta `{ line_phone, contact_phone, text, ... }`. Para contatos
  `@lid` (ver abaixo), `contact_phone` fica sendo os dígitos do LID.

## Saída (outbound) — envio direto via Evolution

`POST /api/whatsapp/conversations/[id]/messages` → grava a mensagem como `pending`
→ envia via `sendText`/`sendMedia` (passando `line.provider_instance` +
`line.provider_token`) → marca `sent`/`failed` + `external_id`.

### Contatos `@lid`

Muitos contatos do WhatsApp se apresentam como identificador privado `@lid`
(número grande, 14-15 dígitos) e **não expõem o telefone real**. `toEvolutionRecipient()`
detecta isso (≥14 dígitos ou sufixo `@lid`) e envia para o JID `<lid>@lid` — o
Evolution resolve para o número real e entrega.

## Mídia (imagem / vídeo / áudio / documento)

1. O composer (`src/components/chat/chat-composer.tsx`, compartilhado pelos 2 chats)
   sobe o arquivo em `POST /api/whatsapp/media` (multipart, ≤16MB) → bucket **público**
   `property-images/whatsapp/...` → retorna `{ url, mime, name }`.
2. Em seguida posta a mensagem com `media_url` (a URL **pública** é necessária para o
   Evolution baixar o arquivo ao enviar).
3. Áudio é gravado com `MediaRecorder` nativo (webm/mp4) e segue o mesmo fluxo.
4. Render das bolhas: `src/components/chat/media-content.tsx` (img / `<video>` /
   `<audio>` / chip de download para documentos).
5. Emoji: `src/components/chat/emoji-picker.tsx` (sem dependência; categorias +
   busca + recentes), embutido no `ComposerTools`.

## Arquivos-chave

- `src/lib/whatsapp/evolution.ts` — cliente Evolution (send, connection, `@lid`).
- `src/components/chat/chat-composer.tsx` — composer único (texto + mídia + áudio + emoji).
- `src/components/chat/media-content.tsx` — render de mídia nas bolhas.
- `src/app/api/whatsapp/media/route.ts` — upload de mídia do chat.
- `src/app/api/whatsapp/lines/[id]/connection/route.ts` — estado + QR.
