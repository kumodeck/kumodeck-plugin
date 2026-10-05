---
name: start
description: Start here to make a new web app or game with KUMODeck as its backend and publish it — from a request like 'Build "X" on KUMODeck. Use KUMODeck for sign-in, the database and publishing.' (or 'KUMODeckで『X』を作って。ログインとデータベースと公開はKUMODeckで。') to a working URL. Picks a template, connects the folder to KUMODeck (account, email confirmation, prepaid credit), makes a first working version and publishes it to the test URL. Use when the user asks to build a web app, a game, a tool or any new project on KUMODeck ("Build a web app / a game / X on KUMODeck", 「KUMODeckでアプリを作って」), or pastes the request copied from the KUMODeck dashboard.
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
   (the user already has an app that was not made with `kumodeck create`: "Already have an app?" below instead)
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
| exit code 3 (`not_logged_in`) | Run `kumodeck connect` (or `kumodeck login`): it opens the KUMODeck dashboard in the user's browser, where they click Allow once. This is your own login: never use a KUMODeck login or keys the user made for themselves. No account yet: **the user** signs up (`kumodeck signup` in their own terminal, or the dashboard). They type passwords; you never do. Then run `kumodeck whoami --json` again |
| `developer.emailVerified: false` | Ask the user to open the confirmation email from KUMODeck and paste the link here, then run `kumodeck verify <link>`. No email: `kumodeck verify --resend`. Accounts made with Google / GitHub are already confirmed |
| `prepaid.balance` is 0 or `prepaid.canSpend: false` | Run `kumodeck billing topup` (default $5; any amount from Stripe's minimum $0.50, but the card fee has a fixed 30¢ part, so tiny top-ups lose most of it to the fee). It prints a Stripe payment page and waits: show the URL, **the user pays there** (you never see or type card details). When it prints the new balance, go on |

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

Connect the app's own folder. Do not make a template project somewhere else to copy from, and never type keys by hand
into a file that `kumodeck init` can fill.

If `kumodeck help` lists `connect`, run `kumodeck connect` in the app's folder and follow what it prints (it does the steps below).
Otherwise:

1. Steps 2–3 first (tools, logged in, email confirmed, prepaid credit), and ask the app's name if you do not know it.
2. Find the folder that gets published: the one with the app's `index.html` — `public/`, the app's folder itself, or
   the build output (`dist/`). With a build step, use the folder the build copies unchanged (Vite: `public/`).
3. Copy [kumo-boot.js](kumo-boot.js) and [kumo-config.js](kumo-config.js) (next to this SKILL.md) into that folder,
   unchanged. `kumo-config.js` still says `REPLACE_ME`: that is the mark `kumodeck init` looks for.
   In a web chat (no terminal), `publish_game` makes the project: write `apiUrl` and the two keys from its result into
   `kumo-config.js` exactly as returned (or leave `REPLACE_ME` in the first call that makes the game: it fills them in).
   Never guess the address or the keys, and never copy them from an old file or another project.
4. In the app's folder: `kumodeck init --name "<App name>"` creates the KUMODeck project (without `--name` it asks, and lists the
   user's projects to pick one; `--project <slug>` links an existing one). `kumo.json` there already:
   `kumodeck init --force --project <slug>`.
   - Published folder = `public/` with `index.html`: `kumodeck init` writes the publishable keys and the API URL into
     `public/kumo-config.js` ("Wrote the publishable keys…") and saves `deployDir: "public"`. Done.
   - Linking an existing project (`--project`) writes only the development key and never touches production (no
     confirmation link). The first `kumodeck deploy --env production` makes the production key and writes it into the
     `kumo-config.js` it publishes (`--json`: `productionKeyWritten`).
   - Any other folder: `kumodeck init` does not look there. It prints the two publishable keys (`--json`:
     `keys.development.publishable`, `keys.production.publishable`): put them in place of the two `REPLACE_ME` values in
     that folder's `kumo-config.js`, and set `apiUrl` to `api` from `kumo.json`. Public values only — never an `sk_…`.
     Publish with `kumodeck test-deploy <folder>`. Skip the `Kumo.init({ projectKey: … })` snippet and the
     "config push --env production, then deploy" advice it prints for such folders: the snippet puts one fixed key in the
     page (step 5 picks the key per environment), and publishing starts on development.
5. Load it in the page, once, before the app's code needs it:
   ```html
   <script src="kumo-config.js"></script>
   <script type="module">
     import { connectKumo } from './kumo-boot.js';
     const { kumo } = await connectKumo();   // null offline (or before `kumodeck init`): the app must still work
     startApp(kumo);                         // hand it to the app's own code
   </script>
   ```
6. `kumodeck features on <name>` for what the app uses (it creates `kumo.config.json`), then publish to development
   (section 6) and continue with the other Skills (they all expect `connectKumo()` from `kumo-boot.js`).

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
  the published app has card images on) and write the tags it prints, as they are, inside `<head>` of `public/index.html` (`web-app`: `index.html`) and of any other
  page people may share, near `</head>`. The image URL in them is the published app's, so the same tags are right in the test
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
- An invite code from the user: `kumodeck billing redeem <code>` (or `kumodeck signup --invite <code>` when they sign up). Invite
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
  What the CLI can show: `kumodeck projects list` / `kumodeck projects show` (users, daily active users, live version),
  `kumodeck config show` / `kumodeck config check`, `kumodeck usage` (`--daily`), `kumodeck billing` (the prepaid balance), `kumodeck players search` / `kumodeck players show <playerId>`, `kumodeck appeals`; add `--json` to read them.
