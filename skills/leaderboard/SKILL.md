---
name: leaderboard
description: Add a leaderboard (top scores, weekly / daily rankings, "my rank") to this game, built in the game's own Functions and its own SQL database. Use when the user asks for a leaderboard, ranking, high scores, best times or score submission.
---

# Leaderboard in your own Functions + database

This recipe puts a leaderboard into code the creator owns: tables in the environment's own SQLite database (D1)
and endpoints in their own Functions. The code and the rules (including how to stop cheating) belong to the creator.

Files next to this SKILL.md (copy them, then adapt the settings — do not rewrite them from scratch):

| File | Copy to | What it is |
|---|---|---|
| [leaderboard.sql](leaderboard.sql) | `functions/migrations/000N_leaderboard.sql` (next free number) | the tables and indexes |
| [leaderboard.ts](leaderboard.ts) | `functions/src/leaderboard.ts` | the endpoints, the `BOARDS` settings, the clean-up |
| [leaderboard-client.js](leaderboard-client.js) | next to the game code that imports it: `public/` without a build step, `src/` with one (Vite) | the game-side calls |

Do not use a built-in KUMODeck ranking for this; the scores live in the creator's database.
If the game's code already calls a ranking API from the SDK, replace those calls with the client below.

**Protect in D1, not in saves.** Anything a user must not be able to change themselves — scores and rankings, coins, credits, items, purchases, badges, anything shared between users — goes in the project's own Functions + D1. `saves` holds only what the user may freely write (settings, drafts, a solo game's progress).
Scores and personal bests that go on the board are kept in D1, never in `saves` (a player could write any number there).

## 1. Ask the creator first (they decide; offer these as choices, one short message)

1. **Boards**: names (e.g. `main`, `stage-1`) and direction for each — higher is better (points) → `sort: 'desc'`,
   lower is better (a time in ms, strokes) → `sort: 'asc'`. Scores are whole numbers (store times in ms).
2. **Which lists to show**: all time, this week (Monday start, UTC), today (UTC). All three are recorded either way.
3. **Cheating** — anything a browser sends can be faked, so pick what fits the game (any mix, or none):
   - **Limits**: reject scores outside `[min, max]` (the real limits of the game). Cheap, always recommended.
   - **Rate limit**: at most `maxPerMinute` submissions per player per board.
   - **Server-timed runs**: the game calls `startRun` when play begins; the server records the time and each run counts
     once. Then `minRunMs` (fastest possible play) and, for points, `maxScorePerSecond` (fastest possible scoring)
     are checked against time your server measured.
   - **Stronger** (write it with them if they want it): have the game send the moves / inputs and recompute the score
     on the server, or run the match on the server; also review `leaderboard_submissions` for odd patterns and remove
     rows with `kumodeck functions db query DB "…"`.
   Say plainly that no option makes cheating impossible, and that the choice is theirs.

Do not pick silently. If the creator says "you choose", use limits + rate limit (30 / minute) and tell them.

**After building, add one line with what else they can ask for** (1–2 sentences, plain words, never naming what you
just built; the closing line of `deploy` §1 stays last). Pick from what this recipe really does and they did not get:
the weekly or daily list, one board per stage or mode, a stronger check against cheating (the server times each play,
or checks the moves), or letting players pick a name shown on the board (the `user-login` Skill). E.g.
「今週・今日のランキングや、ステージごとのランキング、ずるをもっと強く止める仕組みも付けられます。言ってくれれば作ります」.
Only name things from the dashboard's guide list (online multiplayer, leaderboards, sign-in, saving, server code and a
database, your own domain, a card on X).

## 2. Server side (Functions)

1. Find the Functions folder (it has `wrangler.jsonc` with a `DB` database and `src/kumo.ts`). If there is none, create
   one in the game's folder (the one with `kumo.json`; none yet: the `start` Skill, "Already have an app"; the game
   already has an `api/` folder of its own: use another name, e.g. `kumodeck create scores-api --template functions-starter`):
   `kumodeck create api --template functions-starter` (no `kumodeck init` in `api/`: `kumodeck functions …`
   uses the game's `kumo.json` above; details in the `functions-d1` Skill §2). Its README has the local setup (`.dev.vars` — the **user** puts their `sk_dev_…` there; never print it).
2. Copy `leaderboard.sql` into `migrations/` with the next number. Keep table names, column names and types exactly as
   they are (`leaderboard.ts` depends on them). Extra tables of your own are fine.
3. Copy `leaderboard.ts` into `src/`. Set `BOARDS` from the creator's answers, e.g.
   ```ts
   export const BOARDS: Record<string, BoardRule> = {
     main:   { sort: 'desc', min: 0, max: 99_999, maxPerMinute: 30, requireRun: true, minRunMs: 20_000, maxScorePerSecond: 400 },
     sprint: { sort: 'asc',  min: 15_000, max: 3_600_000, maxPerMinute: 10, requireRun: true, minRunMs: 15_000, maxScorePerSecond: null }
   };
   ```
   `KEEP_DAYS` / `KEEP_WEEKS` / `HISTORY_DAYS` control how long daily / weekly lists and the submission history are kept.
4. Wire it in `src/index.ts` (the starter's `fetch` already computes `cors`):
   ```ts
   import { cleanupLeaderboard, handleLeaderboard } from './leaderboard';
   // in fetch(), before the final 404:
   const lb = await handleLeaderboard(request, this.env.DB, {
     verify: (auth) => new Kumo(this.env).players.verify(auth),
     headers: cors
   });
   if (lb) return lb;
   // in scheduled():
   await cleanupLeaderboard(this.env.DB);
   ```
   The starter's own `/scores` example can be removed once the game uses the leaderboard.
5. Try it locally: `npx wrangler d1 migrations apply DB --local` → `kumodeck functions dev`, then
   `curl "http://localhost:8787/leaderboard/top?board=main&period=all"` → `{"entries":[]…}`.
6. Ship (development first): `kumodeck functions enable` (once; needs prepaid credit) → `kumodeck functions db migrate DB` →
   `kumodeck functions deploy` → `kumodeck functions status` shows the URL. Production: the same with `--env production`,
   only when the user asks.

Endpoints (all JSON; errors are `{ "error": "<code>" }`):

| Call | Needs the player's token | Answer |
|---|---|---|
| `POST /leaderboard/runs` `{ board }` | yes | `{ runId, startedAt }` |
| `POST /leaderboard/scores` `{ board, score, runId? }` | yes | `{ improved: { all, week, day } }` — which lists got a new personal best |
| `GET /leaderboard/top?board=&period=all\|week\|day&limit=10[&key=]` | no | `{ entries: [{ rank, name, score, at }] }` |
| `GET /leaderboard/me?board=&period=[&key=]` | yes | `{ rank, score, total }` (`rank: null` before a first score) |

`key` shows a past list: `2026-W39` (ISO week) or `2026-09-27` (day). Error codes: 401 `sign_in_required`,
403 `banned`, 400 `score_out_of_range` / `unknown_board` / `run_required`, 409 `run_not_found_or_used`,
422 `run_too_short` / `score_too_fast`, 429 `too_many_submissions` / `too_many_runs`.

## 3. Game side

1. Put the Functions URLs in one place, the `kumo-config.js` the page loads (public values only), next to the existing settings:
   `functionsUrls: { development: 'https://…--dev.…', production: 'https://….…' }` (from `kumodeck functions status`, and
   `kumodeck functions status --env production` once production exists).
2. Copy `leaderboard-client.js` next to the game code and use it after sign-in:
   ```js
   import { pageEnvironment } from './kumo-boot.js';
   import { createLeaderboard } from './leaderboard-client.js';
   const board = createLeaderboard({ url: window.KUMO_CONFIG.functionsUrls[pageEnvironment()], kumo });

   const run = await board.startRun('main').catch(() => null);         // at the start of a round (if requireRun)
   // … at the end of the round:
   try {
     await board.submit('main', score, run?.runId);
     const { entries } = await board.top('main', 'week', 10);
     const mine = await board.me('main', 'week');
     // show entries (rank, name, score) and mine.rank / mine.total
   } catch (e) { console.warn('leaderboard unavailable', e); }        // never block play on the leaderboard
   ```
   With a build step (Vite), `kumo-boot.js` is not imported in the source: use `boot.pageEnvironment()` from the module the
   page loaded at run time (the `start` Skill, "Already have an app" step 5).
3. Names come from the player's display name when they submit. Let players set one (`kumo.auth` / the game's own UI)
   so the list does not fill up with empty names; render names as text, never as HTML.
4. The game's own KUMODeck URLs (development, production, its verified custom domain) and `web.allowedOrigins` may call the
   Functions: KUMODeck sets them (`KUMO_ALLOWED_ORIGINS`) and updates them when those change. If it could not,
   `kumodeck functions status` says to deploy again. Any other site needs its origin in `ALLOWED_ORIGINS` in `wrangler.jsonc` `vars`.

5. **Scores from before the leaderboard** (the game was played without it):
   - A best score kept on the player's device (`localStorage`, a save): it was never checked, and anyone can type a
     number there, so do not send it to the board. Keep showing it as "Your best on this device" next to the board; the
     board fills with scores the server checked.
   - Scores the game already kept on a server of its own: bring them in once as all-time rows, after the leaderboard
     migration, from an export of the old table (one row per old score). They show under their old names and are not
     tied to anyone's account here (`imported:` ids never match a user), so they cannot be improved or deleted by a
     player; new scores rank among them:
     ```sql
     -- functions/migrations/000N_import_scores.sql (the number after the leaderboard one)
     INSERT OR IGNORE INTO leaderboard_scores (board, period, period_key, player_id, display_name, score, achieved_at) VALUES
       ('main', 'all', 'all', 'imported:42', 'Mika', 1200, 1759708800000),
       ('main', 'all', 'all', 'imported:43', 'Ren', 950, 1759712400000);
     ```
     `board` is a key of `BOARDS`; `score` a whole number in the board's direction; `achieved_at` Unix milliseconds.
     Then `kumodeck functions db migrate DB` as usual.

## 4. Notes for the creator

- Cost: each submission writes up to 4 rows (the history + up to three personal bests), each list read reads
  up to `limit` rows; billed at cost from prepaid credit like everything else in Functions.
- The data is theirs: to delete a player's data on request,
  `DELETE FROM leaderboard_scores WHERE player_id = ?` (and the same for `leaderboard_submissions`, `leaderboard_runs`).
- Keep the table and column names when changing the code later; add new columns or tables instead of renaming, so
  existing scores keep working.
