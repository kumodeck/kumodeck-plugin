---
name: start
description: Start here to make a new web app or game with KUMODeck as its backend and publish it — from a request like 'Build "X" on KUMODeck. Use KUMODeck for sign-in, the database and publishing.' (or 'KUMODeckで『X』を作って。ログインとデータベースと公開はKUMODeckで。') to a working URL. Picks a template, connects the folder to KUMODeck (account, email confirmation, prepaid credit), makes a first working version and publishes it to the test URL. Use when the user asks to build a web app, a game, a tool or any new project on KUMODeck ("Build a web app / a game / X on KUMODeck", 「KUMODeckでアプリを作って」), or pastes the request copied from the KUMODeck dashboard. Also adds KUMODeck to an app or game the user already has (made by hand, with another tool or in a web chat, one HTML file, Vite or another build) in its own folder, without rebuilding it ("use KUMODeck for this game", 「このゲームにKUMODeckをつないで」).
---

# Start a web app or game on KUMODeck

The user wants their app or game, not a tour of KUMODeck. Get them to **a working URL** fast, then grow it with them.
KUMODeck is only the backend (sign-in, saves, database, server code, multiplayer, money, hosting, sharing):
the code is the user's, and so are its rules. Their users are called *players* in KUMODeck's API and settings.

Order of work (each step below says how to check it is done — skip steps that are already done):

1. Ask what to build (one short message)
2. Check the tools (Node, the `kumodeck` CLI)
3. Account, email confirmation, prepaid credit — the user does the parts that need their password or card
4. Create the project folder from a template and link it to a new KUMODeck project
   (the user already has an app or game, made without `kumodeck create`: skip steps 1, 4 and 5 and follow "Already have an
   app?" below in the app's own folder; never start it over from a template)
5. Make the first version of their app or game
6. Publish to the development URL, show it to the user
7. Next steps: which Skill to use for what

## 1. Ask first (they decide; one short message with choices)

If the request already names what to build ("Build 'a space shooter' on KUMODeck…", "Build 'a shared shopping list' on KUMODeck…"),
do not ask again what it is. Ask only
what you cannot guess, and offer a default for each:

1. **Look and engine** — pick the template from this table and say which one you picked and why:

   | Template | Pick it for | Engine |
   |---|---|---|
   | `web-app` | web apps that are not games: a notes or booking app, a members area, a tool (pages, sign-in, the user's own database) | React + Vite + TypeScript + Tailwind |
   | `vanilla-canvas` | simple 2D games, puzzles, arcade; the default for games | none (plain `<canvas>`) |
   | `phaser` | 2D action, jump-and-run games, runners (sprites, physics, scenes) | Phaser |
   | `pixi` | 2D with many sprites or effects | PixiJS |
   | `three` | 3D | three.js |
   | `multiplayer-starter` | players together in real time (rooms, room codes, a lobby) | none |
   | `functions-starter` | only server code + an SQL database, next to a web app or game | Workers |

   `web-app` is a small private notes app (sign-in, one page per note, its own server code and database): turn it into
   the user's app. Its `AGENTS.md` has the build, local and deploy steps. The other templates are small games with no
   build step. A very small page with no build step can also start from `vanilla-canvas` (replace the canvas and
   `public/game.js`; keep `kumo-boot.js` and `kumo-config.js`, they connect the page to KUMODeck).
2. **Name** — the app's or game's name. The folder and the URL name (slug) come from it (e.g. `space-dodge`), and
   users see it in the emails KUMODeck sends them ("Confirm your email for Space Dodge"): pass it as `--name`.
3. **What to keep for each user** — each user's own data (progress, settings, personal bests) is a **cloud save**
   (already in every game template). Ask whether it needs **data shared between users** (a shared list, chat, a ranking,
   levels players make, a shared world):
   that is the user's own **database + server code** (KUMODeck Functions) — add it after the first publish (step 7).

Do not pick silently. If the user says "you choose", use `web-app` for an app and `vanilla-canvas` (saves only) for a
game, and tell them.

**A small app the request already describes** (a notes app, a to-do list, a click counter, "just make it"): do not stop to
ask. Pick the defaults, build it, then say in one line which defaults you picked (they can change them). Ask only when you
truly cannot decide, and then only one question. The same goes for the later steps (saving data, the server code).

## 2. Check the tools

```sh
node --version        # 22 or newer
kumodeck --version       # the KUMODeck CLI
```

No `kumodeck`? Only when installation is permitted, install it once: `npm install -g kumodeck` (or run each command as `npx kumodeck <command>`).
Every `kumodeck` command prints the next command to run; add `--json` to read results and errors (`error.code`,
`error.hint`) as data. Exit codes: 0 ok, 1 server or connection error, 2 wrong usage (read the hint), 3 not logged in.

**Which KUMODeck server.** Every command talks to one KUMODeck API: `kumodeck whoami --json` prints it as `api` (when not logged
in, the error names it). The first of these wins: `--api <url>`, the `KUMO_API_URL` environment variable, `api` in the
folder's `kumo.json` (saved by `kumodeck init`), the server the user last logged in to, else the default built into the
CLI (`apiSource` in `kumodeck whoami --json` says which one was used). If none is set, the command stops with `no_api_url`:
ask the user for the URL and use `KUMO_API_URL=<url>` (or `--api <url>`; for a KUMODeck server on this computer,
`KUMO_API_URL=http://localhost:4000`). If it is not the one the user means, do the same — never guess a URL.

## 3. Account, email confirmation, prepaid credit

```bash kumo-run setup=creator
kumodeck whoami --json
```

Read the result and do only what is missing:

| What you see | What to do |
|---|---|
| exit code 3 (`not_logged_in`) | Run `kumodeck login` and follow **Signing in** below (or `kumodeck connect`, which signs in the same way). This is your own login: never use a KUMODeck login or keys the user made for themselves. No account yet: **the user** signs up (`kumodeck signup --invite <code>` in their own terminal, or the sign-up page of the dashboard). KUMODeck is invite-only for now: creating an account needs the invite code the user was given (`invite_code_required` without it). Ask the user for their code; never make one up. They type passwords; you never do. Then run `kumodeck whoami --json` again |
| `developer.emailVerified: false` | Ask the user to open the confirmation email from KUMODeck and paste the link here, then run `kumodeck verify <link>`. No email: `kumodeck verify --resend`. Accounts made with Google / GitHub are already confirmed |
| `prepaid.balance` is 0 or `prepaid.canSpend: false` | Run `kumodeck billing topup` (default $5; any amount from $0.50; the card processing fee (about 6%) is added on top, so the amount chosen lands in the balance). It prints a Stripe payment page and waits: show the URL, **the user pays there** (you never see or type card details). When it prints the new balance, go on |

**Signing in** (the same on the user's computer, in the cloud, over SSH): `kumodeck login` prints a link and a code
(like `BCDF-GHJK`). Show the user both, and say only: "Open this link. If it shows the same code, press Allow." The user
pastes nothing back. The command waits about 100 seconds; if it ends with exit code 4 (`login_pending`, "Not signed in
yet"), run `kumodeck login --resume` (same link and code) and repeat until it prints the signed-in email. Do not run
`kumodeck login` again while waiting: that makes a new link and code. `access_denied`: the user pressed Cancel; ask before
trying again. `expired_token` (10 minutes passed): run `kumodeck login` for a new link. After `kumodeck connect` ends with
exit code 4: `kumodeck login --resume`, then `kumodeck connect` again.

Why this order: adding funds needs a confirmed email, and creating a project or deploying needs prepaid credit
(KUMODeck bills usage at cost from it; there is no free tier). Tell the user that in one sentence, not more.

Prepaid, not billed afterwards: a Cloudflare account the user rents themselves sends a bill after the month, so it never
pauses for money. KUMODeck takes usage from a prepaid balance and never lends it: when the balance (and anything else
that covers it) runs out, the user's apps pause for their users and new deploys get 402 `balance_due` until funds are
added; everything resumes by itself after that. **The way to never pause is automatic top-up**: on the dashboard,
Money → Prepaid, the user saves a card on one top-up, then turns automatic top-up on with a threshold (any amount) and an
amount (the same range as a top-up). When the user is about to launch something people rely on, mention it once.

## 4. Create the folder and the project

In the folder where the user keeps their projects (not inside another project):

```sh
kumodeck create space-dodge --template phaser --init --name "Space Dodge"
cd space-dodge
```

`create` copies the template (it works offline). `--init` then creates the KUMODeck project and writes
the publishable keys and the API URL into `public/kumo-config.js`, and `deployDir: "public"` into `kumo.json`.
Without login, `--init` is skipped: run `kumodeck init` in the folder later.

- The URL name was taken or is reserved: `kumodeck init` picks a free one and says so (`slug_taken` / `slug_reserved`).
  To choose it yourself: `kumodeck init --slug <name>` (3–40 characters: lowercase letters, digits, single hyphens).
- Secret keys go to `.kumo/secrets.env` (git-ignored). **Do not open, print or copy that file**, and never pass
  `--show-secrets`. The page only ever uses the publishable keys (`pk_…`).
- `secretKeysWithheld` in the output = the email was not confirmed yet. The page still works. After `kumodeck verify`,
  run `kumodeck keys create --secret` (only needed for CI or Functions).

Then read `AGENTS.md` in the new folder: it has the rules for this project and one recipe per KUMODeck part.

## Already have an app? (not made with `kumodeck create`)

Many users come with an app or game that already works: made by hand, with another tool, in a web chat, with or
without a build step, sometimes one HTML file. Add KUMODeck **to that app, in its own folder**:

- Do not rebuild it from a template, make a template project somewhere else to copy from, or move or rename its files.
- Keep what it already has: its saves (`localStorage`), its own sign-in, its state and its game loop stay as they are.
  KUMODeck is added next to them. Move data over (an old `localStorage` save → a cloud save) only as the `user-data`
  Skill says.
- Never type keys by hand into a file that `kumodeck init` can fill.

Work in the app's folder (the one with its `package.json`; without a build step, the one with its `index.html`):

1. If `kumodeck help` lists `connect`, run `kumodeck connect`. It logs in and adds the notes and Skills for agents
   (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/skills/`, `.agents/skills/`; an `AGENTS.md` that is already there
   keeps its text and gets one more section). It does not change the app's code and does not make the project: the
   next steps do. Then sections 2–3 above for what is missing (email confirmed, prepaid credit). Ask the app's name if you
   do not know it.
2. Find the app's shape in this table. It says where the two files of step 3 go and which folder is published:

   | The app | Copy the two files into | Publish with |
   |---|---|---|
   | `index.html` at the top of the folder, no build step (also a single HTML file) | the folder itself, next to `index.html` | `kumodeck test-deploy .` |
   | a site in `public/` (`public/index.html`), no build step | `public/` | `kumodeck test-deploy` (`kumodeck init` saves `public`) |
   | Vite (`index.html` and `package.json` at the top) | `public/` (make it if missing; Vite copies it into `dist/` unchanged) | `npm run build`, then `kumodeck test-deploy` (`kumodeck init` saves `dist`) |
   | Create React App, or another build that writes `build/` | `public/` | build, then `kumodeck test-deploy build`; also set `"deployDir": "build"` in `kumo.json` (`kumodeck init` saves `public`) |
   | another build | the folder the build copies unchanged into its output | build, then `kumodeck test-deploy <output folder>` |
   | a server-rendered app (Next.js, Astro with its Cloudflare adapter, SvelteKit, Nuxt…) | none | the `deploy` Skill, §9 |

   `kumodeck test-deploy .` publishes every file in the folder except hidden ones (`.kumo/`, `.claude/`, `.git/`…) and
   `node_modules/`. That includes `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `kumo.json` and `kumo.config.json`: none of them
   holds a secret, the secret keys stay in `.kumo/`. If the folder also holds files that must not be public (notes,
   drafts), ask the user before you publish it.
3. Copy [kumo-boot.js](kumo-boot.js) and [kumo-config.js](kumo-config.js) (next to this SKILL.md) into the folder from
   the table, unchanged. `kumo-config.js` still says `REPLACE_ME`: that is the mark `kumodeck init` looks for.
   A web chat (no terminal): see "No terminal and no files" in `INDEX.md`; `publish_game` makes the project, and you
   write `apiUrl` and the two keys from its result into `kumo-config.js` exactly as returned. Never guess the address or
   the keys, and never copy them from an old file or another project.
4. `kumodeck init --name "<App name>"` in the app's folder makes the KUMODeck project and writes the keys and the
   address into that `kumo-config.js` (`--json`: `gameConfig.status` is `written`). It saves the folder to publish as
   `deployDir` in `kumo.json` when it can tell (`public`, or `dist` for Vite). `--project <slug>` links a project that
   already exists instead (it writes the key for your test app; the first `kumodeck deploy --env production` adds the
   published app's key). The app's folder has `kumo.json` already: `kumodeck init --force --project <slug>`.
   No `kumo.json`: a new project, unless the user named an existing one (`INDEX.md`, "Which project"); never pick one
   because its name looks like this app's.
   - `gameConfig` is `null` (the page is somewhere `kumodeck init` does not look): it prints the whole `kumo-config.js`
     to save next to the page. Use it instead of the copy from step 3.
   - Skip the `<script>` lines it prints for such folders: step 5 is the one the other Skills expect.
5. Load it in the page, once, inside `<head>` of `index.html` (and of every other page that uses KUMODeck):
   ```html
   <script src="kumo-config.js"></script>
   <script type="module">
     // KUMODeck joins in the background. The app starts as before and never waits for it.
     // A URL, not `import './kumo-boot.js'`: Vite and other build tools refuse to bundle a file from public/.
     window.kumoReady = import(/* @vite-ignore */ new URL('kumo-boot.js', document.baseURI).href)
       .then((boot) => boot.connectKumo({ namespace: 'space-dodge' }))
       .then((r) => r.kumo, () => null);
   </script>
   ```
   Put the app's URL name (slug) as `namespace`: KUMODeck's sign-in then keeps its own `localStorage` entries under that
   prefix, apart from the app's. Do not change the app's own code to start it: where the app needs KUMODeck (saving,
   sign-in…), it reads `const kumo = await window.kumoReady;` and checks `if (kumo)` first (it is `null` offline, with
   `?offline=1`, or before `kumodeck init`). When another Skill says "`kumo` from `connectKumo()`", it means this.
   TypeScript: `(window as any).kumoReady`. A page in a subfolder: point both paths at the files from step 3.
   **Copying the two files is not enough: nothing reads them until these lines are in the page.** Without them the app
   still runs, but alone and offline (no saves, no sign-in, no multiplayer) and no error says so. Check before step 6:
   the page you publish has `<script src="kumo-config.js">` and `kumoReady` (with a build: in the built `index.html`,
   e.g. `dist/index.html`, and its bundle). After publishing, `await window.kumoReady` on the test app is not `null`.
6. `kumodeck features on hosting <name…>` with what the app uses (e.g. `kumodeck features on hosting saves`; it makes
   `kumo.config.json` if missing). Turn `hosting` on here too: when the published folder is the app's folder (`.`), a
   publish that has to turn it on itself changes `kumo.config.json` while uploading it and stops with `file_changed`.
   Then publish to the test app as the table says (section 6: `config check`, `config push`, then the "Publish with"
   command) and continue with the other Skills.
   The helper files of the other Skills (`user-data.js`, `multiplayer-client.js`, …) are imported by the app's code:
   with a build step they go in `src/` next to that code; without one, next to the page. The app's data from before (its
   own browser saves, its own scores) has a step in each Skill: `user-data` §3, `leaderboard` §3.

## 5. Make the first version

Change the template into the user's app or game. In the game templates `public/` is the whole site (no build step;
`public/game.js` is the game). In `web-app` the pages are `src/` and the server code `functions/`: run `npm install`, and
`npm run build` before each deploy (it writes `dist/`, which `kumodeck deploy` uploads).
Keep what connects to KUMODeck:

- Do not edit `public/kumo-boot.js` or hand-edit `public/kumo-config.js`.
- The page must keep working without the backend: `kumo` is `null` offline; never wait on a request to show the page
  (or to start play).
- Keep each user's data in a cloud save (`kumo.saves`, e.g. the personal best in a game); it works for guests with no sign-up.
- **The X card, from the start** (the user does nothing): `kumodeck share on --env development` (turns on the card image in
  `kumo.config.json`; production gets it with the first `config push --env production`), then `kumodeck share tags` (it works before
  the published app has card images on) and write the tags it prints, as they are, inside `<head>` of `public/index.html` (`web-app`: `index.html`; an app you
  connected: its own `index.html`) and of any other page people may share, near `</head>`. If the page already has `og:` /
  `twitter:` tags of its own, replace them with these, so the page has one set. The image URL in them is the published app's, so the same tags are right in the test
  app and after publishing: write them once, never swap URLs. KUMODeck does not add them to pages. (Chat only, `publish_game`:
  write its `cardTags` the same way.)

Try it locally: open `public/index.html` (`web-app`: `npm run dev`), or add `?offline=1` to try it without the backend.

## 6. Publish to development first

```sh
kumodeck config check                     # KUMODeck checks every rule first (saves nothing); fix any errors and check again
kumodeck config push                      # the settings in kumo.config.json → development
kumodeck test-deploy                      # uploads public/ (web-app: dist/) and prints the URL (…<slug>--dev…)
```

For Codex, show the real URL and follow `deploy` §1 and its Codex publishing flow: verify first, then open the
human confirmation page without another conversation question. For other clients, keep the following flow.

Show the URL to the user and ask them to try it (on a phone too). End with the closing line of the `deploy` Skill, §1, in
the user's language (one line, **no question and no explanation**; `testAppNote` in `kumodeck test-deploy --json`):
"Test version: https://…. Say "publish it" when you want to publish." (「テスト用: https://…。公開するときは『公開して』と
言ってください。」). Say nothing about how it differs from the published app (who can open it, that it changes, X cards,
the small "This is a test version" bar at the top): answer only if the user asks. Details, production and rollback: the
`deploy` Skill. A request to publish made before the user has seen it ("make it and publish it") means this test app
first; when the user, after trying it, says "publish it" / 「公開して」 (or the like):

```sh
kumodeck config check --env production    # no confirmation: it saves nothing
kumodeck config push --env production
kumodeck deploy --env production          # deploy's default is development: say --env production for the live app
```

Each production change opens a confirmation page in the user's browser (or prints the link when it cannot) and waits: **they**
confirm once there; the command then finishes by itself (the `deploy` Skill). Until they say it: stay on development.

Everything in KUMODeck is **off until turned on** (guest sign-in always works). The template's `kumo.config.json` turns on
what it uses (`hosting`, `saves`, `stats`; `multiplayer` in the multiplayer templates). Push it to **each** environment
you deploy to, or the page gets 403 `feature_disabled` there.

## 7. Next steps (use the other Skills)

Open `.claude/skills/INDEX.md` or `.agents/skills/INDEX.md` (the same list; Codex and Cursor look in `.agents/skills/`) and follow the matching Skill's
`SKILL.md`. Common next asks:

| The user wants | Where |
|---|---|
| save each user's data or a game's progress, continue on another device | the `user-data` Skill (or the "Cloud save" recipe in `AGENTS.md`) |
| users sign in with email / Google / Discord / X, keep a guest's data | the `user-login` Skill |
| their own database and server code (shared data) | the `functions-d1` Skill |
| "save it in a DB" / "store it on the server" / 「KUMODeckのDBを使って保存して」 | decide from what it is with the one line in `AGENTS.md` → "Everyday asks" (**Protect in D1, not in saves.**): what the user may freely write → `user-data`; what they must not be able to change themselves → `functions-d1`. Build it, then say in one line which you picked (ask one question at most) |
| "make a server-side API" / 「サーバー側でAPIを作って」 | the `functions-d1` Skill, deployed to development (the order below) |
| a ranking | the `leaderboard` Skill (built in their own database) |
| chat | the `chat` Skill |
| publish, production, roll back, their own domain | the `deploy` Skill |
| share on X; for games: multiplayer | the recipes in `AGENTS.md` |
| something failed (an error code, 402, 403…) | the `troubleshoot` Skill |

**"Make a server" / "use a database"** — the order that works the first time (details: the `functions-d1` Skill):

```sh
kumodeck create api --template functions-starter   # in the app's folder (the one with kumo.json); no kumodeck init in api/
cd api && npm install --prefix functions
kumodeck functions enable                          # once per environment (prepaid credit)
kumodeck functions deploy                          # creates the empty database DB; prints the URL and the migrate line
kumodeck functions db migrate DB                   # creates the tables (functions/migrations/*.sql)
curl <the URL from deploy>/health              # call it
kumodeck functions db query DB "SELECT * FROM scores"
```

Migrate before the first deploy fails (the deploy creates the database); skipping it after the deploy makes the first
call fail with `no such table`. A SQL mistake answers `d1_query_error`: fix the SQL. Only server code, no page? Run
`kumodeck create my-api --template functions-starter`, then `cd my-api && kumodeck init` (it prints the same steps). A
server-rendered app (its own `wrangler.jsonc`) uses its database without Functions: `kumodeck deploy`, then
`kumodeck db migrate DB` / `kumodeck db query DB "…"` (the `deploy` Skill §9).

If a Skill named here is not in `INDEX.md` yet, use the matching recipe in `AGENTS.md`.

Turn on only what a request needs (`kumodeck features on <name>` then `kumodeck config push`), and tell the user what you turned on.

## Money and cost

- KUMODeck bills what the project uses **at cost** (KUMODeck's usage fee, no markup, no free tier) from the prepaid balance.
  `kumodeck billing` shows the balance and about how many days it lasts.
- While the balance is $0 or less and nothing else covers it, the user-facing side pauses (users see a neutral
  message) and new projects / deploys are refused with 402. Adding funds resumes everything on its own.
- An invite code from the user: `kumodeck signup --invite <code>` when they sign up (needed to create an account while KUMODeck is invite-only), or `kumodeck billing redeem <code>` for an account that has none yet. Invite
  credit pays usage fees only (it cannot be refunded or withdrawn) and is added once their email is confirmed.

## Security (always)

- Passwords, card details, account creation and account closing belong to the user. You run commands; they type
  secrets in their own terminal or browser.
- Only publishable keys (`pk_…`) go into the page. Never write, print or commit a secret key (`sk_…`) or
  `.kumo/secrets.env`.
- Users never see the KUMODeck name in the app or game (no "Powered by", no links).
- If a command is refused (not available, a permission prompt, a confirmation), do not look for another way to do
  the same thing: tell the user what was refused and why.
- **Asked for something that is not available yet** (for example selling in the app, ads, payouts, or sending email to the
  app's users; the CLI says it is not available): tell the user plainly that it is not available yet and offer one thing
  you can do instead (their own server code, database or publishing). Never suggest closing the conversation, restarting
  the agent or the computer, or reinstalling: that does not change it.
- **Log in as yourself with `kumodeck connect`**, never with KUMODeck credentials the user made for themselves (a session from
  `kumodeck login --email`, a copied `~/.kumo/credentials.json`, their keys). Production changes then open a confirmation page in
  the user's browser (or print the link when they cannot): let them press it; the command finishes by itself. `--yes` does not skip it.
- **No KUMODeck MCP tools exposed?** If the host offers tool discovery, look up the relevant KUMODeck tools first.
  If unavailable, carry on with the installed CLI. Say 「この会話ではKUMODeckのコマンドで続けます。」 for a Japanese user.
  Never read saved tokens or secret keys to call the API directly. Configuration can load on a new conversation, but
  do not promise that a restart fixes authentication or blocked communication. For Codex command permissions and
  blocked communication, read `deploy` → "Codex: tools and command permissions" before installing or retrying.
  KUMODeck's MCP says it isn't authorized yet? If `kumodeck whoami` works, continue with the CLI and do not ask the user to sign in
  again. Start the MCP sign-in (`mcp__kumo__authenticate` in Claude Code) only when the user asks; they press Allow once.
  What the CLI can show: `kumodeck projects list` / `kumodeck projects show` (users, daily active users, live version),
  `kumodeck config show` / `kumodeck config check`, `kumodeck usage` (`--daily`), `kumodeck billing` (the prepaid balance), `kumodeck players search` / `kumodeck players show <playerId>`, `kumodeck appeals`; add `--json` to read them.
