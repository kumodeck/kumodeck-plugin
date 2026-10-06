---
name: troubleshoot
description: Fix errors from KUMODeck (the kumodeck CLI, the SDK calls in a web app or game, its own Functions) by their error code — 402 balance_due, 403 email_unverified, confirmation_required (production changes confirmed by a link), feature_disabled, feature_unavailable, origin_not_allowed, CORS errors, slug_taken, rate_limited, 503 service_unavailable and more — and find the balance, usage, history, settings and the logs of deployed Functions and server-rendered apps. Use when a `kumodeck` command, a KUMODeck call in the app or game, or a deployed function fails, the page shows no backend, or the user asks why something stopped working, how much they spent or what their balance is.
---

# Troubleshoot KUMODeck errors

Read the **code**, not the message: codes are stable, messages change. Then fix the cause and run **the same command
again**. Never work around a refusal (another command that does the same thing, a hand-made request, turning off a check):
if something is refused on purpose, tell the user what and why.

## Codex: before calling KUMODeck

Read the `deploy` Skill's "Codex: tools and command permissions" section before remote commands. Discover exposed MCP
tools when the host offers that capability; otherwise use the installed CLI. For blocked communication, preserve the
implementation, request only permitted command access, and report the pending verification. Never bypass a denial.
DB / API work alone stays on development; only a publishing request continues to `deploy` §1. If KUMODeck returns
`approval_required` and a `confirmUrl`, use `deploy` §5's link flow: open the returned link, tell the user you are waiting
for their browser confirmation (no chat reply needed), then continue until success or error. CLI confirmation waits in
the existing command instead. Never click the human confirmation or claim unverified storage / API success.

## 1. Where the code is

| Where it failed | How to read it |
|---|---|
| a `kumodeck` command | Run it again with `--json`: `{ "ok": false, "error": { "code", "message", "details", "hint" } }`. `hint` is the next command to run. Exit codes: 1 server or connection, 2 wrong usage, 3 not logged in |
| the app or game (SDK) | A failed call throws an error with `status`, `code`, `details` (log `e.code` in the catch). Open the browser console of the page |
| the KUMODeck API directly | `{ "error": { "code", "message", "details" } }` with the HTTP status |
| the project's own Functions | whatever that code returns (the Skills return `{ "error": "<code>" }`). What the deployed code printed: `kumodeck functions logs` (last 7 days; see section 3). Locally `kumodeck functions dev` prints it |

## 2. Codes and fixes

### Account, money, keys

| Status + code | Meaning | Fix |
|---|---|---|
| exit 3, `not_logged_in` | no session on this machine | Run `kumodeck login`: the user clicks Allow once in the browser. No account yet: the user signs up (`kumodeck signup --invite <code>` or the dashboard's sign-up page; an invite code is needed while KUMODeck is invite-only). Never type their password |
| 400 `invite_code_required` (`details.signupUrl`) | creating a new account without an invite code while KUMODeck is invite-only (no account was made) | Ask the user for the invite code they were given; never make one up. The user runs `kumodeck signup --invite <code>` or uses the sign-up page at `details.signupUrl` (also for Google / GitHub). Signing in to an existing account needs no code |
| MCP result `approval_required` with a `confirmUrl` | a change to production waits for the user: this agent cannot show a confirmation form, so KUMODeck made a confirmation link (nothing changed yet) | Open the link in the user's browser yourself (`openLink`: `open` on macOS, `xdg-open` on Linux, `start` on Windows, or your browser tool); only if you cannot, show it to them. Tell them what to press (`tellUser` has the sentence in English and Japanese). Then call `pending_action_continue` with the `pendingActionId`, and again right away each time it returns `approval_required` (do not wait for the user to reply) until `done` or an error. Never press the button yourself and do not look for another way. `pending_action_denied`: the user cancelled, stop. `pending_action_stale` / `pending_action_expired`: nothing changed; call the same tool again for a new link |
| MCP error `insufficient_scope` ("This KUMODeck connection has not been allowed to do this yet") | the AI app was connected to KUMODeck with fewer permissions (e.g. view only, or before KUMODeck added them) | If the AI app shows a KUMODeck screen asking to allow more, the user approves it there and the same request continues. If no screen appears, tell the user the sentence in `tellUser`: reconnect KUMODeck once from the app's settings (in Claude: Settings → Connectors → KUMODeck → Disconnect → Connect) and pick "Build and publish (recommended)". Then try again. Withdrawals, sending mail and banning users are never added this way: only if the user asks, they reconnect and turn it on under "Choose myself". Never look for another way around it |
| KUMODeck's MCP tools are not in this conversation | the agent loads MCP tools when a conversation starts (e.g. right after `kumodeck connect`) | Use the `kumodeck` CLI for the same thing. Never read saved tokens or keys to call the API directly, and do not search the web for how. If the CLI cannot do it, ask the user to start a new conversation |
| 401 `unauthorized` | session expired, or a key is wrong / revoked | CLI: the user runs `kumodeck login`; in CI check `KUMO_SECRET_KEY`. Page: the publishable key in the page's `kumo-config.js` (templates: `public/`) is wrong or still `REPLACE_ME` → `kumodeck init` in the project folder |
| 402 `balance_due` | prepaid credit is used up (`details.balance`; older servers: `details.legacyCode` = `prepaid_required`) | Tell the user; run `kumodeck billing topup`; they pay on Stripe's page; run the same command again. So it does not happen again, tell them about auto top-up (the `limits` Skill: KUMODeck is prepaid, unlike Cloudflare billing afterwards) |
| 503 `service_unavailable` (users see a neutral "temporarily unavailable") | the balance is $0 or less and nothing covers it, so the user-facing side is paused | `kumodeck billing` says whether it is paused. Top up; it resumes on its own within about 30 seconds |
| 403 `email_unverified` | this needs a confirmed email (secret keys, adding funds, AI tool connections, sign-in methods) | The user pastes the link from KUMODeck's confirmation email → `kumodeck verify <link>` (no email: `kumodeck verify --resend`). A project made before that has no secret keys: `kumodeck keys create --secret` |
| `secretKeysWithheld: true` (in `kumodeck init`) | same reason | same fix; the publishable keys already work |

### Production changes confirmed by a link

With the login from `kumodeck connect` (or `kumodeck login` in the browser), every production change waits for the user to confirm it
once in the browser. The command registers it, prints the link (with `--json`: a `{"pendingAction": { "id", "confirmUrl", "expiresAt" }}`
line on stderr) and waits, then sends the same change once. Show the link to the user; do not open the dashboard or press it yourself.

| Status + code | Meaning | Fix |
|---|---|---|
| exit 1, `pending_action_expired` | nobody pressed the link in time (10 minutes) | Ask the user to be ready to press it, then run the same command again: it prints a new link |
| 409 `pending_action_denied` | the user pressed Deny in the dashboard | Do not retry. Ask the user what they want instead |
| 409 `pending_action_stale` | the target changed after the link was made (e.g. another deploy) | Run the same command again (new link) |
| 403 `confirmation_required` (`details.reason`: `not_approved`, `mismatch`, `expired`, `used`) | the resend was not accepted (not pressed yet, a different login, too late, already used) | Run the same command again and show the new link. `--yes`, another login or a hand-made request does not get around it |
| 403 `confirmation_required` (`details.reason`: `unavailable`) | this KUMODeck server cannot confirm by link | Tell the user; they run the command themselves after `kumodeck login --email <email>` |
| 429 `too_many_pending_actions` | 20 confirmations are waiting for this login | Ask the user to confirm or deny them in the dashboard, or wait until they expire |

### Settings and parts that are off

| Status + code | Meaning | Fix |
|---|---|---|
| 403 `feature_disabled` | that part is off in **this** environment (`details.feature`, `details.configPath`, sometimes `details.anyOf`) | Use the hint: `kumodeck features on <feature> && kumodeck config push --env <env>` (or set `configPath` to true in `kumo.config.json` and push). The env is the one the failing page or command used: a `--dev` URL is development |
| 403 `feature_unavailable` | not offered by KUMODeck right now; it cannot be turned on | Do not retry or look for another way. Build it in the project's own database and Functions (the Skills in `INDEX.md`, e.g. `leaderboard`, `chat`) or leave it out |
| 400 `invalid_request` with `details.issues` | a request or `kumo.config.json` failed validation | Each issue has a `path` (e.g. `multiplayer.modes.0.maxPlayers`): fix that field, push again |

### Apps and games in the browser

| Status + code | Meaning | Fix |
|---|---|---|
| 403 `origin_not_allowed` (`details.origin`) | `web.allowedOrigins` in `kumo.config.json` is set and this page's origin is not in it | Add the origin (exact, e.g. `https://mygame.itch.io`, or `https://*.example.com`) and `kumodeck config push --env <env>`. Always allowed without listing: KUMODeck's own URLs for the project, the user's active custom domains (production), and localhost in development |
| a **CORS error** in the console for the project's **Functions** URL | the Functions code did not allow this page's origin | Run `kumodeck functions status` (same `--env`): "browser access" lists the sites KUMODeck allows (`KUMO_ALLOWED_ORIGINS`: the project's own URL, verified custom domains, `web.allowedOrigins`; KUMODeck updates it when those change). If it says "out of date" or "still allows the shared /play/ address", run `kumodeck functions deploy` again. A custom domain counts once it is active and verified (`kumodeck hosting domains status`). A page on the shared `/play/…` address is never allowed (all projects share that origin): open the project's own URL. Any other site: add its origin to `ALLOWED_ORIGINS` in `wrangler.jsonc` `vars` (comma-separated; `https://*.example.com` = its subdomains; not `"*"` unless the user asks), then `kumodeck functions deploy`. Also check the request reaches the right URL |
| a CORS or "failed to fetch" error for the **KUMODeck API** | the KUMODeck API allows every origin, so the page is calling the wrong place or the server is not reachable | Check `apiUrl` in the page's `kumo-config.js` (templates: `public/`; empty = the page's own origin, right only on KUMODeck hosting) |
| `kumo` is always `null` (`await window.kumoReady`, or `connectKumo()` with a `reason`) in an app connected with the `start` Skill, "Already have an app?" | the page does not load them (the `<script>` lines of that Skill's step 5 are missing: the files alone do nothing, and the app quietly stays alone and offline), `kumo-config.js` or `kumo-boot.js` is not next to the page, `kumodeck init` has not filled it, or a build left them out (Vite: they must be in `public/`) | Open `<the page URL>kumo-config.js` and `kumo-boot.js`: both must load, and the config must have a `pk_dev_…` key. Fix the place (that Skill's table), run `kumodeck init`, build, publish again. `null` is also right with `?offline=1` and on a `file://` page |
| 401 `token_expired` | the signed-in person's session (a *player* session in the API) expired or was revoked | The SDK refreshes it; if it keeps coming, sign them in again |
| 403 `forbidden` "This player is banned" | that person (a *player* in the API) is banned | Expected. Bans are the user's decision (dashboard Players, or MCP `player_ban` / `player_unban`) |
| 403 `forbidden` "belongs to a different game or environment" | the page mixes a development key with a production session (or two projects) | Use one environment per page; `kumo-boot.js` picks the key from the URL — do not hard-code a key |
| 429 `rate_limited` (`details.retryAfter` seconds) | too many requests | Wait `retryAfter` seconds; send less often (batch, debounce, do not call on every frame or keystroke). `details.rule` says which rule; the `limits` Skill says why each exists and the way around |
| 413 `*_too_large`, 400 `too_many_variables` (`details.limit`) | more than a size or count limit | Read the number from `details.limit` (never copy it into the code); the `limits` Skill has the way around for each |

### Projects, deploys, Functions

| Status + code | Meaning | Fix |
|---|---|---|
| 409 `slug_taken`, 400 `slug_reserved` (`details.suggestions`) | the URL name is used or reserved (www, api, admin, names containing KUMODeck…) | Leave `--slug` out (`kumodeck init` picks a free one), or `kumodeck init --slug <one of the suggestions>` |
| 400 `name_reserved` | the project's name (shown to players in email subjects and as the sender) contains "KUMODeck" as a word, or is only staff words ("Support", "Security Team", "Admin"…) | Ask the user for a name for the game itself (e.g. "Sky Racers"); do not try word variations yourself. Then run the same command with it (`kumodeck init --name "<name>"`), or `kumodeck projects rename "<name>"` for an existing project. The URL name (slug) is separate |
| 400 `missing_index_html`, 413 `too_many_files` / `file_too_large`, 400 `hash_mismatch`, 429 `too_many_pending_deployments` | deploy problems | See the `deploy` Skill (wrong folder, too big, files changed while uploading, unfinished deploys) |
| 422 `secret_like_content` (`details.findings`: file, line, kind) | a file sent to the browser contains an API key, so nothing was published (anyone could read and use it) | Move the code that uses the key into Functions and keep the key in a Functions secret (the user runs `kumodeck functions secret put NAME` themselves; do not take the key in the chat). Rebuild and deploy again. `kumodeck deploy --allow-secret-like` only when the user says the value is meant to be public |
| 409 `functions_disabled` | Functions is not on in this environment | `kumodeck functions enable` (needs prepaid credit), same `--env` |
| 404 `d1_binding_not_found` "D1 binding DB not found" from `kumodeck functions db migrate` / `db query` | the database does not exist yet: the first `kumodeck functions deploy` (or `kumodeck deploy` of a server-rendered app) creates it. "This environment has: …" = the name is mistyped | Deploy once, then run the migrate again (the deploy prints the line). Or use a name from the message. After that: migrate first, then deploy |
| 400 `d1_query_error` (`details.error`) | the database rejected the SQL: syntax, a missing table or column, a constraint | Fix the SQL; the same SQL fails the same way. "no such table" right after a deploy = run `kumodeck functions db migrate DB` |
| `migration_failed` (from `db migrate`; `details.failed`, `details.applied`, `details.skipped`) | one migration file was rejected; the ones before it are applied, the later ones did not run | Fix the named file (it was not applied) and run the same `db migrate` again: applied files are skipped |
| 400 `functions_script_error` / `app_script_error` (`details.error`) | the uploaded code throws while starting (a top-level import or setup fails); the previous version stays live | Reproduce locally: `kumodeck functions dev` (an app: `npx wrangler dev`), fix, deploy again |
| 409 `app_logs_unavailable` (from `kumodeck logs`) | the live version of the server-rendered app was deployed without logs (before apps had logs, or with `--no-logs`) | `kumodeck deploy` again (without `--no-logs`); lines are kept from that deploy on. Do not enable Functions for it |
| 409 `app_not_deployed` (from `kumodeck logs --source app`) | no server-rendered app is live in this environment | `kumodeck deploy` the app, or read Functions with `--source functions` |
| 409 `functions_not_deployed` | nothing is deployed to Functions in this environment yet (secrets, logs) | `kumodeck functions deploy` (same `--env`), then run the same command again |
| 409 `logs_disabled` (from `kumodeck logs`) | the live version was deployed with `--no-logs`, or before logs existed | `kumodeck functions deploy` again without `--no-logs`; lines are kept from that deploy on. Earlier lines cannot be recovered |
| 403 `functions_suspended` (`details.reason`) | KUMODeck stopped this environment's Functions (the message says why) | `balance`: the user adds credit (`kumodeck billing topup`); it resumes by itself within a minute. Anything else: tell the user to answer KUMODeck's email; nothing to retry |
| 503 `functions_unavailable` | this KUMODeck server does not run Functions (e.g. some local setups) | Use `kumodeck functions dev` locally; deploy against a server that has Functions |
| 503 (plain text) from the Functions URL | paused for the balance | as above: `kumodeck billing`, top up |
| `network_error` | the CLI cannot reach the KUMODeck API | Check the URL (`api` in `kumodeck whoami --json`; set by `--api`, `KUMO_API_URL`, or `api` in `kumo.json` — see the `start` Skill, step 2); is the server running? |
| `network_error` on every `kumodeck` command, or `kumodeck connect` / `login` cannot save the login, under a sandbox | Command communication or access to `~/.kumo/` may be restricted; this alone does not prove a KUMODeck outage | Read `deploy` → "Codex: tools and command permissions". Only if the host permits it, request the exact command's required access. If unavailable or denied, stop and preserve the work; never switch tools or credentials to bypass it |
| no email arrives (confirmation, password reset) on a **local** KUMODeck server | a local server does not send email | Read it at `<api>/v1/dev/outbox?to=<email>` (newest first) and open the link |
| `unavailable` (exit 2) | that command is not available | Do not work around it; tell the user |

A code not listed here: read `message` and `hint`, fix the cause they name, and run the same command again.
Server errors (5xx) other than the ones above: wait a little and retry once; if it keeps failing, tell the user.

## 3. Where to look

| What | CLI | MCP tool (AI agent connected to KUMODeck) | Dashboard |
|---|---|---|---|
| logged in as, linked project, balance | `kumodeck whoami` (`--json`: `developer.emailVerified`, `prepaid.canSpend`) | `prepaid_get` | Money → Prepaid |
| balance, amount owed, days left, paused or not | `kumodeck billing` | `prepaid_get` | Money → Prepaid |
| what each part cost this month (at cost) | `kumodeck usage` (`--daily`, `--period YYYY-MM`) | `usage_get`, `usage_daily` | Money → Usage |
| one project at a glance: users, daily active users, live version | `kumodeck projects show --env <env>` | `project_overview` | the project's Overview page |
| which parts are on | `kumodeck features --env <env>` | `config_get` | the project's Config page |
| the settings the server has; whether a file passes every rule (saves nothing) and what a push would change | `kumodeck config show --env <env>`, `kumodeck config check --env <env>` | `config_get`, `config_validate` | the project's Config page |
| live version and history | `kumodeck deployments --env <env>` | `deployments_list` | the project's Hosting page |
| Functions: URL, version, databases, secret names | `kumodeck functions status --env <env>` | `functions_status` | the project's Functions page |
| what the deployed code printed: Functions and the server-rendered app (last 7 days) | `kumodeck logs --env <env>` (`--since 2d`, `--level error,warn`, `--search <text>`, `--source app\|functions`, `--all`) | `functions_logs` (needs the `read:logs` permission) | — |
| your own database (Functions or a server-rendered app) | `kumodeck db query DB "SELECT …"` (= `kumodeck functions db query`) | `functions_db_select` (read) / `functions_db_query` (change) | — |
| the app's users (players), bans, appeals | `kumodeck players search`, `kumodeck players show <playerId>`, `kumodeck appeals` (read only) | `players_search`, `player_get`, `appeals_list` | the project's Players page |
| who changed what (keys, config pushes, deploys and rollbacks, bans) | — | — | the project's Audit page |

Logs: the page's own messages are in the browser console. For Functions and a server-rendered app, read what the
**deployed** code printed with `console.log` / `console.error` with `kumodeck logs` (both, mixed by time; each line is
marked `fn` or `app`; `--source app` or `--source functions` for one; the last hour by default; `--since 2d` goes back
up to 7 days; add `--env production` for the live app) or the MCP tool `functions_logs`. Start with
`kumodeck logs --level error,warn`, find the failing line, then reproduce it locally (`kumodeck functions dev` for Functions,
`npx wrangler dev` in the app folder for the app).
429 `rate_limited` from `kumodeck logs` / `functions_logs`: log reads are limited for everyone on KUMODeck together, not just
this project. Wait `details.retryAfter` seconds (it can be 300), then read once; never retry in a loop, and narrow the
range (`--since 15m`, `--level error`, `--search`) instead of reading everything again. 503 `rate_limit_unavailable`:
wait a few seconds, then read once.
Nothing there? Logs show only what the code prints: add a `console.error` with the failing step and the error (not the
user's personal data or any secret), deploy to development, and try again. Logs are part of the usage fee at cost
($0.60 per million lines; the display name is "Logs").

## 4. Check it is fixed

Run the exact command (or reload the exact page) that failed. For settings, `kumodeck features --env <env>` shows the part
on, and the page on that environment's URL works. Tell the user what was wrong, what you changed, and anything they
still have to do (pay, confirm the email, add DNS records).

## Security

- Never print or paste secret keys (`sk_…`, `.kumo/secrets.env`, `.dev.vars`) while debugging, not even partly.
- Never add a `console.log` of personal data or secrets (emails, passwords, tokens, API keys, payment details) to debug
  Functions or the app: everyone who can read the project's logs sees those lines for 7 days. Log IDs and error messages instead.
- Do not "fix" an error by turning off a check the user set (`web.allowedOrigins`, a ban, `ALLOWED_ORIGINS`) unless
  the user asks — widen it to the exact origin that is needed.
- Payments, card details, passwords and closing the account are the user's to do.
