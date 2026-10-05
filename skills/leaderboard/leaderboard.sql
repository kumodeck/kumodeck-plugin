-- Leaderboard tables for your own database (SQLite / D1).
-- Copy to functions/migrations/ with the next free number (e.g. 0002_leaderboard.sql), then:
--   locally:  npx wrangler d1 migrations apply DB --local
--   on KUMODeck:  kumodeck functions db migrate DB            (development; add --env production when you ship)
-- Keep the column names and types as they are: leaderboard.ts relies on them.
-- Times are Unix milliseconds (UTC). Periods: 'all' (key 'all'), 'week' (key '2026-W39', ISO week, UTC),
-- 'day' (key '2026-09-27', UTC).

-- One row per board. `sort` says which way is better: 'desc' = higher is better (points),
-- 'asc' = lower is better (time in ms, strokes). Written by leaderboard.ts from its BOARDS setting.
CREATE TABLE IF NOT EXISTS leaderboard_boards (
  board      TEXT PRIMARY KEY,
  sort       TEXT NOT NULL CHECK (sort IN ('desc', 'asc')),
  updated_at INTEGER NOT NULL
);

-- Each player's best score per board and period. Three rows per player per board at most at a time
-- (all / this week / today); a new period starts with a new period_key.
CREATE TABLE IF NOT EXISTS leaderboard_scores (
  board        TEXT    NOT NULL,
  period       TEXT    NOT NULL CHECK (period IN ('all', 'week', 'day')),
  period_key   TEXT    NOT NULL,
  player_id    TEXT    NOT NULL,
  display_name TEXT,
  score        INTEGER NOT NULL,
  achieved_at  INTEGER NOT NULL,
  PRIMARY KEY (board, period, period_key, player_id)
);
-- Top N and "how many are ahead of me" for either direction (SQLite walks the index both ways).
CREATE INDEX IF NOT EXISTS leaderboard_scores_rank
  ON leaderboard_scores (board, period, period_key, score, achieved_at);

-- Every accepted submission (history, per-player rate limits, spotting odd patterns). Old rows are
-- removed by the scheduled clean-up (HISTORY_DAYS in leaderboard.ts).
CREATE TABLE IF NOT EXISTS leaderboard_submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board      TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,
  score      INTEGER NOT NULL,
  run_id     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_submissions_player ON leaderboard_submissions (player_id, created_at);
CREATE INDEX IF NOT EXISTS leaderboard_submissions_created ON leaderboard_submissions (created_at);

-- Server-started runs (only used when a board sets requireRun): the server records when a play started,
-- so the time a score took is measured by your server, not reported by the game.
CREATE TABLE IF NOT EXISTS leaderboard_runs (
  run_id     TEXT PRIMARY KEY,
  board      TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,
  started_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS leaderboard_runs_player ON leaderboard_runs (player_id, started_at);
CREATE INDEX IF NOT EXISTS leaderboard_runs_started ON leaderboard_runs (started_at);
