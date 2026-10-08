# Skills in this project

Step-by-step guides for working on this project (a web app or game) with KUMODeck: `start`, `deploy` and `troubleshoot` get it
from nothing (or from the app or game the user already has) to a live URL and past errors, and `limits` says what can stop it (size, count, speed, prepaid balance) and the way around; `user-data`, `user-login` and `functions-d1` wire
per-user data, sign-in and the user's own server code and database into the app or game; `multiplayer` makes a game
playable online with friends on KUMODeck's rooms (KUMODeck runs the rooms; the game logic stays in the game); the
others are recipes for building systems (for games: rankings and the like) in **the user's own** database and Functions.
KUMODeck does not run those systems: the code, the data and the rules (cheating, resets, moderation) belong to the user —
say so when you add one.

The same files are in `.agents/skills/` (Codex) and `.claude/skills/` (Claude Code).
In a terminal, run `kumodeck skills update` once when you start: it replaces Skills older than the CLI's (Skills changed
in this folder are kept). Skills from the KUMODeck plugin for Claude Code: the user runs `/plugin marketplace update kumodeck`.
Codex initially sees names and descriptions; use this index if a matching Skill was not selected automatically.
Whichever agent you are, and whether you opened a Skill by yourself or not: pick one from the table, read its `SKILL.md`
from top to bottom and follow it. The other files in that folder are the code to copy.

| Skill | Read | Use it when the user asks for |
|---|---|---|
| start | [`start/SKILL.md`](start/SKILL.md) | a new web app or game on KUMODeck, "Build X on KUMODeck" (the request copied from the KUMODeck dashboard), getting from nothing to a working URL; adding KUMODeck to an app or game the user already has (one HTML file, Vite or another build), in its own folder without rebuilding it ("Already have an app?") |
| deploy | [`deploy/SKILL.md`](deploy/SKILL.md) | deploy, publish (「公開して」), ship, go live, the app's or game's URL, roll back a release, Functions deploys, the URL name or their own domain |
| troubleshoot | [`troubleshoot/SKILL.md`](troubleshoot/SKILL.md) | an error from `kumodeck` or the app or game (402, 403 feature_disabled, email_unverified, origin_not_allowed, CORS…), balance, usage and history |
| multiplayer | [`multiplayer/SKILL.md`](multiplayer/SKILL.md) | make it playable online (「オンラインで対戦できるようにして」): asks one short question set with prices, then picks the setup; online multiplayer, versus / co-op / party modes, quick match, room codes and invite links, reconnects |
| leaderboard | [`leaderboard/SKILL.md`](leaderboard/SKILL.md) | a leaderboard, ranking, high scores, best times, weekly / daily rankings, "my rank" |
| chat | [`chat/SKILL.md`](chat/SKILL.md) | chat, messages between players, a lobby or party chat, chat history |
| user-data | [`user-data/SKILL.md`](user-data/SKILL.md) | saving or syncing each user's data (settings, drafts, favorites, a game's progress), autosave, continue on another device |
| user-login | [`user-login/SKILL.md`](user-login/SKILL.md) | login, sign in / sign up, user accounts, keeping a guest's data, KUMODeck / Google / Discord / Apple / X sign-in, an account screen, ban appeals |
| functions-d1 | [`functions-d1/SKILL.md`](functions-d1/SKILL.md) | their own server code (a server-side API / 「API を作って」, webhooks, cron) and SQL database, verifying the calling player, tables and migrations |
| limits | [`limits/SKILL.md`](limits/SKILL.md) | something refused as too big, too many or too fast (413 `*_too_large`, 400 `too_many_variables`, 429 `rate_limited`), how big / how many / how fast it can be, planning something large, why the app stopped when the prepaid balance ran out (auto top-up) |

"Save this with KUMODeck's database" (「DB を使って保存して」) can mean `user-data` (saves) or `functions-d1` (D1): the
"Everyday asks" section of `AGENTS.md` says which, in one line.

Nothing here is on until you build it: each Skill says which `kumodeck` commands turn on what it needs.

## Talking to the user (every Skill)

The user may not be a programmer: they may not know words like "API" or "secret key". Code, file names, variable names
and commands stay as they are; only what you **say** to the user changes. Say it with things they can see, in short,
everyday words, in their language. Avoid these words in what you say: API, secret / secret key / private key, token,
environment, production / development, deploy, endpoint, request (in Japanese: API・シークレット / シークレットキー・秘密鍵・
トークン・環境・本番 / 開発・デプロイ・エンドポイント・リクエスト). A command or an error code they must type or will see is fine in
backticks; then say what it means in plain words.

Be concrete, never vague: name the real thing, with its real URL. Do not swap a word for a vague phrase that could mean
anything ("the live one", "the other one"). Production is "your published app" and development is "your test app",
**always with the real URL** you got from the command or tool output (`url` in `--json`). Never write a placeholder URL.

| Instead of | Say | 日本語なら |
|---|---|---|
| production | your published app (https://…, the real URL) | 公開中のアプリ（https://…・本物の URL） |
| development | your test app (https://…, the real URL) | テスト用のアプリ（https://…・本物の URL） |
| deployed to development | it is on your test app: try it at https://… | テスト用のアプリ（https://…）に出しました。ここで試せます |
| deploy to production? (after a test publish) | not a question, no explanation: "Test version: https://…. Say "publish it" when you want to publish." | 質問も説明もしない:「テスト用: https://…。公開するときは『公開して』と言ってください。」 |
| the publishable key (`pk_…`) | the key written into the app (people using it can see it, and that is fine) | アプリに書き込むキー（使う人にも見える・見えても大丈夫） |
| the secret key (`sk_…`) | the key used only on the server (never shown to anyone, never pasted into a chat) | サーバーだけで使うキー（人に見せない・会話に貼らない） |
| the OpenAI API key / secret key | the long text that starts with sk- (from the OpenAI site) | OpenAI のサイトでもらった sk- で始まる長い文字列 |
| set the secret in production | save the OpenAI key for your published app (https://…) | 公開中のアプリ（https://…）に OpenAI のキーを入れる |
| I created an endpoint / API | the game now asks the server for the ranking | ランキングをサーバーに聞くようにしました |
| the request failed with 401 | the sign-in has expired | ログインが切れています |

While you work, never show tool argument names or inside words in progress messages: not "uploading to the test app only
(no `everyone`)", not `prepare`, `uploadId`, `--env`. Say what happens: "Putting your game on your test app…"
(「テスト用のアプリに出しています…」). Publish to the test app with `kumodeck test-deploy` (it cannot reach the published app).
After a test publish, end with the one closing line of the `deploy` Skill §1 (the URL
and how to publish), not with notes, explanations or a question.

## Which project (every Skill)

**A folder without `kumo.json` gets a new project.** Make a new one (`kumodeck init --name "<App name>"`; in a web chat,
`publish_game` with `name` and no `projectId`) unless the user named an existing project themselves. Never pick a project
because its name looks like this app's (in `kumodeck projects list` or `projects_list`): it can be another copy or someone
else's app, and publishing there replaces what people see on it. If one looks like it, ask once, then do what the user says:
"Make a new one, or update <name> (<its test app URL>)?" 「新しく作りますか？ それとも <名前>（<テスト用のアプリの URL>）を
更新しますか？」. Its test app URL: `kumodeck projects show --project <slug> --env development --json` (`liveDeployment.url`).
`kumodeck init --project <slug>` stops with `project_has_versions` when that project already has versions from another
folder: add `--yes` only after the user said to update it.

## No terminal and no files (Claude or ChatGPT on the web)

In a web chat (claude.ai, chatgpt.com, the phone apps) there is no terminal (`kumodeck` cannot run) and the user's files
are not on your side: you only have the KUMODeck MCP tools. You can still build and publish; the `deploy` Skill →
"Publishing from a web chat" has the steps.

**A big game, and you can run commands in your own workspace** (Grok Bot, ChatGPT's agent or code runner, Claude's code
execution on the web, Codex cloud, Claude Code on the web): a game of several MB or more, or with many images, sounds or
3D models, goes first with `npx kumodeck@latest login` (show the user the link and the code it prints: "Open this link.
If it shows the same code, press Allow."; then `npx kumodeck@latest login --resume` until signed in) and
`npx kumodeck@latest deploy <folder>` from the workspace's disk (`deploy` Skill §3b).
KUMODeck takes 100 MB per file, no limit in all; parts through the chat (step 2) stop at 20 MB and 1,000 files, and each
file goes whole in one call (about 4 MB at most: a 5 MB `.glb` cannot go in parts). If `npx`
cannot download (`ENOTFOUND`, `EAI_AGAIN`, a timeout), the workspace has no internet: use parts. Parts are for smaller
games or no commands; the upload page (step 5) only when neither works.

**When the user asks to make and publish (or update) a game or app, use `publish_game` alone — do not call other tools
for it.** The chat asks the user about each new tool once; every step and follow-up here is a call to `publish_game`, so
the user is asked once. The user wants it all done in the chat: never make them download, drop files or change settings
unless the steps below say so.

1. **New game, before writing code** (also a game the user already has, made earlier in the chat or pasted in: keep its
   code as it is, and add only `kumo-boot.js`, `kumo-config.js` and the loader from the `start` Skill, "Already have an
   app?", step 5): `publish_game` with `name`, the `features` the game uses (`saves`, `multiplayer`,
   `emailLogin`, …) and `prepare: true`. It makes the project, turns them on in the test app and returns `apiUrl`, the
   `keys` (shown only once: keep them) and `guides` — the how-to steps and the files to copy for those features (no need
   to look anything up). **Use `apiUrl` and the keys exactly as returned (e.g. in `kumo-config.js`); never guess them or
   take them from anywhere else.**
2. **Send the files** with `projectId`. Text files (HTML, JS, CSS, JSON, SVG) as `content` (plain text), images and sounds
   as `contentBase64`. Keep each call to about 100 KB: send a bigger game **in parts** — `more: true` on every part and the
   `uploadId` from the first part's result on the next ones; the last call (without `more`) publishes and returns the URL.
   Parts take up to 20 MB and 1,000 files, images and sounds included, with nothing for the user to do. Each file goes
   whole in one call (about 4 MB at most); a bigger single file (a 5 MB model) goes with the CLI (above) or the upload page.
3. **Settings** (e.g. `multiplayer.modes`): pass part of `kumo.config.json` as `config` on any call; it is checked and merged.
   **Server code** (the `functions-d1` Skill): pass it as `functions` with the files; with **everyone** it is in the same one confirmation.
4. **Update:** the same, with `projectId` and the new files. **Everyone** (only when the user asked for it):
   `everyone: true` on the last call; the user confirms once (in the chat or on a link); on a `confirmUrl`, call
   `publish_game` again with `pendingActionId`.
5. **Last resort, only for a game too big to send in parts (or with one file over about 4 MB), with no commands to run** (above): call
   `publish_game` without files; it gives a page where the user drops a zip ("Download the zip, then drop it on this
   page:" 「zip をダウンロードして、このページに落としてください」); call it again right away with `projectId` and `waitToken`.
6. Keys for other services: "Asking for a key" below (the same box, no terminal needed).

## Asking for a key (every Skill that needs one)

When the code needs the user's key for another service (OpenAI, Stripe, …), every Skill asks the same way:

1. Pick the name yourself (`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, …) and call the MCP tool `functions_secret_set` with
   that name and **no value**. (The Functions must be online once first: `functions_not_deployed` → deploy, then call again.)
   **Always pass `service` and `hint`** (same shape for every service): `service` = the other service's name
   (`"OpenAI"`, `"Stripe"`), `hint` = where they got it and how it starts, in the user's language
   (`"OpenAI のサイトでもらった sk- で始まる文字列"` / `"the text starting with sk- from the OpenAI site"`). The page shows
   "Paste your OpenAI key" / 「OpenAI のキーを貼ってください」 as its heading with the hint under it. Never put the key itself,
   a link or the product name in them (the tool refuses).
2. Say one sentence, with the service's site and how its text starts:
   "Paste the text that starts with sk- (from the OpenAI site) into the box that opens next."
   「OpenAI のサイトでもらった sk- で始まる文字列を、これから出る入力欄に貼ってください」
   If they do not have one yet, say in one line where on that site they get it.
3. If your chat opens the box (a button or a small page), the user pastes and presses Save; the tool answers that it was
   saved, without the value (you never see it). Then carry on by yourself.
   If it cannot (the tool returns a link instead, e.g. in Codex), give the link with the same sentence:
   "Open this link, paste the text that starts with sk- (from the OpenAI site) and press Save." /
   「このリンクを開いて、OpenAI のサイトでもらった sk- で始まる文字列を貼って、保存を押してください」. Wait until they say it is done.
4. Working in a terminal without the MCP tools: ask them to run `kumodeck functions secret put OPENAI_API_KEY`; it asks for
   the text without showing it.
5. **Never ask for the key in the chat** (the chat is kept as a record; a key that leaks lets someone else use it and the
   user pays). If they paste one anyway: ask them to make a new one on that site, delete the old one, and put the new one
   in the box.

### Keys from any service: chat in, server-side only

This is the same for **every** service the user brings (there are thousands; you do not need to know the service):

- A key for another service goes in through the chat box (`functions_secret_set` without a value, as above) and is used
  **only from the server-side code** (`functions/` — the Functions). The page calls your function; the function calls the
  service with the key. Never put such a key in the page code, `kumo-config.js`, `.env` files that get published, or git.
- **Only public keys may be written in the game's code**: keys the service itself says are for the browser —
  `pk_…` (Stripe, KUMODeck), Supabase's `sb_publishable_…` / anon key, Firebase's web `apiKey` (`AIza…` inside the
  `firebaseConfig` with `authDomain`).
- Publishing stops when a page file contains a key you saved, a known secret-key shape (`sk-…`, `sb_secret_…`,
  service_role, private keys …) or long random text right after a word like key / secret / token / password
  (`secret_like_content`; the deploy Skill says what to do).

Examples (the name you pick → what to say → where the code goes):

| Service | Name | Say | Server-side only | OK in the game's code |
| --- | --- | --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | "Paste the text that starts with sk- (from the OpenAI site) into the box that opens next." 「OpenAI のサイトでもらった sk- で始まる文字列を、これから出る入力欄に貼ってください」 | every call to OpenAI (`fetch('https://api.openai.com/…', { headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY } })` in a function) | nothing (the page calls your function) |
| Supabase | `SUPABASE_SECRET_KEY` | "Paste the text that starts with sb_secret_ (Supabase site → Project Settings → API Keys) into the box." 「Supabase のサイトの Project Settings → API Keys にある sb_secret_ で始まる文字列を、入力欄に貼ってください」 | the secret key (`sb_secret_…`) or the old service_role key: reads and writes everything | the URL (`https://….supabase.co`) and the publishable key (`sb_publishable_…`) or anon key, with Row Level Security on |
| Firebase | `FIREBASE_SERVICE_ACCOUNT` | "Paste the whole text of the file you downloaded from Firebase → Project settings → Service accounts → Generate new private key into the box." 「Firebase のサイトの プロジェクトの設定 → サービス アカウント → 新しい秘密鍵の生成 でダウンロードしたファイルの中身を、まるごと入力欄に貼ってください」 | the service account JSON (`"private_key": "-----BEGIN PRIVATE KEY-----…"`): the Admin SDK | the `firebaseConfig` (`apiKey: "AIza…"`, `authDomain`, `projectId`, …) with Security Rules on |
