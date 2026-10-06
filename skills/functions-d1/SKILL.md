---
name: functions-d1
description: サーバー側で API を作って / KUMODeck の DB を使って保存して — protected or shared data. Write the project's own server code and SQL database on KUMODeck Functions (Cloudflare Workers + D1) for an app or a game — endpoints and webhooks, scheduled jobs, tables and migrations, and verifying which signed-in user is calling. Use when the user asks for their own API or backend logic, server-side checks, data shared between users, a database table or migration, a cron job, a webhook, secrets for a third-party API, or when another Skill (leaderboard, chat) needs the Functions folder, or "save this with KUMODeck's database" for data users must not change themselves (scores, coins, items, purchases, shared data).
---

# Your own server code + database (Functions and D1)

Functions run code the creator writes (a Cloudflare Worker) with a private SQLite database (D1) per environment — the
same freedom as renting a server and a database, with nothing to set up outside KUMODeck. Use it for anything the browser
must not decide alone: data shared between users, rules, payments with the creator's own Stripe, webhooks, calls to
other APIs with a secret key. The code and the data are the creator's.

Naming: KUMODeck's API calls users **players** (`players.verify`, `player_id` columns in the examples). In an app they are
simply users.

Files next to this SKILL.md (copy them, then adapt — do not rewrite them from scratch):

| File | Copy to | What it is |
|---|---|---|
| [api-kit.ts](api-kit.ts) | `functions/src/api-kit.ts` | `requireUser` (who is calling), `readJson`, `json`, `HttpError`, a tiny `router` |
| [polls.sql](polls.sql) | `functions/migrations/000N_polls.sql` (next free number) | example table: one vote per user per poll |
| [polls.ts](polls.ts) | `functions/src/polls.ts` | example endpoints built with the kit — the pattern for your own |

Copy `polls.*` only if the creator wants polls; otherwise use them as the model and write your own feature the same way.

**D1 or saves?** ("save it in a DB" can mean either.) Pick by who may change the data:

**Protect in D1, not in saves.** Anything a user must not be able to change themselves — scores and rankings, coins, credits, items, purchases, badges, anything shared between users — goes in the project's own Functions + D1. `saves` holds only what the user may freely write (settings, drafts, a solo game's progress).

| Put it in | What | Who writes it |
|---|---|---|
| **D1** (this Skill) | what must be protected: scores and rankings, coins, credits, items, purchases, a verified badge, anything shared between users | only the creator's server code |
| **saves** (the `user-data` Skill) | what the user may change freely: settings, progress notes, drafts, favorites, a game's save | the user's own browser (a changed value hurts nobody) |

When unsure: if a user changing it by hand would be a problem, it goes in D1. There is no call from Functions (or the
secret key) into a user's saves: keep the protected copy in D1 from the start.

## Codex: before calling KUMODeck

Read the `deploy` Skill's "Codex: tools and command permissions" section before remote commands. Discover exposed MCP
tools when the host offers that capability; otherwise use the installed CLI. For blocked communication, preserve the
implementation, request only permitted command access, and report the pending verification. Never bypass a denial.
DB / API work alone stays on development; only a publishing request continues to `deploy` §1. If KUMODeck returns
`approval_required` and a `confirmUrl`, use `deploy` §5's link flow: open the returned link, tell the user you are waiting
for their browser confirmation (no chat reply needed), then continue until success or error. CLI confirmation waits in
the existing command instead. Never click the human confirmation or claim unverified storage / API success.

## 1. Pick the defaults, then tell the creator (ask only what you truly cannot decide)

For a small app or game (a counter, a shared list, a simple API) do not stop to ask these one by one: pick the defaults
from the request, build it, then tell the creator in one line what you picked (they can change it). Ask only when you
truly cannot decide, and then only one question. What to decide:

1. **What the server owns**: which data lives in their database (shared lists, rooms, orders, scores, anything other
   users see), and which rules the server enforces (who may write what, limits, once-only actions). Default: what the
   request names, each row owned by the signed-in user who wrote it.
2. **Who can call each endpoint**: anyone (public reads), signed-in users only (their own writes), or only the
   creator's other systems (a webhook with a secret). Default: public reads, signed-in writes.
3. **Other services**: any third-party API or webhook? Its key (API key, password) is entered by **the user**, never by
   you and never through the chat. Ask the way every Skill does (`INDEX.md` → "Asking for a key"): call
   `functions_secret_set` with the name you pick and no value, and say
   "Paste the text that starts with sk- (from the OpenAI site) into the box that opens next."
   (with the service's site and how its text starts). If no box opens, the tool returns a link: give it with the same sentence.
   In a terminal: `kumodeck functions secret put NAME`. Default: none (this one you do ask about when the request needs
   one: you cannot guess a service or its key).
4. **Environments**: build and test on development; production only when the user asks to ship.

Never pick silently: the one line says what you chose. Say plainly that the rules and the data are theirs (KUMODeck runs
the code, it does not decide it).

## 2. The Functions folder

If the project has no folder with `wrangler.jsonc` + `src/kumo.ts`, create one next to the game or app:

```bash
kumodeck create api --template functions-starter   # in the app's folder (the one with kumo.json)
cd api && npm install --prefix functions
```

- Where: `api/` inside the app's folder (an app not made with `kumodeck create`: the same, after the `start` Skill's
  "Already have an app"). The app already has an `api/` folder: pick another name (`kumodeck create kumo-api …`).
  The app's pages are published from the app's folder itself (`kumodeck test-deploy .`): everything in that folder goes
  up, the Functions code too, so first move the page's files into `public/` together (index.html and what it loads:
  relative paths keep working) and publish that folder (`kumodeck test-deploy public`).
- **Do not run `kumodeck init` in `api/`**: every `kumodeck functions …` command finds
  the app's `kumo.json` in the folder above (the same project; init there would only issue unused keys). `kumodeck create`
  prints that it is linked, and does not copy the Skills and AGENTS.md into `api/` (the app's folder has them: one copy
  is enough, edit that one). If the app has no `kumo.json` yet, run `kumodeck init` in the app's folder first.
- Run every `kumodeck functions …` command in `api/`: they look for `wrangler.jsonc` in `./functions` (or the current
  folder). Paths you pass (`--outdir`, `--dir`) are relative to the folder you run the command in.
- `npm install` brings `wrangler` (which bundles the code for `kumodeck functions deploy` and runs `kumodeck functions dev`) and
  the Workers types. If packages cannot be installed here but a `wrangler` is (`wrangler --version`): bundle with it in
  `api/functions` — `wrangler deploy --dry-run --outdir .kumo/functions-build` — then `kumodeck functions deploy --no-build`
  (it reads that folder). Say that the code was not type-checked.

What is in it (other Skills — leaderboard, chat — assume this shape):

| Path | What it is |
|---|---|
| `wrangler.jsonc` | entry `src/index.ts`, `d1_databases` (binding `DB`), `triggers.crons`, `vars` (`ALLOWED_ORIGINS` = extra sites; the project's own are set by KUMODeck) |
| `src/index.ts` | `export default class … extends WorkerEntrypoint<Env>`: `fetch()` answers requests (CORS in `corsHeaders`), `scheduled()` runs the crons |
| `src/kumo.ts` | `new Kumo(this.env)`: `players.verify(authHeader)` → `{ id, displayName, banned } \| null`, `players.ban(id, { reason, durationHours })`, `players.unban(id)`, `request(method, '/v1/admin/…')` |
| `migrations/0001_scores.sql` | the starter's example table (numbered files, applied in order) |
| `.dev.vars` | local only: `KUMO_API_URL` and `KUMO_SECRET_KEY` (the **user** puts their `sk_dev_…` there; never print it). On KUMODeck both are injected |

Scheduled jobs on KUMODeck arrive as a request with `props.kumo.event = "scheduled"`; the starter's `fetch()` already
forwards them to `scheduled()`, so put cron work in `scheduled()` only.

## 3. Add endpoints

1. Copy `api-kit.ts` into `src/`. For your own feature, write a module like `polls.ts`: a function that returns
   `router([...])` over `this.env`.
2. Wire it in `src/index.ts` (the starter's `fetch` already computes `cors`), before the final 404:
   ```ts
   import { pollRoutes } from './polls';
   // in fetch(), before `return json({ error: 'not found' }, 404, cors);`
   const polls = await pollRoutes(this.env)(request, cors);
   if (polls) return polls;
   ```
   and add `DB: D1Database` to `Env` if you renamed the binding (the starter already has `DB`).
3. Rules for every endpoint:
   - **Who is calling = `requireUser(request, this.env)`** (from the verified token). Never take a user id from the
     body or the URL. Public reads need no token.
   - **Check every input** against rules in the code (allowed values, ranges, lengths). The browser can send anything.
   - **SQL with bound parameters only** (`prepare('… WHERE id = ?1').bind(id)`), never string-built SQL.
   - **Let the database enforce once-only and uniqueness** (`PRIMARY KEY` / `UNIQUE` + `ON CONFLICT DO NOTHING`, then
     check `meta.changes`), so two requests at the same moment cannot both win.
   - Several writes that must happen together: `await env.DB.batch([stmt1, stmt2])` (one transaction; D1 has no
     `BEGIN` in Workers).
   - Answer `{ error: '<code>' }` with the right status (the kit does it) so the page can branch on the code.

## 4. Tables and migrations

- New table or column → a **new** file `migrations/000N_<name>.sql` (next number). Never edit one that was applied.
  Use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`; add columns with `ALTER TABLE … ADD COLUMN …`.
- Locally: `npx wrangler d1 migrations apply DB --local`. On KUMODeck: `kumodeck functions db migrate DB` (development)
  and `kumodeck functions db migrate DB --env production` when shipping. Same migrations table as wrangler (applied files are
  skipped). The folder is `migrations_dir` of that database in `wrangler.jsonc` (default `migrations`); `--dir` overrides.
  The database on KUMODeck is created by the **first** `kumodeck functions deploy` of each environment (section 7).
- Look at data: `kumodeck functions db query DB "SELECT choice, COUNT(*) FROM poll_votes GROUP BY choice"`.
- A migration fails → the command says which file and what the database rejected (`migration_failed`; the files before
  it stay applied, the later ones did not run). Fix **that file** (it was not applied, so editing it is fine) and run the
  same `db migrate` again. A SQL mistake in `db query` answers `d1_query_error` with the database's message: fix the SQL,
  do not retry the same SQL.
- `kumodeck db migrate DB` / `kumodeck db query DB "…"` are the same commands (shorter). A server-rendered app's database (its own
  `wrangler.jsonc`, deployed with `kumodeck deploy`) works the same way, without enabling Functions (the `deploy` Skill).
- Store times as integers (ms), ids as TEXT. Keep a `player_id` column on per-user rows so the creator can delete a
  user's data on request (`DELETE FROM … WHERE player_id = ?`).

## 5. Run it locally

```bash
npx wrangler d1 migrations apply DB --local
kumodeck functions dev                 # = npx wrangler dev → http://localhost:8787
curl http://localhost:8787/health  # ok
curl http://localhost:8787/polls/favorite_color   # {"poll":"favorite_color","counts":{…},"total":0}
```

`.dev.vars` must hold the development `KUMO_API_URL` and `KUMO_SECRET_KEY` for `players.verify` to work locally (the user
copies `.dev.vars.example` and pastes their key). Crons locally: `npx wrangler dev --test-scheduled`, then open
`/__scheduled?cron=0+*+*+*+*`.

Keep local checks inside the project: put any test script or stand-in server in the project folder (for example
`functions/scripts/`), not in `/tmp` or anywhere else. Stop only what you started, by its PID (`kill <pid>`, or Ctrl+C where
it runs); never `pkill` / `killall`: they can stop the user's other programs.

## 6. Call it from the page

1. Put the Functions URLs in the `kumo-config.js` the page loads (public values), next to the existing settings:
   `functionsUrls: { development: 'https://…--dev.…', production: 'https://….…' }` (from `kumodeck functions status`, and
   `kumodeck functions status --env production` once production exists).
2. Send the user's token on calls that need it:
   ```js
   import { pageEnvironment } from './kumo-boot.js';
   const api = window.KUMO_CONFIG.functionsUrls[pageEnvironment()];
   const res = await fetch(`${api}/polls/favorite_color/vote`, {
     method: 'POST',
     headers: { 'content-type': 'application/json', authorization: `Bearer ${await kumo.auth.getAccessToken()}` },
     body: JSON.stringify({ choice: 'blue' })
   });
   const body = await res.json();      // 201 { choice } · 409 { error: 'already_voted' } · …
   ```
   Never block the page on it; show a message for the error codes.
   With a build step (Vite), `kumo-boot.js` is not imported in the source: use `boot.pageEnvironment()` from the module the
   page loaded at run time (the `start` Skill, "Already have an app" step 5).
3. Pages on the project's own KUMODeck URLs (development, production, verified custom domain), the origins in `web.allowedOrigins`
   of `kumo.config.json`, and localhost outside production may call the Functions. KUMODeck sets the project's own origins in
   `KUMO_ALLOWED_ORIGINS` and updates them by itself when a custom domain or `web.allowedOrigins` changes (no redeploy);
   if it could not, `kumodeck functions status` says "browser access is out of date" → run `kumodeck functions deploy` again.
   A page served from anywhere else needs its origin in `ALLOWED_ORIGINS` in `wrangler.jsonc` `vars` (comma-separated;
   `https://*.example.com` = its subdomains, not example.com itself) and a deploy. The shared `/play/…` address is never
   allowed (every project's pages run on that origin): call the Functions from the project's own URL instead.

## 7. Ship

```bash
kumodeck functions enable              # once per environment; needs prepaid credit
# first time in an environment: deploy first (it creates the database DB), then migrate
kumodeck functions deploy              # bundles with the local wrangler, uploads; prints "New empty database(s): DB" + the migrate line
kumodeck functions db migrate DB       # run the line the deploy printed (--json: newDatabases and next)
# every later change: migrate first, then deploy, so the new code finds its tables
kumodeck functions db migrate DB
kumodeck functions deploy
kumodeck functions status              # URL, version, databases, secrets, crons, limits
kumodeck logs                          # what the deployed code printed (last hour; --since 2d, up to 7 days; = kumodeck functions logs)
```

Between that first deploy and its migrate, endpoints that use tables fail: run the migrate right after it.
Production: the same commands with `--env production`, only when the user asks (production also starts with deploy →
migrate). Never create test users or rows in production: test on development. Keys for other services:
**the user** enters the value, asked the same way as everywhere (`INDEX.md` → "Asking for a key": `functions_secret_set`
without a value opens the box or returns the link; in a terminal `kumodeck functions secret put NAME`; after the first
deploy); read it as `this.env.NAME`.
Other commands: `kumodeck functions deployments`, `kumodeck functions limits --cpu-ms 500`, `kumodeck functions disable`
(stop serving, keep data). `kumodeck functions delete --purge` deletes the databases too: only when the user asks, and
say that it cannot be undone.

## 8. Errors and what to do

When a deployed endpoint or cron fails, read its logs first: `kumodeck logs --level error,warn` (development;
add `--env production` for the live app, `--since 2d` to go further back, `--search <text>` to narrow, `--json` for the
raw lines). With a server-rendered app in the same environment, its lines are mixed in by time: `--source functions`
for Functions only. The MCP tool `functions_logs` returns the same. Each line is time, `fn` / `app`, level,
`fetch` / `scheduled` / `queue`, message. Only what the code prints is there, so log the failing step and the error:

```ts
} catch (e) {
  console.error('vote failed', { userId: user.id, error: String(e) });   // IDs, not emails or tokens
  throw e;
}
```


| Error (code, HTTP) | Where | Fix |
|---|---|---|
| `sign_in_required` 401 | your endpoint (kit) | the page sends `Authorization: Bearer <kumo.auth.getAccessToken()>`; a token from the other environment never passes |
| `banned` 403 | your endpoint (kit) | the user is banned (see the `user-login` Skill for appeals) |
| `bad_json` 400 · `body_too_large` 413 | your endpoint (kit) | send a JSON object; raise `readJson`'s limit only if needed |
| `internal` 500 | your endpoint (kit) | read the logs (`kumodeck logs --level error`; locally `kumodeck functions dev`); fix the code |
| `functions_disabled` 409 | `kumodeck functions deploy` / `db migrate` | `kumodeck functions enable` (for that `--env`) |
| `d1_binding_not_found` 404 "D1 binding DB not found" | `kumodeck functions db migrate` / `db query` | the database is created by the first `kumodeck functions deploy`: deploy once, then migrate. If the message lists other names ("This environment has: …"), fix the binding name |
| `d1_query_error` 400 | `kumodeck functions db query` | the database rejected the SQL (`details.error`: syntax, missing table / column, constraint). Fix the SQL; a missing table usually means migrate was not run |
| `migration_failed` | `kumodeck functions db migrate` | fix the file it names (`details.failed`), run the same command again (applied files are skipped) |
| `functions_script_error` 400 | `kumodeck functions deploy` | the code throws while starting (`details.error` is the exception, often a top-level import or `new` of something missing): reproduce with `kumodeck functions dev`, fix, deploy again |
| `balance_due` 402 | `kumodeck functions enable` / `deploy` | the user adds credit: `kumodeck billing topup`, then run it again |
| `functions_not_deployed` 409 | `kumodeck functions secret put` / the dashboard's API keys screen / `kumodeck logs` | deploy once first |
| `logs_disabled` 409 | `kumodeck logs` | the live version was deployed with `--no-logs`: `kumodeck functions deploy` again without it (lines start from that deploy) |
| `rate_limited` 429 | `kumodeck logs` | log reads are limited for all of KUMODeck together: wait `details.retryAfter` seconds (it can be 300), read once, never in a loop; narrow `--since` / `--level` / `--search` |
| `functions_busy` 409 | `kumodeck functions deploy` | another deploy is running; retry |
| `invalid_request` 400 "Durable Objects are not available yet (usage metering is not in place). Use D1, KV or R2 for now." | `kumodeck functions deploy` | Durable Objects are not available on KUMODeck yet (`kumodeck functions dev` runs them locally, the deploy refuses them; nothing was changed). Remove `durable_objects` and `migrations` from `wrangler.jsonc` and keep the shared state in D1 (one row per room or chat, read and written by your endpoints); live rooms: the `multiplayer` Skill. Tell the user in one line that this part is not available yet |
| `functions_suspended` 403 | `kumodeck functions deploy` | `details.reason`: `balance` → the user adds credit (`kumodeck billing topup`), it resumes within a minute; anything else → the user answers KUMODeck's email |
| `token_expired` 401 | `players.verify` → `null` | normal after 15 minutes: the page's SDK refreshes; always call `getAccessToken()` right before the request |
| 503 from the Functions URL | users | the prepaid balance is used up: `kumodeck billing topup`; data is kept |
| CORS error in the browser | page | the page's origin is not allowed: `kumodeck functions status` shows the allowed sites (set by KUMODeck) and says when to deploy again; other sites go in `ALLOWED_ORIGINS`; also check the URL (development vs production) |

## 9. Cost and data

- Requests, CPU time, database rows read / written and storage are billed as KUMODeck's usage fee, at cost, from prepaid
  credit (roughly $0.60 a month for a small project: 1 million requests, 100 MB of data). Add indexes for the queries
  you run often (fewer rows read = cheaper and faster).
- What is in the database is the creator's to manage, including deleting a user's rows when they ask.
- Logs: each line the code prints is billed as KUMODeck's usage fee at cost ($0.60 per million lines); printing nothing costs
  nothing. Lines are kept 7 days, then deleted. **Never log personal data or secrets** (emails, passwords, access tokens,
  API keys, payment details, anything a user would not want others to see): everyone who can read the project's logs,
  including AI agents allowed to, sees them. Log IDs and error messages. Do not log inside a hot loop or on every request
  unless needed; for a version whose output nobody reads, `kumodeck functions deploy --no-logs` keeps none.
- Never put the secret key (`sk_…`) or a third-party secret in `wrangler.jsonc`, in the page, in git or in chat.
