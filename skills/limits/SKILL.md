---
name: limits
description: What can stop an app or game on KUMODeck, why, and the way around it: sizes, counts and rates (Cloudflare's own limits, the protections KUMODeck keeps, and the rest read from the refusal's details.limit), and the prepaid balance (KUMODeck is paid first, unlike Cloudflare; auto top-up keeps it running). Use when a request is refused for being too big, too many or too fast (413 save_too_large / payload_too_large / state_too_large / too_many_files / file_too_large, 400 too_many_variables, 429 rate_limited), when planning something large (big saves, big rooms, many files, heavy server code), when the user asks how much / how many / how big it can be, when a rate limit should be raised for the app (rateLimits in kumo.config.json) or a heavy Functions request stops at the CPU limit (it follows the prepaid balance), or why the app stopped when the balance ran out.
---

# Limits: what stops you, why, and the way around

KUMODeck runs your app or game on Cloudflare. The rule is: **KUMODeck should not leave you less free than renting
Cloudflare yourself.** So every limit is one of three kinds:

| Kind | What it is | What to do |
|---|---|---|
| **Cloudflare's own limit** (section 4) | the same limit you would meet on your own Cloudflare account | design within it; the numbers are below |
| **A protection KUMODeck keeps** (section 3) | it protects money (prepaid credit), accounts, or other people's apps on the same servers | stay within it, or take the way around in the table |
| **Anything else** (section 5) | a size or count KUMODeck chose; these are being raised to Cloudflare's level | do not write the number anywhere; read it from the refusal |

There is **no limit on how many projects or API keys** a creator has. Do not split work across projects because you
fear a count limit. (Secrets do have one, from Cloudflare: section 4.)

## 1. Read the limit from the refusal (never copy a number into the app)

Every refusal is JSON with `code`, `message`, `details` and often `hint`. The limit that was hit is in it:

| Refusal | Where the number is |
|---|---|
| a size or count (413 `save_too_large`, 400 `too_many_variables`, 413 `too_many_files` / `file_too_large`, …) | `details.limit` (and usually `details.size` = what you sent). Some realtime refusals (413 `payload_too_large`, 413 `state_too_large`) say it in `message` |
| a setting out of range (400 `invalid_request`, e.g. `kumodeck config push`, `kumodeck functions limits`) | `details.issues[].message` names the allowed maximum; `details.issues[].path` names the field |
| too fast (429 `rate_limited`) | `details.retryAfter` (seconds), `details.rule` (which rule), `details.limit` and `details.windowSeconds` (the rule's count and window), and `details.configurable` (`true` = the app can change it: section 3) |
| a broken page link in a list (400 `invalid_cursor`) | `details.cursor`: `malformed` or `other_list` — drop `cursor` and read again from the first page |

Rules for the code you write:

- **Do not hard-code KUMODeck's limits** (sizes, counts, rates) in the app, in checks before sending, or in docs you
  write for the user. They are being raised; a copy keeps refusing what the server already accepts. Let the request go
  and handle the refusal: show `message` / `hint`, or adapt using `details.limit`.
- Your **own** limits are fine (a notes app may stop at 1,000 notes per user). Name them as the app's own choice in a
  comment, so nobody mistakes them for KUMODeck's.
- On 429: wait `details.retryAfter` seconds, then retry once. Never retry in a tight loop, and never spread the load
  over extra projects or keys to dodge a rule: that is the abuse the rule exists to stop, and it gets the project paused.
- When you hit one, tell the user in one line: which limit (the `code`), the number (`details.limit`), and what you did
  about it.

## 2. Money: Cloudflare bills you later, KUMODeck is paid first

This is the biggest difference from renting Cloudflare yourself, and the one users meet first.

- **Cloudflare (your own account)** charges your card after the month. Nothing stops when you use more — the bill grows.
- **KUMODeck** takes usage at cost from **prepaid credit** the user added first. When the balance reaches $0 and nothing
  covers it, the paid parts **stop until money comes in**: the app's or game's site, its API (saves, sign-in),
  multiplayer rooms, Functions, and creating projects or deploying (402 `balance_due` for the creator's commands;
  users see a neutral "temporarily unavailable", 503 `service_unavailable`). Data is kept. The dashboard,
  `kumodeck config push`, reading data and adding funds keep working, and everything resumes by itself within about
  30 seconds after a top-up.
- **Why**: KUMODeck pays Cloudflare for every project at once. Without prepaying, one unpaid project would be paid by
  KUMODeck, with no ceiling. Prepaying is also the user's own ceiling: a bug or a flood can never cost more than the
  balance.
- **The way around: auto top-up.** In the dashboard's prepaid credit page the user saves a card and picks a threshold
  and an amount; when the balance drops below the threshold, the card is charged and nothing stops (unless the card
  fails — then KUMODeck emails them). **Before a launch, or whenever the app or game has real users, tell the user to turn
  on auto top-up.** You cannot do it for them (it is their card).
- A low-balance email comes first. `kumodeck billing` shows the balance and roughly how many days it lasts;
  `kumodeck billing topup` adds funds (the user pays on Stripe's page); `kumodeck usage` shows what used it.
- Adding funds, creating, deploying and secret keys need a confirmed email first (403 `email_unverified`: the
  `troubleshoot` Skill). It stops someone who took over a fresh account from charging another person's card.
- Functions' database commands (`kumodeck functions db query`, `db migrate`) also need prepaid credit (402 `balance_due`).

## 3. Protections KUMODeck keeps (and the way around)

The current values are given where they help you design; the refusal is still the source of truth.

| Limit | Why it exists | The way around |
|---|---|---|
| **Request rates** (429 `rate_limited`): e.g. about 60 save writes a minute per user; per-IP rates on the API, the hosted site, Functions and realtime connects; rates on deploy, `config push` and database admin commands | a single device, a buggy loop or a flood from someone else must not burn the creator's prepaid credit or slow other people's apps; admin commands share Cloudflare's per-account API budget | write less often (debounce: the `user-data` helper writes once per burst); wait `details.retryAfter`; batch admin changes. If real users (not a bug) hit a rule with `details.configurable: true`, raise it for this app with `rateLimits` (below). Sign-in guards and the creator's own commands cannot be changed there; for those, tell the user to write to the contact address in the "Asking for a higher limit" section of the docs site's Limits page (`/docs/limits/#asking-for-a-higher-limit` on the docs site — the same site `docsUrl` in errors points to) with the rule name (`details.rule`) |
| **Realtime messages per player**: 30 a second by default, with short bursts up to twice that; excess is dropped with a warning (`rate_limited`), and a player who keeps flooding is disconnected | a modified client must not multiply the creator's bill or drown the room | send positions at 10–20 per second and interpolate; send changes, not every frame; batch several values in one message. A game that really needs more raises it per mode: `multiplayer.modes[].limits.messagesPerSecond` (up to 240; the `multiplayer` Skill, section 4) |
| **Realtime channels**: per player, per channel and per IP send rates; open channels (anyone, no account) are small: short messages, few people, 1 message a second, 30 minutes per stay | channels without accounts cannot ban anyone, so the harassment space stays small | use player channels (signed-in) for anything bigger; rejoin after 30 minutes (the SDK does not rejoin open channels by itself) |
| **Voice calls**: a cap on people per call, calls end after 4 hours, each listener hears the loudest 8 | relaying audio costs money for every minute a forgotten tab stays open | rejoin to continue; leave the call when the match ends |
| **Call / direct-connection credentials** (TURN / SFU) per environment per minute (by default 3,000 TURN credentials and 2,400 voice sessions a minute) and per player per hour | Cloudflare's relay budget is one per account and shared by every app on KUMODeck; one app must not use it all | fetch credentials once per session, not on every reconnect. A launch that needs more raises its own environment with `multiplayer.relayQuota` in `kumo.config.json` (`turnIssuesPerMinute`, `sfuSessionsPerMinute`; up to 15,000 each = half of the shared budget, so other apps keep the rest; a higher value is refused by `config push` with the maximum). Issuing is free; relayed traffic is billed at cost. Beyond that, ask through the same contact |
| **Direct (P2P) signalling**: small messages, about 10 a second | the signalling server must not become a free relay that skips the room's price | use it only to connect; send game data over the direct connection or a server room |
| **Invite links for direct rooms** expire (default 30 minutes, at most 24 hours) | a leaked link lets strangers in only for a short time | make a new link when needed; set a longer expiry (up to the maximum) for a planned session |
| **Player sessions**: the access token lasts 15 minutes, the sign-in about 90 days | a stolen token is useful only briefly | nothing: the SDK refreshes by itself |
| **Sign-in protections**: passwords of 8 or more characters, failed sign-ins locked for a while, email links that expire | guessing passwords and codes, mail bombing | nothing to change; show the `message` |
| **Outbound `fetch` from Functions** is refused (403) to private IP addresses, cloud metadata addresses, names without a dot, KUMODeck's own internal addresses and mining pools | to stop server-side request forgery, and one creator's code getting the shared Cloudflare account suspended for everyone | call public `https://` addresses; put a private service of your own behind a public HTTPS address with its own authentication |
| **Automatic pause for mining, extreme CPU or a flood** of outbound requests (checked about every hour) | Cloudflare's terms: one abuser would stop everyone | do not run miners or proxies. Before a planned spike (a launch, an event), tell the user to let KUMODeck know through the same contact |
| **Secret and variable names**: `UPPER_SNAKE_CASE`; names starting with `KUMO_` are reserved | KUMODeck injects its own keys under `KUMO_`; your code must not be able to replace them | pick another prefix |
| **Deploys skip dotfiles and `node_modules`** (except `.well-known/`) | a `.env` with secrets must never become a public file | move a file you really want to publish out of a dot-named folder, or rename it |
| **Unfinished deploys**: a few at once per environment (429 `too_many_pending_deployments`), expiring after 24 hours | abandoned uploads must not fill storage | let a deploy finish before starting the next; wait for old ones to expire |
| **Custom domains** not verified in 7 days, or not active in 14 days, are removed | an abandoned claim must not let someone take a domain later | add the DNS records soon after `kumodeck hosting domains add` / `kumodeck functions domains add`; add it again if it was removed |
| **`kumo.config.json`**: one file has a total size cap; a push takes up to about 5 seconds to reach every server | the config is read on every request (CPU) | keep big content (texts, levels) in your own files or database, not in the config; wait a few seconds after a push before testing |
| **Request IDs** (`Idempotency-Key`) of up to 128 characters | keeps the database index small | use a UUID |
| **Payments for credit**: a cap per payment; auto top-up waits an hour between charges and a day after a failed one | stolen cards and double charges | add funds in several payments; fix the card in the dashboard |
| **KUMODeck's MCP tools**: about 120 calls a minute per tool per developer; `hosting_deploy` carries the files inside the conversation | a shared server for every developer; a conversation cannot hold a large site | use the `kumodeck` CLI for anything bigger than a small page (`kumodeck deploy`) and for loops of many calls |

### Changing a rate limit for this app (`rateLimits`)

Rate limits are counted per app, and the app can raise, lower or remove the ones a 429 marks `details.configurable: true`
(flood guards per IP address, a player's own writes, calls from the app's own server code). Write them in
`kumo.config.json`, then `kumodeck config push` (production only when the user asks):

```json
{ "rateLimits": {
  "api.default.ip": { "multiplier": 5 },
  "gamedata.save.player": { "limit": 600 },
  "functions.invoke.ip": { "limit": 100, "window": "1m" },
  "hosting.serve.ip": "off"
} }
```

- `{ "multiplier": x }` = a multiple of the default; `{ "limit": n }` = a count per window (add `"window"`: `30s`, `10m`,
  `1h`, `1d` to change the window too); `"off"` = do not apply the rule to this app.
- Use the rule name from `details.rule`. A name that cannot be changed (sign-in guards, the creator's account, money)
  makes the push fail with 400 and a list of the names that can.
- **Tell the user the trade-off in one line before raising or removing one**: requests above the default are normal usage
  billed at cost from prepaid credit, and with a flood guard removed, a flood from someone else is billed to them too.
  Lowering a rule is the way to protect a small app from floods.
- It takes up to about 5 seconds after the push to apply everywhere.

### Functions CPU time follows the prepaid balance

One Functions request (and one request to a server-rendered app) may use up to Cloudflare's own maximum CPU time
(30 seconds by default, up to 5 minutes, chosen with `kumodeck functions limits --cpu-ms <n>`). How much of that applies
**right now depends on the prepaid balance**:

- **Why**: usage reaches the balance a few minutes after it happens, so requests that run before the app is stopped at $0
  could cost more than the balance. Tying the per-request ceiling to the balance keeps that worst case inside it.
- **The rule today**: about 5 ms of CPU per request for every cent of balance, shared by the environments that run
  server code, never below 5 seconds and never above 5 minutes. For one environment: $20 → 10 seconds, $60 → 30 seconds,
  $600 → 5 minutes. Auto top-up amounts do not count until they are charged.
- The chosen value is kept even when the balance is too low; it applies by itself about a minute after a top-up.
- **Read it, don't compute it**: `kumodeck functions status --json` shows `limits.cpuMs` (what applies now),
  `limits.requested` (what was chosen), `limits.cpuMsCap` (what the balance allows) and `limits.requiredBalance` (the
  balance in cents the chosen value needs, or `null` when it is enough). When a heavy request stops at the CPU limit and
  `cpuMs` is below `requested`, tell the user that adding prepaid credit raises it; otherwise move the work into
  Queues or Cron, or split it.

## 4. Cloudflare's own limits (the same on your own account)

These come from Cloudflare (developers.cloudflare.com, "Limits" pages) or from a standard. They do not change by asking.

| Limit | Value | The way around |
|---|---|---|
| Server-rendered app (Worker) size | 64 MiB uncompressed | move large data to files or a database; drop unused dependencies |
| Memory per request | 128 MB | stream; process in parts (Queues, Cron) |
| One static or app asset file | 25 MiB | compress (`.ogg`, `.webm`), split, or keep it in R2 and fetch it |
| Variables + secrets per environment | about 124 together (Cloudflare allows 128 per Worker, vars and secrets counted together; KUMODeck's own `KUMO_` values use up to 4). 5 KB each (bytes: one Japanese character is 3 bytes); names up to 64 characters | keep one JSON secret instead of many small ones; keep large values in R2 or the database and only a key in the secret |
| D1 (SQLite) | one SQL statement 100 KB; 100 bound parameters; 100 columns per table; one row 2 MB; **one database 10 GB — Cloudflare cannot raise it, on your own account either** | insert many rows in several statements (`db.batch`); keep big blobs in R2 and the key in the row; when a database grows toward 10 GB, move tables (or users) into more databases |
| Logs | kept 7 days (`kumodeck logs`, MCP `functions_logs`) | write what must last to your own database |
| A multiplayer room (one Durable Object) | about 1,000 requests a second, and one stored value of at most 2 MB (the room's shared state lives in one value) | rule of thumb: **players in the room × messages each player sends a second ≤ about 1,000** (e.g. 30 players at 30 a second, or 100 players at 10). Every message also goes to every player, so the work grows with players²: for big crowds use several rooms; keep shared state small and send the rest as messages |
| Direct (P2P) rooms | every player sends to every other player, so a few players only (`p2p.maxPlayers`) | use a server room for more players |
| QR invite code | 2,953 bytes (the QR standard) | share the link instead of putting data in it |
| Numbers stored by KUMODeck (stats, quantities) | integers up to 10¹² (JavaScript's safe range) | store larger values in your own database as text |
| Sign in with Apple inside the iOS app | iOS 17.4 or later | older iPhones sign in on the web page |

## 5. Every other limit: read it, don't copy it

Other sizes and counts (save slots and their size, room size and message size, file counts per deploy, config counts,
list lengths) were chosen by KUMODeck and **are being raised to Cloudflare's own level**. That is why they are not
written here or in the other Skills:

1. Build without guessing a smaller limit. Do not pre-split data or pre-shrink assets "just in case".
2. If a refusal comes, read `details.limit` (section 1), then fit the design to it: split the data over more slots or
   rows, page through lists, put large files in R2, split a room. Tell the user which limit it was.
3. For Functions CPU time and subrequests (Cloudflare's own range; CPU also follows the balance, section 3):
   `kumodeck functions status` shows the current per-request setting and
   `kumodeck functions limits --cpu-ms <n> --subrequests <n>` changes it; a value above the maximum is refused with the
   maximum in `details.issues`. Add `--app` for a server-rendered app instead of Functions. The CPU time that runs is
   also capped by the prepaid balance (more balance, longer CPU time, up to Cloudflare's maximum): when the status says
   "you chose … ms", tell the user the balance it needs (`requiredBalance` in `--json`) and that `kumodeck billing topup`
   adds funds. Code that needs the range before asking reads `limitRanges` (`{ min, max, default }`
   for `cpuMs` and `subRequests`) from `GET /v1/admin/functions` (secret key; also at `/v1/projects/<id>/environments/<env>/functions`) on servers that
   send it.
   Heavy work that does not fit belongs in Queues or Cron.
4. The range for one prepaid top-up is `topUpLimits` (`{ min, max }` in cents) in `GET /v1/money/prepaid`, where the
   server sends it. Do not write dollar amounts into a page or a script.
5. Long lists page: when a response has `nextCursor`, pass it back as `cursor` until it is `null` or missing
   (Functions deployments, the prepaid ledger, …). Never assume the first page is everything. A cursor that was changed,
   cut off or taken from another list is refused on every list the same way (400 `invalid_cursor`): start again
   without `cursor`.

## 6. Limits in the templates are the app's own

Code copied from a template or a Skill is the user's code. Its limits are choices, not KUMODeck's rules — change them:

- `web-app`: `NOTES_PER_USER` (notes per user) in `functions/src/index.ts`; the list pages through all notes (`nextCursor`).
- `functions-starter`: the hourly cron deletes scores older than `KEEP_DAYS` (30 days). Raise it, or remove the
  `scheduled` handler (and the cron in `wrangler.jsonc`) to keep every score.
