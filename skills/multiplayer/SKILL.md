---
name: multiplayer
description: Make this game playable online on KUMODeck rooms with no server code to write. First asks one short plain-word question set (who plays, how fast, does cheating matter, or leave it to you) with the price of each way, then picks the setup (moves carried by KUMODeck or sent directly between players, room codes or automatic pairing) and builds it (live messages, shared state, reconnects). Use when the user asks to make it playable online, online multiplayer, play with friends, a versus / co-op / party mode, matchmaking, quick match, room codes or invite links (「オンラインで対戦できるようにして」「友だちと遊べるようにして」).
---

# Online multiplayer on KUMODeck rooms

KUMODeck runs the rooms: matchmaking, room codes, who is in the room, the host, live messages, shared state and
reconnects, over one WebSocket the SDK manages (`kumo.rooms`). There is **no server code to write** and nothing to
deploy besides the game. The game logic stays in the game: KUMODeck relays and keeps order, it does not referee.

File next to this SKILL.md (copy it, then adapt — do not rewrite it from scratch):

| File | Copy to | What it is |
|---|---|---|
| [multiplayer-client.js](multiplayer-client.js) | `public/multiplayer-client.js` (the game's deployed folder) | `playOnline()`: back to a kept seat after a reload, then a friend's code, a private room or quick match; events, reconnects, warnings |

## 0. Ask once, in plain words, with the price first

There is no single right way to play online: it depends on who plays, how fast the game is and whether cheating matters.
So multiplayer is the one exception to "build first" in `AGENTS.md`: **before building, ask ONE short set of questions,
then build**. Never a second round — if an answer is unclear, pick the cheapest row of the table below that fits and say
in one line what you picked. Skip the questions only when the user already answered them (for example "friends only,
it's a card game, no rankings") or said "leave it to you" / 「おまかせ」.

**Words for the user.** The user does not know our setting names. In the questions and in your explanation, never say
quick match, matchmaking, P2P / peer-to-peer, relay, TURN, transport, server, host or referee (and their Japanese
equivalents クイックマッチ・P2P・中継・サーバー経由・審判). Say what happens instead:

| Setting (for you only) | Say to the user |
|---|---|
| quick match | "automatically pair you with anyone who is waiting" / 「知らない人とも自動で組み合わせる」 |
| private room code | "send a friend a 6-letter code to join the same room" / 「友だちに 6 文字の番号を送って同じ部屋に入る」 |
| link invite (no KUMODeck at all) | "send your friend a link or a QR code, and they send a reply link back (2 messages)" / 「友だちにリンクか QR を送り、返事のリンクを送り返してもらう（2 回）」 |
| `transport: "server"` | "KUMODeck carries every move" / 「KUMODeck を通して届ける」 |
| `transport: "p2p"` | "connect the players' devices to each other directly" / 「プレイヤーどうしを直接つなぐ」 |
| relay (TURN) | "KUMODeck carries it so the other player cannot see where you are" / 「KUMODeck を通して届け、住んでいる地域を隠す」 |
| IP address visible | "the other player can see roughly where you live (city or region) from your connection" / 「相手に住んでいる地域の目安が見える」 |
| no referee | "nobody stops cheating, such as an impossible score" / 「ずる（ありえない点数など）を止められない」 |

**The price is the most important thing to show**, first on every choice, as a number (never "almost free" / 「ほぼ 0 円」
/ 「わずか」 — either 0 or a number, with the breakdown). Prices are per match of 4 players for 30 minutes, paid at cost
from prepaid credit (the invite credit is $5):

| Way | Price per match (4 players, 30 min) | Breakdown |
|---|---|---|
| KUMODeck carries every move — turn-based / chat | **about 0.31 cents** (≈ 1,600 matches for $5) | room open time 0.31 ¢ + moves under 0.01 ¢ |
| KUMODeck carries every move — casual real-time | **about 0.39 cents** (≈ 1,280 matches for $5) | room open time 0.31 ¢ + moves 0.08 ¢ (15 a second each) |
| KUMODeck carries every move — fast action | **about 0.47 cents** (≈ 1,060 matches for $5) | room open time 0.31 ¢ + moves 0.16 ¢ (30 a second each) |
| **Link or QR invite** (friends only) | **0 cents, completely** — nothing goes through KUMODeck | you send a link or QR, your friend sends a reply link back (2 messages); on some connections the two devices cannot reach each other and it does not connect |
| 6-letter code (compare with the link) | joining: about 50 cents per million joins (estimate) + the way the game is then played (rows below) | you tell the code once |
| Direct between players | **moves during the game: 0 cents**; pairing and joining the room: under 0.01 cents per match (estimate, not measured yet) | moves never reach KUMODeck |
| Direct, but KUMODeck carries it when needed (hides where you are) | the direct price + carrying: turn-based under 0.01 ¢, casual about 0.2 ¢, fast action about 0.3 ¢ (estimate, not measured yet) | carrying is billed by the amount sent ($0.05 per GB, at cost) |

These are guides from measured prices, not promises (an old SDK that cannot open the room's own connection costs about
20× — keep the SDK current). Write "about" / 「目安」 with every number.

**The question set** (one message, in the user's language; adapt the examples to the game, keep the price on each line):

> オンライン対戦のやり方を決めるため、3 つだけ教えてください（番号で答えて OK。全部「おまかせ」でも OK）。
> 1. 誰と遊ぶ？ — ① 友だちだけ（いちばん安いのは、リンクか QR を送り、返事のリンクを送り返してもらう = 完全 0 円。回線によってはつながらないことがある。6 文字の番号を 1 回伝えるやり方もある） ② 知らない人とも自動で組み合わせる ③ 両方
> 2. ゲームの速さは？ — ① 順番に動かす・チャット中心 ② のんびりリアルタイム（協力・パーティー） ③ 速いアクション
> 3. ずる（ありえない点数など）を止めたい？ — ① 気にしない（仲間うちで遊ぶだけ） ② 止めたい（ランキングや賞品がある）
> 4. おまかせ — いちばん安いやり方で私が決めます（4 人で 30 分遊んで、ゲーム中のやり取りは 0 円・部屋に入る分だけ 0.01 セント未満が目安）

> To pick how online play works, three quick questions (numbers are fine, or just say "leave it to you"):
> 1. Who plays? — ① friends only (cheapest: send a link or QR code and get a reply link back = 0 cents, but on some connections it cannot connect; or tell them a 6-letter code once) ② anyone: we pair you automatically ③ both
> 2. How fast is the game? — ① taking turns / chatting ② relaxed real-time (co-op, party) ③ fast action
> 3. Does cheating (an impossible score) matter? — ① no, we just play among ourselves ② yes, there are rankings or prizes
> 4. Leave it to you — I pick the cheapest way (4 players for 30 minutes: 0 cents for the moves, under 0.01 cents to join)

If you cannot tell how many players the game is for, add one line to the same message ("How many players in a match?").
That is still the one round.

**Answers → settings** (for you; the first row that matches wins):

| Answers | `transport` | `p2p.relay` | Modes | How players join | Price (4 players, 30 min) | What the user gives up (say it in one line) |
|---|---|---|---|---|---|---|
| Cheating matters (any speed) | `server` | — | from the game; `maxPlayers` as the game needs | as answered (1) | 0.31–0.47 ¢ by speed | the cheapest way; the game must still check scores that count in its own Functions + D1 (below) |
| More than 8 players in a match | `server` | — | `maxPlayers` as the game needs | as answered (1) | 0.31–0.47 ¢ by speed | the direct way (it holds 8 at most) |
| Friends only + "leave it to you" (or they chose the link) | — (no KUMODeck rooms) | — | none needed | **link or QR invite** (below); offer the 6-letter code as the backup when it does not connect | **0 ¢** | on some connections it cannot connect (then use the code); 2 messages instead of 1; the friend sees roughly where you live; nobody stops cheating |
| Friends only | `p2p` | `fallback` | `p2p.maxPlayers` 4 (up to 8) | room code | moves 0 ¢ + under 0.01 ¢; if carried, up to about 0.3 ¢ | friends can see roughly where each other lives; nobody stops cheating |
| Anyone, or both | `p2p` | `always` | `p2p.maxPlayers` 4 (up to 8) | automatic pairing (+ room code for both) | under 0.01 ¢ + carrying: under 0.01 ¢ (turns) to about 0.3 ¢ (fast) | nobody stops cheating; strangers never see where you are (that is what the carrying costs) |
| "Leave it to you" | `p2p` | `fallback` | from the game, `p2p.maxPlayers` 4 | room code and automatic pairing | moves 0 ¢ + under 0.01 ¢; if carried, up to about 0.3 ¢ | the other players can see roughly where you live; nobody stops cheating; if the game has rankings or prizes, use the first row instead |

- `p2p.relay` (Core is adding it on the way to replace `p2p.relayOnly`): `always` = every message goes through
  KUMODeck's relay, nobody's IP address is visible, always connects, billed by the amount sent; `fallback` = try a direct
  connection first and use the relay only when direct fails (the other players see your IP address, the relay is billed
  only when used); `never` = direct only, no relay cost ever, **and two players who cannot reach each other directly
  simply fail to connect** (`peer` event `state: 'failed'`). Use `never` only when the user says they want zero relay cost
  and accept that some friends may not connect; tell them that in one line.
- **Link or QR invite** (friends; first choice for friends + 「おまかせ」 because it is the cheapest): use the SDK's
  link entry `@kumo/sdk/link` (no project key, never calls KUMODeck; also as the global `KumoLink` from `dist/link.js`):
  ```js
  import { createInvite, acceptInvite, readLink, forwardReply, clearLinkFromUrl } from '@kumo/sdk/link';
  // A (the one who invites): show invite.link to share (LINE etc.) and draw invite.qrText as a QR code
  const invite = await createInvite();
  // ...when the friend's reply link comes back (pasted, or opened in another tab of the same browser):
  await invite.acceptReply(replyTextOrLink);           // then invite.peer is connected
  // B (the friend) and A's other tab: on page load
  const found = readLink();                             // { kind: 'invite' | 'reply', text } or null (reads #p2p=...)
  if (found?.kind === 'invite') { const reply = await acceptInvite(found.text); clearLinkFromUrl(); /* show reply.link + reply.qrText */ }
  if (found?.kind === 'reply' && !forwardReply(found.text)) { /* ask the player to paste it into the inviting page */ }
  // both sides: peer.send(type, data); peer.on('message', ({ from, type, data }) => ...); peer.on('closed', ...)
  ```
  The inviting page must stay open until the reply arrives. One friend = one link out and one reply back (links expire in
  30 minutes). The QR picture is not in the SDK: add a small QR component to the app. **Adding a new dependency (an npm
  package or a script from a CDN) needs the user's OK first** — ask in the same one-line report, or draw the QR with code
  already in the app. Errors come as `KumoError` with a plain English message to show players (the codes are listed in the SDK's
  link README). When the two devices cannot reach each other, show that message and offer the 6-letter code instead.
- Speed changes the price only (and the messages a second the game sends). It never makes a competitive fast-action feel
  possible (section 5): for fast action say so in the same line.
- Modes from "who plays": friends → the private room (`hostPrivate: true`, start with `online.start()`), `fillTimeoutSeconds`
  does not matter; anyone → `minPlayers` = the smallest match the game can play, `fillTimeoutSeconds` 20 for 2-player
  games, 15 for parties, 10 for fast action; both → the same mode with both buttons.
- After building, report in one line what you picked, its price and what it gives up, e.g. 「友だちと番号で入るやり方にしました。
  4 人で 30 分遊んで、ゲーム中のやり取りは 0 円・部屋に入る分は 0.01 セント未満（目安）。そのかわり相手に住んでいる地域の目安が見え、
  ずるは止められません」.

## 1. Turn it on (shortest path)

1. `kumodeck features on multiplayer` (sets `features.multiplayer` in `kumo.config.json`; the `multiplayer-starter`
   template already has it on).
2. Add one mode per way of playing to `kumo.config.json`, from the answers in section 0:
   ```json
   "multiplayer": { "modes": [
     { "key": "duel",    "minPlayers": 2, "maxPlayers": 2, "fillTimeoutSeconds": 20 },
     { "key": "friends", "minPlayers": 2, "maxPlayers": 4, "transport": "p2p", "p2p": { "maxPlayers": 4, "relay": "fallback" } },
     { "key": "public",  "minPlayers": 2, "maxPlayers": 4, "fillTimeoutSeconds": 15, "transport": "p2p", "p2p": { "maxPlayers": 4, "relay": "always" } }
   ] }
   ```
   - `minPlayers`: quick match waits until this many are in. `maxPlayers`: as many as the game needs (direct modes: up to `p2p.maxPlayers`,
     2–8, default 4 — every player sends to every other player). `fillTimeoutSeconds`: after this many seconds quick match
     starts with whoever is there, even 1 player (0 = wait forever, max 300).
   - `transport`: `server` (default) or `p2p`; `p2p.relay`: `always` | `fallback` | `never` (section 0).
   - No modes at all = a built-in `default` mode (2–8 players, 15 s), handy for a first try. Once you list one mode, only
     the listed ones exist (`unknown_mode` otherwise).
3. `kumodeck config push` (development). A rejected push names the path, e.g. `multiplayer.modes.0` when `minPlayers`
   is above `maxPlayers`: fix it and push again. Until it is on, connecting fails with `feature_disabled`.
4. Production only when the user asks to ship: `kumodeck config push --env production`.

## 2. Game side

1. Copy `multiplayer-client.js` into `public/`. `kumo` comes from `connectKumo()` (`kumo-boot.js`); players are signed in
   as guests automatically, which is enough for rooms.
2. Start online play from a button (never on page load, so a single-player path always remains):
   ```js
   import { playOnline } from './multiplayer-client.js';
   let online = null;
   quickBtn.onclick = async () => {
     try {
       online = await playOnline({
         kumo, mode: 'duel',
         onMessage: ({ from, type, data }) => { if (type === 'move') applyMove(from, data); },
         onPlayers: (players) => drawPlayers(players),   // [{ id, displayName, connected, state }]
         onState: (state) => drawBoard(state),
         onStatus: (s) => showStatus(s),                  // matching | playing | reconnecting | ended:<reason>
         onWarning: (w) => console.warn(w.code)           // rate_limited / payload_too_large: that message was dropped
       });
     } catch (e) { showStatus(e.code === 'match_cancelled' ? 'idle' : 'error'); }
   };
   cancelBtn.onclick = () => kumo.rooms.cancelMatch();    // while waiting for quick match
   ```
   When the online button appears (title or menu screen), call `warmUpOnline(kumo)` from the same file (it calls
   `kumo.rooms.warmUp()`): the connection and sign-in happen while the player reads the menu, so pressing the button only
   waits for the room itself.
   `online.room.timings` (`connectMs`, `replyMs`, `attachMs`, `attach`) shows where the wait went if joining feels slow.
   `attachMs` is still `null` right after joining (`attach: 'pending'`); `online.room.on('timings', (t) => …)` fires once
   it is known (`attach` becomes `'attached'`, `'failed'` or `'none'`), which is the moment to log them or send them to your own server.
3. **Friends** (no quick match): `playOnline({ kumo, mode, hostPrivate: true })` makes a private room; show
   `online.code` (6 letters) or an invite link `?join=<code>`; the friend runs `playOnline({ kumo, mode, code })`.
   At boot, read `?join=` from the URL and join that code. Private rooms never appear in quick match or `kumo.rooms.list()`.
   A lobby of open rooms: `await kumo.rooms.list('party')` → `[{ code, players, maxPlayers, metadata }]`.
4. **Talk**:
   - `online.send('move', { x, y })` → everyone else gets `message` (`{ to: [playerId] }` for one player). Ordered,
     fire-and-forget, only to players connected right now. For frequent updates (positions), send 10–20 times a second
     and interpolate on the other side.
   - `await online.setState({ turn: 'p-2', board })` → shared state; every player (the sender too) gets the same patches
     in the same order, so everyone agrees. `null` deletes a key. Use it for what a late joiner or a reconnecting
     player must see (whose turn, scores, the board, settings).
   - `await online.setMyState({ name, color, ready: true })` → this player's own state, seen by everyone.
5. **Start the match**: when everyone is ready, the host calls `online.start()` (locks the room: quick match stops adding
   players; `room_locked` for anyone trying to join).
6. **Host**: `online.isHost` / `room.hostId` = the earliest-joined connected player. When the host leaves or drops,
   the next player becomes host at once (`hostChanged`); a returning player never takes it back. For a game with rules
   (turns, hits, who won), let the host decide and publish the result with `setState`. For a friends' room where only
   the host may write shared state: `playOnline({ kumo, mode, hostPrivate: true, roomOptions: { hostOnlyState: true } })`
   (others get `host_only`; rooms made by quick match let every player write).
7. **Reconnects** (built in, keep them):
   - A dropped connection reconnects by itself and the server keeps the seat for **about 20 seconds** (default): the others see the
     player as `connected: false`; `onStatus('reconnecting')`, then `resumed` refreshes players and state from a snapshot.
     Messages sent meanwhile are **not** replayed: redraw from `room.state`, never from a message log.
   - After a page reload, `playOnline` goes back to the kept seat by itself (`kumo.rooms.fetchHeldRoom()` +
     `kumo.rooms.rejoin()`). Not back within 20 s → the others get `playerLeft` with reason `timeout`.
   - The room ends with `ended:<reason>`; show a neutral "Connection lost" and offer to play again.
8. **Direct modes** (`transport: "p2p"`): the same code works; `online.room.peers` / the `peer` event
   (`{ playerId, state, relayed }`) tell you who is connected. On `state: 'failed'` (happens with `relay: "never"` when two
   players cannot reach each other) show a plain message such as "Could not connect to this player — try again or play
   with a code on another Wi-Fi" instead of waiting forever. A full direct room refuses joins with `p2p_room_full`.
9. **Test with two players**: deploy to development (`kumodeck deploy --env development`), open the URL in two tabs and add
   `?player=2` to the second (templates give that tab its own guest). Without the templates' `kumo-boot.js`, use a second
   browser or a private window: one browser profile is one player, and a second tab replaces the first one's connection.

## 3. What the server guarantees, and what it does not

| KUMODeck enforces (server-side) | Not enforced: the game's job |
|---|---|
| who is in which room, seats, room codes, private rooms, `lock` | game rules: moves, hits, scores, who won |
| the host (who it is, hand-over), `hostOnlyState` | that the host is honest (a modified client can send anything) |
| one order of shared-state patches for everyone; size limits | positions and messages are whatever the client sent |
| per-connection rate limits; banned players cannot connect | results that matter (rankings, rewards): check them in the game's own Functions + D1 (`functions-d1` Skill) |
| development and production rooms never mix | cheating rules and what players may say in messages |

Say plainly to the user: rooms relay and keep order, they do not run the game on the server. For a competitive game,
make the host the referee (host decides, `setState` publishes); anything worth cheating for goes through their own
Functions and database. **Protect in D1, not in saves**: never trust a score a player's game reports to a ranking or a prize.

## 4. Limits (from the server; design within them)

The sizes below can change (KUMODeck adds no limits of its own beyond Cloudflare's), so this Skill gives no numbers for
them: a refusal names the limit (`details.limit`, or the `message`), and `kumodeck config push` refuses a `maxPlayers`
above the maximum and names it. Do not copy a number into the game. The `limits` Skill explains each limit and the way
around it.

| Limit | What you get when you pass it |
|---|---|
| Players per room (per mode, `maxPlayers`); quick match fills a room up to it | a push refused with `details.issues` |
| Message size per `send` | `payload_too_large` |
| Shared state / one player's state | `state_too_large` |
| Room metadata (lobby list) | `metadata_too_large` |
| Messages a second per player: about 30 (burst 60) — a protection that stays | the excess is dropped with a warning (`rate_limited`); send 10–20 a second and interpolate |
| Seat kept after a drop or reload: a short time (`seat_expired` after) | the player joins as new |
| Idle connection outside any room | closed; the next call reconnects |

One room is one server object: keep **players × messages per player per second at about 1,000 or less** (e.g. 30
players sending 30 a second). For bigger crowds, use several rooms.

Errors from `playOnline` / `kumo.rooms` carry `code`: `room_not_found` (wrong code, or a development code used in
production), `room_full`, `room_locked`, `unknown_mode`, `match_cancelled`, `seat_expired`, `already_in_room`,
`feature_disabled` (step 1), `balance_due` (prepaid balance used up: the `troubleshoot` Skill).

## 5. What to promise, and what not

- **Good fits**: turn-based and board / card games, quizzes, party games, co-op, casual real-time games for small
  rooms (2–8) that interpolate positions, lobbies and "play with a friend by code".
- **Do not promise** fast-action games that need a server simulation: competitive FPS, fighting games with rollback,
  anything needing lag compensation, server-side physics or anti-cheat. Rooms have no server-side game loop, a 30-a-second
  message cap and normal internet latency (players far apart feel it). Say so when asked; offer a host-decides design
  instead, or their own server code in Functions.
- **Not an MMO**: one room is one server object (section 4: players × messages a second ≤ about 1,000); a big world needs many rooms and its own design.
- **Not saved**: rooms keep nothing after everyone leaves. Keep progress with `kumo.saves` (the `user-data` Skill) and
  shared or protected data in D1 (`functions-d1`).
- Chat between players: use the `chat` Skill (realtime channels, history in their own database), not room messages.
- Direct modes (`"transport": "p2p"`) have no referee at all and hold at most 8 players: pick them only through the
  table in section 0, and always tell the user in one line what they give up (where they live is visible unless
  `relay: "always"`; nobody stops cheating; with `relay: "never"` some players may not connect).

## 6. Cost

Usage is billed at cost from prepaid credit like everything else (room time, messages; relay traffic by the amount sent).
The price per match for each way is the table in section 0 — show it to the user before they choose. Most of a
carried match's price is the room being open: leave the room when the match ends. Use the latest SDK: it connects each
room straight to its server, the cheap path (an old SDK costs about 20×). `kumodeck usage` shows the month by component.
