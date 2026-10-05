---
name: chat
description: Add in-game chat (a lobby, a party or a match channel with saved history) to this game, using realtime channels for live messages and the game's own Functions and SQL database for checks and history. Use when the user asks for chat, messages between players, a lobby chat, party chat or chat history.
---

# Chat on realtime channels + your own Functions and database

Live messages travel through a **realtime channel** (`kumo.realtime`): everyone in the channel gets them instantly, and
the channel stores nothing. This recipe adds the rest in code the creator owns: their own Functions check who sent a
message and apply their rules, and their own SQLite database (D1) keeps the history. The code, the rules and what to
allow in chat belong to the creator.

Files next to this SKILL.md (copy them, then adapt the settings — do not rewrite them from scratch):

| File | Copy to | What it is |
|---|---|---|
| [chat.sql](chat.sql) | `functions/migrations/000N_chat.sql` (next free number) | the table and indexes |
| [chat.ts](chat.ts) | `functions/src/chat.ts` | the endpoints, the `CHANNELS` settings, the clean-up |
| [chat-client.js](chat-client.js) | `public/chat-client.js` (the game's deployed folder) | joins the channel, shows history + live messages, sends |

Do not use `kumo.chat` or the `chat` feature for this; the messages live in the creator's database.

**Protect in D1, not in saves.** Anything a user must not be able to change themselves — scores and rankings, coins, credits, items, purchases, badges, anything shared between users — goes in the project's own Functions + D1. `saves` holds only what the user may freely write (settings, drafts, a solo game's progress).
Chat history is shared between users, so it goes in D1, never in `saves`.

## 1. Ask the creator first (they decide; offer these as choices, one short message)

1. **Channels**: which ones and who is in them — e.g. one `lobby` for everyone, a channel per match (`match-<id>`,
   use a pattern key `match-*`), or invite-only party rooms players create (`kumo.realtime.create({ join: 'invited' })`,
   pattern key `@*`). Channels not listed in `CHANNELS` are not saved.
2. **Delivery** (per channel):
   - `direct` — the game saves the message on their server, then sends it to the channel itself. Fastest and cheapest,
     but a modified game could skip the server and send anything straight to the channel.
   - `server` — their server checks, saves and then sends it to the channel with the secret key; the game shows only
     messages that came from the server. Nothing unchecked is shown. One extra hop per message, and the secret key can
     send about 600 messages a minute (fine for most games; busy lobbies should use `direct`).
3. **Against abuse** — pick any mix, or none:
   - **Length**: `maxLength` characters (default 200).
   - **Rate**: at most `maxPerMinute` messages per player per channel (default 20).
   - **Blocked words**: a list the creator writes (`blockedWords`), and whether to refuse the message
     (`onBlocked: 'reject'`) or replace the word with `***` (`'mask'`). No list is built in: the words are the creator's choice.
   - **Moderation**: channel owners can `mute` / `kick` / `ban` in their room; the creator's server can do the same in any
     channel (`POST /v1/realtime/channels/:name/moderate`), and ban a player from the whole game (`players.ban` in `kumo.ts`).
     A mute or ban in the channel works in both places: the channel refuses the live message, and `chat.ts` asks the
     channel before saving, so the history and `server` delivery refuse it too (within about 3 seconds, see step 3.5).
   Say plainly that watching what players write is the creator's job, and that no filter catches everything.

Do not pick silently. If the creator says "you choose", use one `lobby` channel, `direct`, 200 characters,
20 per minute, no blocked words, and tell them.

## 2. Turn on realtime channels

`kumodeck features on realtimeChannels`, then `kumodeck config push --env development` (production later, when the user asks).
Until then joining a channel fails with `feature_disabled`.

## 3. Server side (Functions)

1. Find the Functions folder (it has `wrangler.jsonc` with a `DB` database and `src/kumo.ts`). If there is none, create
   one in the game's folder: `kumodeck create api --template functions-starter` (no `kumodeck init` in `api/`: `kumodeck functions …`
   uses the game's `kumo.json` above; details in the `functions-d1` Skill §2). Its README has the local setup (`.dev.vars` — the **user** puts their `sk_dev_…` there; never print it).
2. Copy `chat.sql` into `migrations/` with the next number. Keep the table name, column names and types exactly as they
   are (`chat.ts` depends on them). Extra tables of your own are fine.
3. Copy `chat.ts` into `src/`. Set `CHANNELS` from the creator's answers, e.g.
   ```ts
   export const CHANNELS: Record<string, ChatRule> = {
     lobby:     { delivery: 'direct', maxLength: 200, maxPerMinute: 20, blockedWords: [], onBlocked: 'reject' },
     'match-*': { delivery: 'server', maxLength: 120, maxPerMinute: 30, blockedWords: ['badword'], onBlocked: 'mask' }
   };
   ```
   `KEEP_DAYS` controls how long messages are kept (the scheduled clean-up deletes older ones).
4. Wire it in `src/index.ts` (the starter's `fetch` already computes `cors`):
   ```ts
   import { cleanupChat, handleChat } from './chat';
   // in fetch(), before the final 404:
   const chat = await handleChat(request, this.env.DB, {
     verify: (auth) => new Kumo(this.env).players.verify(auth),
     relay: (channel, type, data) =>
       new Kumo(this.env).request('POST', `/v1/realtime/channels/${encodeURIComponent(channel)}/messages`, { type, data }),
     room: (channel) => new Kumo(this.env).request('GET', `/v1/realtime/channels/${encodeURIComponent(channel)}`),
     headers: cors
   });
   if (chat) return chat;
   // in scheduled():
   await cleanupChat(this.env.DB);
   ```
   `relay` is only used by `server` channels. Every message is checked with `players.verify`: the sender's **player
   ID** comes from their token and cannot be faked, and players banned from the game are refused. The **display name**
   is not proof of anyone: any player can pick the same name as someone else, or a name like "Admin" (step 4.3).
5. **Who may post** (on by default, keep it): before saving, `chat.ts` asks the channel with the secret key (`room`,
   `GET /v1/realtime/channels/:name`) and refuses with 403 when the sender is not in the channel (`not_in_channel`),
   is banned there (`channel_banned`), is muted there (`muted`), or the channel lets only invited players send
   (`send: 'invited'`) and they are neither a speaker nor the owner (`send_forbidden`). The same check for `direct` and
   `server` channels: otherwise a muted player could still put lines into the history (and, on `server` channels, have
   your server relay them to everyone). The parts of the answer it reads:
   ```json
   { "ownerId": "p-1", "send": "anyone", "speakers": [], "banned": ["p-9"],
     "muted": [{ "playerId": "p-7", "until": "2026-10-01T12:00:00.000Z" }],
     "members": [{ "id": "p-1", "displayName": "Mia", "anonymous": false }] }
   ```
   One answer is reused for 3 seconds per channel (`ROOM_CACHE_MS`), because these calls share the key's limit of
   300 a minute with mute / kick / ban; so a fresh mute reaches the history within about 3 seconds. A channel that
   cannot be asked refuses the message (503 `room_check_failed`), it never lets it through. For your own rule (a team
   check, say), pass `canPost: async (player, channel, rule) => true | false | 'short_code'` instead; it replaces the
   channel check, so call `roomRefusal(room, player.id, Date.now())` from it if you still want that. Without `room` or
   `canPost`, posting fails with 500 `room_check_not_configured` (nothing is saved unchecked).
6. Invite-only rooms (`@…`): by default any signed-in player can read a saved channel's history. For rooms where only
   members should read it, add `canRead` to the options and check the channel's lists with the secret key:
   ```ts
   canRead: async (player, channel) => {
     if (!channel.startsWith('@')) return true;
     const room = await new Kumo(this.env).request<{ ownerId: string | null; allow: string[]; members: { id: string }[] }>(
       'GET', `/v1/realtime/channels/${encodeURIComponent(channel)}`).catch(() => null);
     return !!room && (room.ownerId === player.id || room.allow.includes(player.id) || room.members.some((m) => m.id === player.id));
   }
   ```
7. Try it locally: `npx wrangler d1 migrations apply DB --local` → `kumodeck functions dev`; a request without a token,
   `curl "http://localhost:8787/chat/history?channel=lobby"`, answers `{"error":"sign_in_required"}`.
8. Ship (development first): `kumodeck functions enable` (once; needs prepaid credit) → `kumodeck functions db migrate DB` →
   `kumodeck functions deploy` → `kumodeck functions status` shows the URL. Production: the same with `--env production`,
   only when the user asks.

Endpoints (all JSON, all need the player's token; errors are `{ "error": "<code>" }`):

| Call | Answer |
|---|---|
| `GET /chat/history?channel=&limit=50[&before=<id>]` | `{ channel, delivery, maxLength, messages: [{ id, clientId, playerId, name, text, at }] }` — oldest first |
| `POST /chat/messages` `{ channel, text, clientId }` | `{ message }` — the saved message (with masked words, if any) |

Error codes: 401 `sign_in_required`, 403 `banned` / `not_allowed` / `not_in_channel` / `channel_banned` / `muted` /
`send_forbidden`, 400 `unknown_channel` / `bad_channel` /
`text_required` / `too_long` / `blocked_word` / `bad_client_id`, 429 `too_many_messages`, 502 `delivery_failed`
(`server` channels: not delivered, so not kept either), 503 `room_check_failed`, 500 `relay_not_configured` /
`room_check_not_configured` (a wiring mistake).

## 4. Game side

1. Put the Functions URLs in one place, `public/kumo-config.js` (public values only), next to the existing settings:
   `functionsUrls: { development: 'https://…--dev.…', production: 'https://….…' }` (from `kumodeck functions status`).
2. Copy `chat-client.js` into `public/` and open the chat after sign-in:
   ```js
   import { pageEnvironment } from './kumo-boot.js';
   import { openChat } from './chat-client.js';
   const chat = await openChat({
     url: window.KUMO_CONFIG.functionsUrls[pageEnvironment()],
     kumo,
     channel: 'lobby',                       // or a Channel from kumo.realtime.create({ join: 'invited' })
     onMessage: (m) => addLine(m)            // { id, clientId, playerId, name, text, at, mine }
   });
   input.maxLength = chat.maxLength;
   form.onsubmit = async (e) => {
     e.preventDefault();
     try { await chat.send(input.value); input.value = ''; }
     catch (err) { showHint(err.code); }     // too_long, blocked_word, too_many_messages, muted, rate_limited, …
   };
   const older = await chat.more();          // "load earlier messages"
   ```
   `addLine` must set `textContent` (never `innerHTML`): names and messages are whatever players typed.
3. Names come from the player's display name. Let players set one so the chat does not fill up with empty names.
   Display names are not unique and not checked: two players can share one, and anyone can call themselves "Admin" or
   the room owner's name. Only `playerId` is proven. Show owner / staff badges from IDs (`playerId === ownerId`, a list
   of staff IDs on your server, or `from === 'server'` for messages your server sends), never from the name.
4. Keep the game playable when chat fails (wrap `openChat` in try/catch). Messages sent while a player was
   disconnected are not replayed live; `openChat` again (or `more()`) loads them from the history.
5. The game's own KUMODeck URLs (development, production, its verified custom domain) and `web.allowedOrigins` may call the
   Functions: KUMODeck sets them (`KUMO_ALLOWED_ORIGINS`) and updates them when those change. If it could not,
   `kumodeck functions status` says to deploy again. Any other site needs its origin in `ALLOWED_ORIGINS` in `wrangler.jsonc` `vars`.
6. Players who are not signed in (no player id) can only be in channels the creator's server opened for them, and their
   messages cannot be saved (there is no one to verify). Keep chat for signed-in players (the default guest sign-in counts).

## 5. Notes for the creator

- Cost: each message is one row written plus one realtime message (`server` channels: plus one call to the realtime
  API), each post asks the channel at most once per 3 seconds per channel (the "who may post" check), each history
  page reads up to `limit` rows; billed at cost from prepaid credit like everything else.
- The data is theirs: to delete a player's messages on request,
  `DELETE FROM chat_messages WHERE player_id = ?` (with `kumodeck functions db query DB "…"`), and one message by `id` the same way.
- Keep the table and column names when changing the code later; add new columns or tables instead of renaming, so
  existing history keeps working.
