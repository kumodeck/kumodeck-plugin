---
name: deploy
description: 公開して / publish a web app or game on KUMODeck. Publish a web app or game on KUMODeck (and its Functions) to the development or production environment, including server-rendered apps (Astro, SvelteKit, Nuxt, React Router, TanStack Start, Hono), list versions and roll back, and understand its URLs, the 402 when prepaid credit is used up, custom domains and the URL name. Use when the user asks to deploy, publish (「公開して」), ship, release, put the app or game online, go live, update the live app or game, roll back / undo a release, or asks for its URL.
---

# Deploy (publish) a web app or game on KUMODeck

KUMODeck keeps every deploy as a numbered **version** of an **environment**, and switching the live version is instant.
Each project has two environments with separate settings, data and URLs:

| Environment | For | URL (printed by `kumodeck deploy`) |
|---|---|---|
| development | trying things; share with testers | `https://<slug>--dev.<hosting domain>/` (local server: `<api>/play/<slug>--dev/`) |
| production | the live app or game that people use | `https://<slug>.<hosting domain>/`, or the user's own domain |

Never guess the hosting domain: use the URL the command prints (`url` in `--json`).

## 1. Publishing intent and the one human confirmation

For clients other than Codex, end with the closing line below. For Codex, use the dedicated flow that follows instead;
all test-only and previous-refusal safeguards still apply.

- **Which environment.** After you make or fix something, put it on the test app without being asked (development), show
  the URL and end with the closing line below. Production is what people see: do not publish there on your own.
- **"Publish it" / "公開して" / "ship" / "go live" / "本番" (or the like), said after the user has seen the test app** → publish to
  the published app: run `next` from the output (`kumodeck deploy --env production`) right away, the production steps below.
  The user confirms it once in the browser. Features on in `kumo.config.json` (e.g. `saves`) go on in production in that
  same single confirmation. No special phrase is needed.
- **A publish request before the user has seen it** (the first request is "make it and publish it" / 「作って公開して」, or
  you just changed it): test app first, then the closing line. Never publish to everyone what the user has not seen yet.
- **The closing line after a test publish:** one line, in the user's language, **no question and no explanation**
  (`testAppNote` in `kumodeck deploy --json` and `tellTheUser` of `publish_game` have it):
  - Not published yet: "Test version: https://…. Say "publish it" when you want to publish." /
    「テスト用: https://…。公開するときは『公開して』と言ってください。」
  - Already published: "Test version: https://…. Say "publish it" to update https://…." /
    「テスト用: https://…。公開中の https://… にも出すときは『公開して』と言ってください。」 Use the real published URL (from
    the tool result or an earlier production deploy); never guess it.
  - Add nothing about how the two differ (who can open it, that it changes, X cards, the "This is a test version" bar):
    answer only if the user asks. If they try to post the test link on X, say why X shows no card for it and that they can
    say "publish it" first (`ifAskedAboutX` in the output).
- **While working, never show tool argument names or inside words** (`everyone`, "test app only", `prepare`, `uploadId`,
  `--env`): say what is happening in plain words ("Putting it on your test app…" / 「テスト用のアプリに出しています…」).
- **A note for the history** (optional): `-m "new boss fight"` shows up in `kumodeck deployments`.

## Codex: publishing intent and the one human confirmation

<!-- WHY（2026-10-04 のレビュー）: 公開の依頼で確認ページを開くまで進め、チャットの追加返答待ちをなくす。 -->
- **"Publish" / "put it online" / 「公開して」 (or the like)**: deploy to development first,
  verify the intended behavior there, then prepare the production publish and open KUMODeck's confirmation page. The
  request authorizes preparation; **only the user's confirmation on that page authorizes the live change**. Do not add a
  chat question asking whether to publish too: Codex skips the closing line of §1 (`testAppNote` / `nextAsk`), because
  the confirmation page is already the next step. Failed or unverified development checks: stop before preparing
  production and report what remains to be checked.
- **Test-only requests** ("let me try it", 「試用版だけ」「まだ公開しない」), or a previous refusal: stay on development, and
  end with the closing line of §1 (no question, no explanation).
  DB / API work alone does not authorize publication. Do not open a publish confirmation after each feature change.
- A request to ship or update the live app uses the same confirmation flow after checks. Do not assume that uploading
  files or opening a link means the app is published. Keep the old live version until KUMODeck reports success.
- Announce the waiting place in the user's language. Japanese: 「試用版で動きを確かめました。公開の確認ページを開きます。」
  Once pending: 「ブラウザで『公開する』を押すのを待っています。チャットへの返事は要りません。」
  If a link cannot be opened, show the returned link and say 「このリンクを開いて『公開する』を押してください。」
- A history note is optional: `-m "new boss fight"`. As in §1, never show argument names (`everyone`, `--env`) in progress.

## Codex: tools and command permissions

Use the KUMODeck MCP tools exposed in this conversation; if the host provides a tool-discovery tool, look up KUMODeck's
relevant tools before concluding they are absent. Otherwise use the installed CLI. A saved MCP configuration does not
prove the tools are available now. A new conversation may reload configuration, but does not fix blocked communication.

Codex's usual workspace sandbox blocks outbound command traffic. A blocked CLI request is not proof that KUMODeck is
broken or that login failed. If the current host permits requesting command permissions, request access for the exact
command and destination through its supported approval flow, explaining why. Never change permissions yourself or
retry through curl, another login, a proxy, an unrestricted mode, or another tool to get around a denial.
If approval is unavailable, denied, or policy forbids it, stop the affected command and tell the user:
「KUMODeckにつなぐ通信が許可されていないため、操作を完了できていません。通信を許可できる場所で同じ操作を続けてください。」
Keep the prepared files and state which check or command remains. Do not download missing tools when installation is
forbidden. Permission to run a command and KUMODeck's confirmation are separate; neither substitutes for the other.

## 2. Before the first deploy (check once)

```sh
kumodeck whoami           # logged in (exit code 3 = the user runs `kumodeck login` themselves), balance, linked project
```

- The folder has `kumo.json` (from `kumodeck init`). If not, run `kumodeck init` in the project folder (or pass `--project <slug>`).
- `public/kumo-config.js` has real publishable keys. `kumodeck deploy` warns when it still says `REPLACE_ME` or has no key
  for the environment: then the page runs offline. Fix: `kumodeck init` in the project folder.
- The folder to upload has `index.html` at its root. Templates upload `public/` (saved as `deployDir` in `kumo.json`).
  A project with a build step (Vite etc.): build first, then `kumodeck deploy dist`.
- **A server-rendered app** (Astro with its Cloudflare adapter, SvelteKit, Nuxt, React Router framework mode, TanStack Start,
  Hono, SolidStart, Next.js with vinext or OpenNext): do not pass a folder. Run `kumodeck deploy` in the project folder and read §9 first.

## 3. Publish

```sh
kumodeck config check                             # KUMODeck checks every rule first; saves nothing (exit 1 = fix, check again)
kumodeck config push                              # settings (kumo.config.json) → development
kumodeck deploy --env development -m "first try"  # upload + make it live → prints the URL
```

**Before every `config push`, run `kumodeck config check --env <the same env>`** (`--json` to read it). KUMODeck checks the file with
every rule a push uses and saves nothing, so it never asks for a confirmation, not even for production. `ok` lists what the push
would change (features turned on / off, changed sections) and any warnings. Errors come with their path (and a hint); fix them
and run `config check` again: more errors can show up once these are fixed (references and duplicates are checked after the
shape is right). Push only when it says ok.

When the user asks to ship:

```sh
kumodeck config check --env production            # no confirmation: it saves nothing
# Only if config check finds other settings (beyond features) that must change:
# kumodeck config push --env production            # separate settings confirmation; explain why it is needed
kumodeck deploy --env production                  # deploy's default is development: production only with --env production
```

For features only, `kumodeck deploy --env production` alone is enough: features that are on in `kumo.config.json` but off in
production are turned on together with the publish (one confirmation). If deploy says the file has other changes (stats,
products…), run `kumodeck config push --env production` for those (a separate confirmation).

**The user confirms each production change once, in the browser.** With the login from `kumodeck connect` (or `kumodeck login` in the
browser), `config push --env production`, `deploy --env production`, `rollback … --env production` and every other production
change open the confirmation page in the user's browser by themselves and wait: "Confirm this change to your published app: open <URL> in
your browser and press the button…" (with `--json`: a `{"pendingAction": { "id", "confirmUrl", "expiresAt", "opened" }}` line on stderr). Tell the user
to press the button on the page that opened; if `opened` is false (no browser here, or `--no-open`), show them the link. Do not wait
for them to say they pressed it: the command keeps checking and finishes by itself once they do. A deploy uploads first and asks once, just before the new version goes live; until then the
previous version stays live. The first production deploy with `hosting` (or, for a server-rendered app, `serverRendering`) still
off is one link too: "Confirm these 2 production changes at once" (with `--json` the line also has `"bundle": {"count": 2}`) =
turn them on + go live, one press.
`--yes` does not skip it. Expired or denied: see the `troubleshoot` Skill (never work around it).

Which environment each command uses when you leave out `--env` (they differ — always pass `--env` when unsure):

| Command | Default |
|---|---|
| `kumodeck config push`, `kumodeck features`, `kumodeck functions …` | development |
| `kumodeck deploy`, `kumodeck deployments`, `kumodeck rollback` | development (production only with `--env production`) |
| `kumodeck share on` | both |

What `deploy` does: hashes every file, uploads only files KUMODeck does not have yet (a redeploy after a small change uploads
only that change), then switches the environment to the new version. If `hosting` is off in that environment, it turns
`hosting` on in `kumo.config.json`, pushes it there and says so in one line — nothing else is turned on for you
(in production that push and the switch share the one confirmation above; do not run `config push --env production` first just for hosting).
In production, features that are on in `kumo.config.json` are turned on together with the publish too (same one
confirmation). Other settings (stat definitions, products…) still need `kumodeck config push --env <env>`; deploy tells you
in one line when they differ. In development, push them with `kumodeck config push`, or the page gets 403 `feature_disabled`.

## 3b. Publishing from a web chat (no terminal, no files)

Claude or ChatGPT on the web (and their phone apps) have no terminal and no access to the user's computer: use the
KUMODeck MCP tools only. The same environments, URLs and confirmations as above apply.

**Use `publish_game` alone** when the user asks to make and publish (or update) a game or app, and do not call other tools
for it. Web chats ask the user about each new tool once (「このツールを使ってよいですか？」): every step and follow-up here
is a call to `publish_game`, so the user is asked once. The user wants it all done in the chat: no downloads, no dropping
files, no settings to change (the upload page in step 5 is the only exception, and only for very big games).

1. **New game: prepare first.** `publish_game` with `name` (the real game name), `features` (what the game uses: `saves`,
   `multiplayer`, `realtimeChannels`, `emailLogin`, `stats` …) and `prepare: true`. It makes the project, turns on hosting
   and those features in the test app (and what they need, listed in `alsoTurnedOn`), and returns:
   - `apiUrl` and `keys` (`testApp` for the test app, `everyone` for the published app; shown only once). Write them into
     `kumo-config.js` exactly as returned. **Never guess the address or a key, and never take them from an old file or
     another project.** (`__KUMO_API_URL__` and `__KUMO_PROJECT_KEY__` in a file are also filled in for you.)
   - `guides`: the steps and files to copy for those features (e.g. multiplayer: the questions to ask first with prices,
     the game-side code and `multiplayer-client.js`; any new game: `kumo-boot.js` and `kumo-config.js`). Follow them;
     there is no need to read other guides for this.
2. **Send the files** with `projectId`: text files as `content` (plain text), images and sounds as `contentBase64`, paths
   from the site root (`index.html` at the root). About 100 KB per call: a bigger game goes **in parts** — `more: true`
   on each part, the `uploadId` from the first part's result on the next ones, and a last call without `more`, which
   publishes. Parts work up to several MB, images and sounds included. End your reply with `tellTheUser` in the user's
   language: the closing line of §1 (no question, no explanation; `ifAskedAboutX` only if they try
   to post it on X or ask). While sending, say it in plain words ("Putting your game on the test app…"), never the
   argument names (`everyone`, `prepare`, `more`, `uploadId`).
3. **Settings:** `config` = part of `kumo.config.json` (e.g. `{ "multiplayer": { "modes": [...] } }`), on any call. It is
   merged into the current settings (objects merge, lists replace), checked like a push, and refused with the path if
   something is wrong (nothing changes).
4. **Production (everyone).** Same rule as §1: only when the user says "publish it" / 「公開して」 (or the like) after
   seeing the test app. `publish_game` with `projectId`,
   `everyone: true` and the files (or the last part) uploads first and then asks the user once (a confirmation in the chat,
   or a link to press) before people see it; hosting, the features on in the test app and `config` are in that same
   confirmation. On `approval_required` with a `confirmUrl`: open it / show it as in §5, then call `publish_game` with
   `pendingActionId` (again right away while it is still waiting).
5. **Last resort — a game too big to send in parts** (well over several MB of images or sounds): call `publish_game`
   without files. It returns `uploadAt` (a page) and `tellTheUser`: make a zip with `index.html` at the top, give the user a
   download link, and say "Download the zip, then drop it on this page:" 「zip をダウンロードして、このページに落として
   ください」. Then call `publish_game` again right away with `projectId` and `waitToken` until it returns the URL.

On a computer with a terminal (Claude Code, Codex), the single-step tools are also there for finer changes:
`project_create`, `config_push`, `hosting_deploy` (`environment: "production"` uploads, then asks once) and
`hosting_upload_page`; for big builds use `kumodeck deploy`.

## 4. After deploying (check)

- Open the printed URL, or give it to the user to try. Add `?offline=1` to check the page still works without the backend.
- **Never create test users or test data in production** (no sign-ups, saves, purchases or rows of your own there): they
  become real records among the real users'. Check production with a page load (and `?offline=1`); do sign-up, saves and
  other writes on development.
- `kumodeck deployments --env <env>` lists versions; `*` marks the live one.
- Headers and redirects: a `_headers` / `_redirects` file at the root of the deployed folder works as on Cloudflare
  (same format and limits; e.g. COOP/COEP, CSP, `Cache-Control`, `/old /new 301`). Lines KUMODeck skipped come back in
  `warnings` (`line`, reason, `limit`): fix them and deploy again. SPA routing is `web.spaFallback`, not `/* /index.html 200`.
- Share it on X: post **the published app's URL** (production). The test app's URL never shows a card on X (KUMODeck
  answers X's link reader there with a page without one), and the test app shows a small "This is a test version" bar
  with a link to the published app once there is one. The card needs its tags inside `<head>`: if the page has none,
  `kumodeck share on`, then `kumodeck share tags` and write them near `</head>`; the same tags are right in the test app
  and the published app (one image URL), so write them once. KUMODeck does not add them to pages. `share tags` works while
  only the test app has card images on (it says so; run `kumodeck share on` before publishing so the image shows). If it says
  card images are off for both apps, run `kumodeck share on` and ask again.

## 5. Roll back (instant)

```bash kumo-run setup=game
kumodeck deployments --env development
```

```sh
kumodeck deployments                  # production versions, * = live
kumodeck rollback 3                   # make v3 live again (production)
kumodeck rollback 3 --env development
```

Rollback switches which uploaded version is live; it re-uploads nothing and deletes nothing, so you can switch forward
again the same way. It does not change settings: if the newer version needed a config change, push the matching
`kumo.config.json` too. Versions belong to one environment: to move a tested build to production, run
`kumodeck deploy --env production` with the same folder (files already uploaded are not sent again).
Over MCP: `deployments_list` and `deploy_activate` do the same (production asks the user to confirm).
If an MCP tool returns `approval_required` with a `confirmUrl` (clients without confirmation forms),
nothing changed yet: open the link in the user's browser yourself (`open <url>` on macOS, `xdg-open <url>` on Linux,
`start "" "<url>"` on Windows, or your browser tool; `openLink` has the exact commands) and tell them what to press (`tellUser`).
Only if you cannot open it, show them the link. Never press the button yourself, and never try another way. Then call
`pending_action_continue`, and call it again right away each time it returns `approval_required` — do not wait for the user
to reply — until it returns `done` or an error (the link works for 10 minutes).
`hosting_deploy` to production with hosting still off returns one link for both (`bundle.count` 2: hosting on + publish; needs the
`write:config` permission): one press, then `pending_action_continue` sends both in order. `hosting_deploy` to production
also turns on features that are on in development but off in production, in the same confirmation.

## 6. Functions (the project's own server code)

Server code is deployed separately from the page's files, from the Functions folder (see the `functions-d1` Skill):

```sh
kumodeck functions enable                  # once per environment (needs prepaid credit)
# first time in an environment: deploy first — it creates the database (DB) — then migrate
kumodeck functions deploy -m "first version"   # prints "New empty database(s): DB" and the migrate line to run
kumodeck functions db migrate DB
# every later change: migrate first, then deploy, so the new code finds its tables
kumodeck functions db migrate DB
kumodeck functions deploy -m "scores v2"
kumodeck functions status                  # URL, version, databases
```

`db migrate` before the first deploy fails with 404 `d1_binding_not_found` "D1 binding DB not found": deploy once, then migrate.
The deploy's `--json` has `newDatabases` and `next` (the migrate line): run it before the first call, or the code gets
`no such table`. A failed migration names the file (`migration_failed`): fix that file, run the same command again.

All take `--env production` for the live app (default: development). `kumodeck functions deployments` lists versions.

## 7. The URL name and the user's own domain

- The URL name (slug) is chosen at `kumodeck init` (`--slug`). Changing it later changes every URL and share link:
  do it only when the user asks, on the dashboard (the project's Hosting page); if `kumodeck help` lists a `slug` command,
  its `check` shows first whether a name is free.
- The project's name (not the URL name) appears in the subject of emails players receive: give it a clear name before
  launch with `kumodeck projects rename "<name>"` (MCP `project_rename`; `kumodeck projects list` shows it). URLs stay the same.
- Own domain (`play.mygame.com`; the CLI adds it to production): `kumodeck features on customDomains` →
  `kumodeck config push --env production` → `kumodeck hosting domains add play.mygame.com`. It prints a CNAME and a TXT record:
  **the user** adds both where they manage the domain (you cannot). Then `kumodeck hosting domains status play.mygame.com`
  until it is `active`. The `<slug>` URL keeps working. Billed daily at cost; remove unused ones with
  `kumodeck hosting domains remove <host>` (asks first).
  - No per-project limit on domains (each costs its daily share). The one cap: at most 20 **unverified** domains (TXT not
    found yet) per environment at a time — 409 `domain_limit`, the number is in `details.limit`. It exists so nobody can
    queue sign-ups for domains they do not own. Fix: have the user add the TXT records for the waiting ones (verified ones
    do not count) or remove ones they no longer want, then add again.
  - Unverified domains are removed after 7 days, not-active ones after 14 days; the user gets an email 2 days before.
    Re-adding later is fine (the TXT value never changes for the account).
  - The API also accepts the development environment (a testers' domain such as `beta.mygame.com`; still not indexed by
    search engines). Suggest it only if the user asks for a test domain.

## 8. Errors while deploying

| Code / message | Fix |
|---|---|
| 402 `balance_due` | Prepaid credit is used up. Tell the user, run `kumodeck billing topup` (they pay on Stripe's page), then run the same deploy again |
| "Directory not found" / "has no index.html at its root" (exit 2), 400 `missing_index_html` | Wrong folder: deploy the one with `index.html` at its root (`kumodeck deploy public`, `kumodeck deploy dist`) |
| 413 `too_many_files` (over 100,000 files), 413 `file_too_large` (a file over 100 MB; `details.limit` has the exact limit, `details.files` lists them) | These are the same as Cloudflare's own limits (100,000 files per version) — there is no total-size limit. Over 100,000 files usually means raw sources or `node_modules` got into the folder: deploy the build output. A file over 100 MB: compress (`.ogg`, `.webm`) or split it; the `limits` Skill has the rest |
| `file_changed`, 400 `hash_mismatch` | A file changed during the upload (a build watcher?): stop the watcher, deploy again |
| `secret_like_content` (CLI, before upload), 422 `secret_like_content` (server) | A file sent to the browser contains a key (`details.findings[].what` says which, in plain words: a key the user saved, a known service's secret key, or long random text after key / secret / token / password; file and line; the value is not shown). Nothing was published. Tell the user what and where. Move the code that uses the key into the project's Functions and read the key there; the user enters it in the chat box (`INDEX.md` → "Asking for a key": `functions_secret_set` without a value) or with `kumodeck functions secret put NAME` in their terminal (never ask them to paste the key into the chat). Rebuild, deploy again. Only if the user says the value is meant to be public (a Maps key restricted to their site, a Supabase anon / publishable key): `kumodeck deploy --allow-secret-like` |
| 429 `too_many_pending_deployments` | 20 unfinished deploys: they expire after 24 hours; finish or wait |
| 403 `feature_disabled` | The hint prints the exact `kumodeck features on … && kumodeck config push --env …` line. (`kumodeck deploy` turns `hosting` and `serverRendering` on by itself) |
| `next_adapter_choice` (exit 2) | A Next.js app with neither vinext nor OpenNext: run the vinext lines from the hint (recommended: install, `npx vinext check`, the `vinext init` line, `kumodeck deploy`). OpenNext only if the user chose it |
| `vinext_not_initialized` (exit 2) | Run the `vinext init` line from the hint (`details.init`) once, then `kumodeck deploy` again |
| `vinext_check_failed` (exit 2) | `vinext check` found things vinext does not support (`details.issues`) and OpenNext is not installed: change them and deploy again; or install OpenNext and `kumodeck deploy --next opennext`; or `kumodeck deploy --next vinext` to try vinext anyway |
| `build.vinextCheck.fallback: "opennext"` (`--json`, not an error) | Deployed with OpenNext because vinext check listed ✗ items: change them, deploy again to use vinext |
| `app_framework_unsupported` (exit 2) | KUMODeck does not take this framework's server build: export a static site if the app can (build, then `kumodeck deploy <folder>`) |
| `build_failed` | The setup, build or bundle step failed: its output is above. Fix it and deploy again |
| 400 `invalid_app` | The Worker or its bindings are not accepted: each line says which ("details.issues") |
| 413 `app_worker_too_large`, `app_asset_too_large` | The hint lists the largest files: shrink them or move big data to R2 |
| 503 `server_rendering_unavailable` | This KUMODeck server cannot run apps: deploy a static build (`kumodeck deploy dist`) |
| 400 `app_script_error` / `functions_script_error` | The code throws while starting (`details.error` is the exception, e.g. a top-level import of something missing). Reproduce with `npx wrangler dev` (Functions: `kumodeck functions dev`), fix, deploy again. The previous version stays live |
| 502 `app_upstream_error` | The app runtime refused the upload; the previous version stays live. Deploy again; if it repeats, the `troubleshoot` Skill |
| 409 `functions_disabled` | `kumodeck functions enable` (with the same `--env`) first |
| exit code 3, 401 `unauthorized` | Session expired: the user runs `kumodeck login`. In CI, check `KUMO_SECRET_KEY` |
| `pending_action_expired`, 409 `pending_action_denied`, 403 `confirmation_required` | The production confirmation link was not pressed, was denied or was not accepted: the `troubleshoot` Skill |

Anything else: the `troubleshoot` Skill.

## 9. Server-rendered apps (SSR)

For apps whose pages are made on the server (Next.js with vinext or OpenNext, Astro with `@astrojs/cloudflare`, SvelteKit, Nuxt,
React Router in framework mode, TanStack Start, Hono, SolidStart). KUMODeck runs them the way Cloudflare Workers does: a Worker plus its
static assets. The build runs on this computer with the project's own tools (wrangler; vite for vinext); KUMODeck never builds your code.

```sh
kumodeck deploy --env development --dry-run   # builds, then checks with KUMODeck: sizes, files to upload, databases it will create
kumodeck deploy --env development             # builds, uploads what is new, makes it live
```

`serverRendering` is off by default: `kumodeck deploy` turns it on (with `hosting`, which it needs) for that environment and
says so in one line (`--json`: `featuresTurnedOn`), like a static deploy turns on `hosting`. Tell the user the cost line it
prints with it (`--json`: `featuresTurnedOnNote`): the app Worker is billed at cost from the prepaid balance, only for what it
uses. In production from a browser login, turning them on and going live are one link and one press (see above).

What `kumodeck deploy` (no folder) does, in order, and prints as it goes (`--json`: `detection`, `build.commands`, `sent`):

1. **Detects** the kind of project: a `wrangler.jsonc` with `main` at the root, or a server framework in `package.json`.
   A folder argument (`kumodeck deploy dist`), a `deployDir` in `kumo.json` or no server framework = the usual static deploy.
   `--app` / `--static` skip the detection.
2. If there is no `wrangler.jsonc` yet, runs `wrangler setup --yes` (never for Next.js: see below) (Cloudflare's own setup: adds the adapter and the
   config). Tell the user it changes their project files.
3. `<npm|pnpm|yarn|bun> run build`, then `wrangler deploy --dry-run --outdir .kumo/app-build` (bundles; sends nothing to Cloudflare).
4. Asks KUMODeck for a dry run, prints what it will create ("KUMODeck will create a new D1 …") and the warnings, then uploads
   only new files and switches the live version. `--no-build --outdir <folder>` reuses an existing bundle.

- **wrangler must be installed in the project** (`npm install -D wrangler`; not for vinext with `cloudflare.config.ts`). Without it, a framework project is uploaded
  as static files and the command says so in one line: install wrangler and deploy again.
- **Next.js**: see "Next.js" below (vinext first, OpenNext as the fallback, no ISR).
- Served only at `https://<slug>.<hosting domain>/` (dev: `<slug>--dev`) and custom domains — not under `/play/`. POST
  requests (forms, server actions) reach the app. A local KUMODeck server without a hosting domain has no app URL: the
  deploy says so instead of printing one (`--json`: `url` null, `appUrlUnavailable`); check the app with `npx wrangler dev`.
- **The app's database** (D1 in its `wrangler.jsonc`): the deploy creates it empty. Create the tables with
  `kumodeck db migrate DB` (reads the migrations_dir of that database in `wrangler.jsonc`, default `migrations`) and look at
  data with `kumodeck db query DB "SELECT …"` — no `kumodeck functions enable` needed (`kumodeck db migrate` = `kumodeck functions db migrate`). A SQL
  mistake answers `d1_query_error` with the database's message: fix the SQL. Details: the `functions-d1` Skill §4.
- **Logs**: what the app prints (`console.log` / `console.error`) is kept 7 days. Read it with `kumodeck logs --source app`
  (`kumodeck logs` alone mixes the app and Functions by time; each line is marked `app` or `fn`; `--level error,warn`,
  `--since 2d`) or the MCP tool `functions_logs` (`source: "app"`). `app_logs_unavailable` = the live version has no
  logs (deployed before apps had logs, or with `--no-logs`): deploy again. Do not enable Functions for it.
  `kumodeck deploy --no-logs` keeps none for a version (lines are billed at cost).
- **Secrets**: the user enters them, asked the same way as every Skill (`INDEX.md` → "Asking for a key"):
  `functions_secret_set` with the name and no value, and
  "Paste the text that starts with sk- (from the OpenAI site) into the box that opens next."
  If no box opens, the tool returns a link: give it with the same sentence. In a terminal:
  `kumodeck functions secret put NAME --env <env>` (one place for Functions and the app, never in "vars"). Never ask the
  user to paste a key into the chat. When the deploy prints "Secret NAME is not set for the app yet", ask for that key
  again the same way. Names that look like secrets in "vars" get a warning: move them.
- An environment serves either static files or the app — whichever version is live. Deploying the app over a static
  site says so; `kumodeck rollback <version>` switches back instantly either way.
- **Cookies**: KUMODeck removes `Domain=` from the app's `Set-Cookie` (the hosting domain is shared); cookies stay on the app's own host.
- Limits: Worker 64 MiB (uncompressed), asset file 25 MiB, 5,000 asset files, 30 s CPU and 10,000 subrequests per request by default (same as Cloudflare; up to 5 min / 10 million via `PUT /v1/admin/functions/limits` with `app`; the CPU in effect also grows with the prepaid balance — read `appLimits` in the Functions status instead of assuming a number). The `limits` Skill explains each limit.
  Source maps are not uploaded (`--sourcemaps` to include them).

### Setting up each framework (when `wrangler setup` cannot)

| Framework | Adapter to add | Notes |
|---|---|---|
| Astro | `npx astro add cloudflare` | Use `cloudflare({ imageService: "passthrough" })` in `astro.config` (no Images binding); sessions use a KV named SESSION |
| SvelteKit | `@sveltejs/adapter-cloudflare` | No `fs` at runtime |
| Nuxt | Nitro preset "cloudflare_module" (in `nuxt.config`) | — |
| React Router v7 | `@cloudflare/vite-plugin` (framework mode) | SPA mode (`ssr: false`) is a static site: `kumodeck deploy build/client` |
| TanStack Start | `@cloudflare/vite-plugin` | — |
| Hono | none | Already a Worker |

All of them need `"compatibility_flags": ["nodejs_compat"]` in `wrangler.jsonc`.

### Next.js (vinext first, OpenNext as the fallback)

KUMODeck builds Next.js apps with **vinext** (Cloudflare's Next.js on Vite) — the recommended way — or with **OpenNext**
(`@opennextjs/cloudflare`), which stays as the fallback (for at least three months). `kumodeck deploy` picks by what is in
`package.json`: vinext if it is there, OpenNext if only OpenNext is set up. With neither, it stops with
`next_adapter_choice` (exit 2) and prints the lines for both: take vinext (`details.recommended`) unless the user chose OpenNext.
`--next vinext` / `--next opennext` chooses for one deploy.

**vinext (recommended)** — needs Node.js 22.18 or later to read `cloudflare.config.ts` (on 22.15–22.17,
`NODE_OPTIONS=--experimental-strip-types` also works; the deploy says so):

1. `npm install -D vinext` (pnpm / yarn / bun: `add -D vinext`).
2. `npx vinext check` → change what it marks ✗ (common ones: `next-auth` → better-auth, `__dirname` → `import.meta.dirname`).
3. Once: `npx vinext init --platform=cloudflare --cdn-cache=none --data-cache=none --image-optimization=none`
   (all three choices are needed: without them `vinext init` stops to ask, and an agent cannot answer. KUMODeck does not
   take the CDN cache, Cloudflare Images or the KV data cache yet). It writes `vite.config.ts` and `cloudflare.config.ts`.
4. `kumodeck deploy --env development --dry-run`, then `kumodeck deploy --env development`.

`kumodeck deploy` runs `vinext check`, then `vite build` (not `npm run build`: after `vinext init` that is still
`next build`), reads `.cloudflare/output/v0` and sends `framework: "vinext"`. It never changes the project's files.
**No Cloudflare account is needed**: do not run `vinext-cloudflare deploy`, `cf deploy`, `wrangler login` or
`wrangler setup`. wrangler is not used. The assets binding must stay named `ASSETS` (`ASSETS: bindings.assets()`, as
`vinext init` writes it). `--json` has `build.vinextCheck` (the score and the ✗ items).

- **vinext check found something it does not support**: the deploy lists what to change. If OpenNext (and `next`,
  `wrangler`) is installed, it deploys with OpenNext instead and `--json` says `build.vinextCheck.fallback: "opennext"`;
  change the ✗ items and deploy again to use vinext. If OpenNext is not installed, it stops with `vinext_check_failed`.
- Image optimization (`imagesOptimizer` in `vite.config.ts`, `bindings.images()`) **stops the deploy**: vinext fails
  at runtime without the Images binding, so it cannot be left out the way OpenNext's is. Remove both (or init with
  `--image-optimization=none`); images are then served as they are.
- Secrets in `cloudflare.config.ts` are not sent: ask the user for each value the same way as every Skill (`INDEX.md` →
  "Asking for a key": `functions_secret_set` without a value; in a terminal `kumodeck functions secret put NAME --env <env>`).
  Text / JSON values are sent as vars. Service bindings, Durable Objects and the other things in "What does not work"
  stop the deploy with the key to remove.
- An older vinext app with `wrangler.jsonc` (no `cloudflare.config.ts`) is built with `vite build` and bundled with
  wrangler. If its build has no Worker, the deploy says so: remove `wrangler.jsonc`, run the `vinext init` line above,
  deploy again.

**OpenNext (the fallback)** — when vinext check lists things you cannot change yet, when vinext does not work after
deploying, or when the user chose OpenNext (`kumodeck deploy --next opennext`, which needs `next` in `package.json`).
`kumodeck deploy` runs `opennextjs-cloudflare build` (it calls `next build` itself), copies the pages built at build time
(`.open-next/cache` → `.open-next/assets/cdn-cgi/_next_cache`), bundles with wrangler and sends `framework: "nextjs"`.

1. `npm install -D @opennextjs/cloudflare wrangler`. If `wrangler.jsonc` or `open-next.config.ts` is missing, the deploy
   writes the smallest one KUMODeck needs and says so (it never overwrites). Keep OpenNext's `wrangler.jsonc`:
   `main: ".open-next/worker.js"`, assets `.open-next/assets` with the binding **`ASSETS`** (that exact name).
2. An `open-next.config.ts` you already have must use the read-only cache from the assets — `kumodeck deploy` stops
   before building otherwise (it never edits the file; change it yourself, after asking the user):

   ```ts
   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
   import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

   export default defineCloudflareConfig({ incrementalCache: staticAssetsIncrementalCache });
   ```
3. In `next.config`, set `images: { unoptimized: true }` (no image optimization on KUMODeck: images are served as they are).
4. `kumodeck deploy --env development --dry-run`, then `kumodeck deploy --env development` (add `--next opennext` when
   vinext is installed too).

- **No ISR / revalidate yet**: server-rendered pages and pages built at build time work; `revalidate` has no effect
  (the deploy says so every time). Do not add R2 / KV / D1 caches or queues for Next.js (`NEXT_INC_CACHE_*`,
  `NEXT_TAG_CACHE_*`, `NEXT_CACHE_*`): KUMODeck refuses them with `invalid_app`.
- `services` (`WORKER_SELF_REFERENCE`) and `images` (`IMAGES`) in OpenNext's `wrangler.jsonc` are not sent; the deploy
  says so in one line. You do not have to remove them.
- **Middleware**: Edge middleware works. Node.js middleware (`runtime: "nodejs"`) gets a warning, not a stop: it is
  experimental in OpenNext too — if it fails, switch it back to the Edge runtime.

**Both:**

- Route Handlers (GET / POST / PUT / DELETE / PATCH) and Server Actions reach the app.
- A static export still works without any of this: `output: "export"` in `next.config`, build, then `kumodeck deploy out`.
- **`nodejs_compat`**: Next.js (both ways) needs Node.js compatibility. `vinext init` writes it in `cloudflare.config.ts`;
  with a `"compatibility_date"` of 2026-08-04 or later it is on by default. With an older date and no flag, KUMODeck adds
  the flag and warns `next_nodejs_compat_added` — add `"nodejs_compat"` to `"compatibility_flags"` in `wrangler.jsonc` too
  (or move the date), so local runs match. Do not set `no_nodejs_compat` (refused with `invalid_app`).
- **Next.js is in beta on KUMODeck** (not yet checked on the production runtime). A vinext deploy carries the warning
  `vinext_beta` (vinext is the recommended way, still in beta; if the app does not work, deploy with
  `kumodeck deploy --next opennext`). An OpenNext deploy carries `next_beta`. A failed deploy carries the same one in
  `details.fallback`, with a docs link (`docs:`). If the deployed app does not work (500s, a blank page, 400 `app_script_error`),
  do not stop there and do not ask the user to choose; take the first step that fits yourself, deploy to development
  again, open the URL, then say in one line what you changed:
  1. It was deployed with vinext → `kumodeck deploy --next opennext` (install OpenNext first if it is not there:
     `npm install -D @opennextjs/cloudflare wrangler`).
  2. The app uses ISR (`revalidate`, `next: { revalidate }`, `NEXT_INC_CACHE_*` bindings) → remove it so pages render on
     each request (`cache: "no-store"` where data must be fresh), then `kumodeck deploy`.
  3. The app needs no server code on each request (no Route Handlers, Server Actions, middleware or server-read cookies)
     → static export: `output: "export"` and `images: { unoptimized: true }` in `next.config`, `npx next build`, then
     `kumodeck deploy out`. Server code it still needs goes to the project's own Functions (the `functions-d1` Skill).
  If none fits or it still fails, tell the user, with the error's `code` and `details` from `kumodeck deploy --json`.
  The same steps for people: the docs' hosting guide, "If Next.js does not work".

### What does not work on KUMODeck, and what to use instead

| Not available | Instead |
|---|---|
| Cron in the app's `wrangler.jsonc` ("triggers.crons") or `vercel.json` "crons" | Put the scheduled job in Functions ("triggers.crons" in `functions/wrangler.jsonc`, then `kumodeck functions deploy`); it can use the same D1 / KV / R2 by binding name |
| Image optimization (Images binding, `next/image`, Astro's default image service) | Serve images as they are (Astro: `imageService: "passthrough"`; Next.js with OpenNext: `images.unoptimized`; vinext: init with `--image-optimization=none` — `imagesOptimizer` / `bindings.images()` stop the deploy) and size them at build time |
| Node middleware (Next.js 15.2+) | Warned, not stopped (experimental in OpenNext); Edge middleware if it fails |
| ISR / `revalidate` (Next.js) | Pages built at build time or rendered on each request; redeploy to refresh |
| `@vercel/edge-config`, `@vercel/blob`, `@vercel/postgres`, `@vercel/kv` | KV, R2, D1 bindings in `wrangler.jsonc` (KUMODeck creates them per environment) |
| Durable Objects, service bindings, Hyperdrive, Workers AI, Queue consumers | Not yet: D1 / KV / R2 / Queue producers only |
| Native modules (`sharp`, Prisma's binary engine, `puppeteer`), more than 128 MB of memory | Pure-JS / WebAssembly versions; move heavy work out of the request |
| `request.cf` (country etc.) | Not available yet |

"Not available for apps on KUMODeck yet: …" (exit 2) names the key in `wrangler.jsonc` to remove.

## Cost

Hosting (stored files and reads), custom domains, Functions and server-rendered apps (requests and CPU) are billed at cost (KUMODeck's usage fee) from the prepaid
balance. Old versions are kept so rollback is instant.

## Security

- Deploy only the project's public folder: never upload `.kumo/`, `.env`, `.dev.vars` or anything with a secret key.
  Everything in the uploaded folder is public.
- Never put a key from any service (AI, payments, database, mail, cloud, your own `sk_`) in browser code: anyone can read it
  and use it on the user's bill. Keys come in through the chat box (`INDEX.md` → "Keys from any service") and only Functions use
  them; the browser calls a function. Only public keys (`pk_`, Supabase publishable / anon, Firebase `apiKey`) belong in page code.
  `kumodeck deploy` and KUMODeck stop a deploy that contains a saved key, a known secret-key shape or key-like random text
  (`secret_like_content`); `--allow-secret-like` is only for values the user confirmed are meant to be public.
- CI deploys with a secret key from the CI's secret store (`KUMO_SECRET_KEY`, the key decides the environment);
  never paste a key into a workflow file or print it.
- Production changes (deploy, rollback, config push) only when the user asks.
