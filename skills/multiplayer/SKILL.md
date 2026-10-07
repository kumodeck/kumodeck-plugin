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
| [multiplayer-client.js](multiplayer-client.js) | next to the game code that imports it: `public/` without a build step, `src/` with one (Vite) | `resumeAfterReload()` (page load: back in the match after a reload) and `playOnline()` (a friend's code, a private room or quick match); events, who dropped, reconnects, warnings |

## 0. Ask once, in plain words, with the price first

There is no single right way to play online: it depends on who plays, how fast the game is and whether cheating matters.
So multiplayer is the one exception to "build first" in `AGENTS.md`: **before building, ask ONE short set of questions,
then build**. Never a second round — if an answer is unclear, pick the cheapest row of the table below that fits and say
in one line what you picked. Skip the questions only when the user already answered them (for example "friends only,
it's a card game, no rankings") or said "leave it to you" / 「おまかせ」 — then the report after building must name the other ways (end of this section).

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
- **Then add one line with the ways you did not pick**, so the user knows they can ask (1–2 sentences, plain words from the
  table above, never naming what you already built). Built for friends → name pairing with strangers, more players and
  stopping cheating; built automatic pairing → name the friends' code or link and stopping cheating; built with KUMODeck
  carrying every move → name the cheaper direct way. For more players use the real numbers: the direct way holds 8 at
  most, more goes through KUMODeck (up to 1,000 a room; 4 players for 30 minutes cost about 0.31–0.47 cents). E.g.
  「知らない人とも自動で組み合わせたい、もっと多くの人数で遊びたい（直接つなぐ形は 8 人まで・それ以上は KUMODeck を通す形）、
  ずるを止めたいときは言ってください」. **Always add it when the request already decided the answers and you skipped the
  questions** (「友だちと遊びたい」, "leave it to you"): that is when the user has not seen the other ways at all.

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

1. Copy `multiplayer-client.js` next to the game code that imports it. `kumo` comes from `connectKumo()` (`kumo-boot.js`;
   a game not made with `kumodeck create`: the `start` Skill, "Already have an app"); players are signed in as guests
   automatically, which is enough for rooms. A game made for one player first: step 11.
2. On page load, before showing the menu, go back to a match this tab was in (a reload in the middle of a match —
   host or guest, including a guest who came by invite link):
   ```js
   import { playOnline, resumeAfterReload } from './multiplayer-client.js';
   const back = await resumeAfterReload({ kumo, mode: 'duel', ...callbacks }); // same callbacks as playOnline below
   if (back) { online = back; continueMatchFrom(online.state); } else showMenu();
   ```
   It goes back only when it is **the same tab, the same player and the seat is still kept** (about 10 s after the tab
   closed, 20 s after a dropped connection); otherwise it returns `null` at once without connecting. Redraw from
   `online.state` (messages sent while the page was reloading are not replayed). If only the host's tab ran the match
   (timers, physics), keep what must survive a reload in `setState`, or end the match plainly when the host comes back.
   Then start online play from a button (never on page load, so a single-player path always remains):
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
         onPresence: (p) => showPresence(p),              // { playerId, kind: disconnected|reconnected|left, reason }
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
   At boot, read `?join=` from the URL and join that code — **first thing**, before the heavy loading (3D models, sounds,
   big libraries): call `connectKumo()` from a small module that runs first and load the rest with dynamic `import()`, so
   signing in, connecting and joining (about half a second) overlap the loading instead of waiting behind it. Start the
   match as soon as `playerJoined` arrives (no extra handshake). `online.room.timings` shows where the wait went. Private rooms never appear in quick match or `kumo.rooms.list()`.
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
   the next player becomes host at once (`hostChanged`); a returning player never takes it back. The room is **not**
   closed when the host goes: it lives while anyone is in it. So if the host's tab runs the match, the new host must
   either carry on from `room.state` or end the match with a plain message ("The host left") — never leave a frozen screen. For a game with rules
   (turns, hits, who won), let the host decide and publish the result with `setState`. For a friends' room where only
   the host may write shared state: `playOnline({ kumo, mode, hostPrivate: true, roomOptions: { hostOnlyState: true } })`
   (others get `host_only`; rooms made by quick match let every player write).
7. **Someone dropped** (react at once, do not wait for `playerLeft`): `onPresence({ kind: 'disconnected', reason })`
   (`room.on('playerDisconnected')`) arrives within seconds — `reason: 'closed'` = they closed or reloaded the tab (the SDK
   tells the server when the page goes away), `'lost'` = their connection dropped or went silent. Show "Waiting for
   <name>…" and pause or let a bot take the seat. Then `reconnected` (back, carry on) or `left` (gone: `reason 'left'`
   about 10 s after a closed tab, `'timeout'` 20 s after a lost connection). In direct modes it also fires when only the
   direct link between two players broke.
8. **Reconnects** (built in, keep them):
   - A dropped connection reconnects by itself and the server keeps the seat for **about 20 seconds** (default): the others see the
     player as `connected: false`; `onStatus('reconnecting')`, then `resumed` refreshes players and state from a snapshot.
     Messages sent meanwhile are **not** replayed: redraw from `room.state`, never from a message log.
   - After a page reload, `resumeAfterReload()` (page load) or `playOnline` (button) go back to the kept seat
     (`kumo.rooms.rejoinIfReloaded()` / `fetchHeldRoom()` + `rejoin()`). A closed tab keeps the seat ~10 s; a mode with a
     longer `seatHoldSeconds` keeps its own time.
   - The room ends with `ended:<reason>`; show a neutral "Connection lost" and offer to play again.
9. **Direct modes** (`transport: "p2p"`): the same code works; `online.room.peers` / the `peer` event
   (`{ playerId, state, relayed }`) tell you who is connected. On `state: 'failed'` (happens with `relay: "never"` when two
   players cannot reach each other) show a plain message such as "Could not connect to this player — try again or play
   with a code on another Wi-Fi" instead of waiting forever. A full direct room refuses joins with `p2p_room_full`.
10. **Test with two players**: deploy to development (`kumodeck test-deploy`), open the URL in two tabs and add
   `?player=2` to the second (templates give that tab its own guest). Without the templates' `kumo-boot.js`, use a second
   browser or a private window: one browser profile is one player, and a second tab replaces the first one's connection.
11. **A game made for one player** (against the computer: a race, a duel, a board game with a computer side). Keep the
   single-player game as it is (it stays the offline path) and change only where the other side's moves come from:
   - Find the line that asks the computer for its move and use the other player's last input there instead. The game's
     rules, its loop and its drawing stay:
     ```js
     // once a frame, in the host's loop (the same step() the single-player game calls)
     const rival = online ? friendInput : cpuThrottle(race);    // friendInput = the last 'input' message
     step(race, { player: myInput, cpu: rival });
     ```
   - One page runs the rules: the host's. It sends the result 10–20 times a second (`online.send('race', race)`); the
     friend's page sends only its own input (`online.send('input', { throttle })`) and draws the race it receives. The
     friend sits in the seat the computer had: draw "you" and "the other player" from that seat.
   - The end goes in shared state (`online.setState({ winner })`), so both pages, and one that reconnects, show the same
     result.
   - `onPresence` `disconnected`: pause the host's loop; `left`: end with a plain message ("The other player left") and
     offer the computer again.
   - The single-player save and personal best stay as they are; an online result that must count (a ranking, a prize)
     goes through the game's Functions + D1 (section 3).

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

**When the server must decide the game** (who wins, whether a move is allowed, a hidden hand of cards): KUMODeck's rooms
carry messages and do not run game rules. Two ways, pick from the request and tell the user in one line:

| Way | When | How |
|---|---|---|
| Host decides (no server code) | friends playing together; cheating is not a worry | one player's page decides (`examples/sky-duel`) |
| The server checks every move | rankings, prizes, strangers, anything paid | the game's own room on the server: the `functions-d1` Skill, section 10 (a match room that checks each move). The page connects to the Functions URL instead of `kumo.rooms` |

The second way costs a little more (about half a cent for a 10-minute 4-player match, see `functions-d1` section 10) and
needs the user's prepaid credit for Functions.

## 4. Limits (set them per mode; design within them)

Each room's limits come from its mode. The defaults suit most games; a game that needs more raises them in the mode's
`limits` in `kumo.config.json`, up to a maximum that comes from Cloudflare (one room is one Durable Object: about 1,000
requests a second and one stored value of 2 MB). `kumodeck config push` refuses a value above the maximum and names it.
The numbers below are for choosing the values in `kumo.config.json`. Do not copy them into the game's code: a refusal
names the limit (`details.limit`, or the `message`). The `limits` Skill explains why each one exists.
In a room, `room.limits` has that room's values (`maxMessageBytes`, `maxStateBytes`, `maxPlayerStateBytes`, `messagesPerSecond`, `seatHoldMs` in milliseconds; `null` on an older server).

```json
{ "key": "battle", "minPlayers": 2, "maxPlayers": 16,
  "limits": { "messagesPerSecond": 60, "maxMessageBytes": 65536, "maxStateBytes": 262144, "seatHoldSeconds": 60 } }
```

| Limit (in the mode) | Default → maximum | What you get when you pass it |
|---|---|---|
| Players per room (`maxPlayers`); quick match fills a room up to it | as written → 1,000 | a push refused with `details.issues` |
| Messages a second per player (`limits.messagesPerSecond`) | 30 (short bursts up to twice that) → 240 | the excess is dropped with a warning (`rate_limited`); a player who keeps flooding is disconnected |
| Message size per `send` (`limits.maxMessageBytes`) | 16 KB → 1 MB | `payload_too_large` |
| Shared state (`limits.maxStateBytes`) / one player's state (`limits.maxPlayerStateBytes`) | 64 KB → 1 MB / 8 KB → 64 KB; shared state plus every player's state stays under 1.75 MB in all | `state_too_large` |
| Seat kept after a drop or reload (`limits.seatHoldSeconds`) | 20 s → 1 hour (`seat_expired` after) | the player joins as new |
| Room metadata (lobby list) | — | `metadata_too_large` |
| Idle connection outside any room (`multiplayer.idleTimeoutSeconds`, for the whole game) | 10 minutes → 1 day | closed; the next call reconnects |

- One room is one server object: keep **players × messages per player per second at about 1,000 or less** (e.g. 30
  players sending 30 a second). Every message goes to every player, so raising `messagesPerSecond` or `maxPlayers` far
  makes the room slow before it reaches the maximum: send 10–20 a second and interpolate, batch values in one message,
  and use several rooms for bigger crowds.
- Raised limits cost what they use (more messages, more data) at cost from prepaid credit. Tell the user in one line
  when you raise one, and why.
- **Direct modes** (`"transport": "p2p"`): game data never passes through KUMODeck's servers, so there is no size limit
  by default (the SDK splits large messages and states). A game that wants its own limits, for example so a modified
  client cannot push a huge state, sets them in the page:
  `kumo.rooms.setP2POptions({ maxMessageBytes, maxStateBytes, maxPlayerStateBytes })` (going over gives
  `payload_too_large` / `state_too_large` with `details.limit`). One received message is capped at 64 MiB by default
  (`maxReceiveBytes`, to protect the player's device; raise it only for games with very large states). The same call
  tunes connecting: `connectTimeoutMs` (10 s), `disconnectGraceMs` (5 s), `maxRestarts` (3), `offerWaitMs` (5 s),
  `stateTimeoutMs` (15 s); these also apply to voice. It applies to direct rooms started after the call.
- **Relay budget** (direct modes with `relay: "always"` or `"fallback"`, and voice): each environment may issue a limited
  number of relay credentials a minute (by default 3,000 a minute, plus 2,400 voice sessions). For a big launch,
  raise it with `multiplayer.relayQuota` (`turnIssuesPerMinute`, `sfuSessionsPerMinute`; up to 15,000 each) — the budget
  is shared with every other app on KUMODeck, which is why it stops there. Issuing is free; relayed traffic is billed at cost.

Errors from `playOnline` / `kumo.rooms` carry `code`: `room_not_found` (wrong code, or a development code used in
production), `room_full`, `room_locked`, `unknown_mode`, `match_cancelled`, `seat_expired`, `already_in_room`,
`feature_disabled` (step 1), `balance_due` (prepaid balance used up: the `troubleshoot` Skill).
Joining that fails part-way (`join_connection_lost`, `join_timeout`; `create_…` / `match_…` the same for making a room or quick
match): the SDK already retried a join once, so show the message (`e.message`, e.g. "The connection dropped while joining the room.
Try again.") with a **Try again** button that calls `playOnline` with the same code — never a bare `Could not join (code)` back on the menu.

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
- Live features that are not a game (a chat with its own rules, a live feed, a counter many people press): the
  `functions-d1` Skill, section 10.
- Direct modes (`"transport": "p2p"`) have no referee at all and hold at most 8 players: pick them only through the
  table in section 0, and always tell the user in one line what they give up (where they live is visible unless
  `relay: "always"`; nobody stops cheating; with `relay: "never"` some players may not connect).

## 6. Cost

Usage is billed at cost from prepaid credit like everything else (room time, messages; relay traffic by the amount sent).
The price per match for each way is the table in section 0 — show it to the user before they choose. Most of a
carried match's price is the room being open: leave the room when the match ends. Use the latest SDK: it connects each
room straight to its server, the cheap path (an old SDK costs about 20×). `kumodeck usage` shows the month by component.
