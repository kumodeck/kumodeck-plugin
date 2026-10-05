/**
 * Leaderboard for your own Functions + your own database (D1). Copy to functions/src/leaderboard.ts.
 * Tables: leaderboard.sql. Nothing here calls a hosted leaderboard: scores live in YOUR database, and every rule
 * (limits, rate limits, server-timed runs) is yours to choose in BOARDS below.
 *
 *   POST /leaderboard/runs     { board }                    → 201 { runId, startedAt }       (player token required)
 *   POST /leaderboard/scores   { board, score, runId? }     → 201 { improved: { all, week, day } }  (player token required)
 *   GET  /leaderboard/top?board=main&period=all|week|day&limit=10[&key=2026-W39]   → { entries: [{ rank, name, score, at }] }
 *   GET  /leaderboard/me?board=main&period=all|week|day[&key=…]                    → { rank, score, total } (token required)
 *
 * Wire it into src/index.ts (inside fetch, before the 404):
 *   const lb = await handleLeaderboard(request, this.env.DB, {
 *     verify: (auth) => new Kumo(this.env).players.verify(auth),
 *     headers: cors
 *   });
 *   if (lb) return lb;
 * and in scheduled():  await cleanupLeaderboard(this.env.DB);
 *
 * No imports on purpose: the player check is passed in (`verify`), so this file works with the starter's kumo.ts and
 * is easy to test on its own.
 */

// ---------------------------------------------------------------------------------------------------------------
// Settings — decided by the game's creator. Every anti-cheat knob is optional; null / false = off.
// ---------------------------------------------------------------------------------------------------------------

export interface BoardRule {
  /** 'desc' = higher is better (points). 'asc' = lower is better (a time in ms, strokes, moves). */
  sort: 'desc' | 'asc';
  /** Accept only whole numbers in [min, max]. Pick the real limits of your game. */
  min: number;
  max: number;
  /** At most this many submissions per player per minute on this board (null = no limit). */
  maxPerMinute: number | null;
  /** Require a server-started run (POST /leaderboard/runs) for each score; each run can be used once. */
  requireRun: boolean;
  /** With requireRun: a run must last at least this long (ms) before its score counts (null = no minimum). */
  minRunMs: number | null;
  /** With requireRun, 'desc' boards only: the score may grow at most this much per second of server-measured play (null = no cap). */
  maxScorePerSecond: number | null;
}

export const BOARDS: Record<string, BoardRule> = {
  main: { sort: 'desc', min: 0, max: 1_000_000_000, maxPerMinute: 30, requireRun: false, minRunMs: null, maxScorePerSecond: null }
};

/** How long to keep old day / week rows, the submission history and unused runs (the all-time rows are kept). */
export const KEEP_DAYS = 35;
export const KEEP_WEEKS = 12;
export const HISTORY_DAYS = 30;
const RUN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_LIMIT = 100;

export type Period = 'all' | 'week' | 'day';
const PERIODS: Period[] = ['all', 'week', 'day'];

export interface Player {
  id: string;
  displayName: string | null;
  banned: boolean;
}

export interface LeaderboardOptions {
  /** Checks the caller's `Authorization: Bearer <token>`; null = not signed in. */
  verify: (authorization: string | null) => Promise<Player | null>;
  /** Extra response headers (CORS). */
  headers?: Record<string, string>;
  /** Clock (tests). */
  now?: () => number;
  /** Run ids (tests). */
  newId?: () => string;
}

// ---------------------------------------------------------------------------------------------------------------
// Periods (UTC)
// ---------------------------------------------------------------------------------------------------------------

/** 'all' | '2026-W39' (ISO week) | '2026-09-27'. */
export function periodKey(period: Period, at: number): string {
  if (period === 'all') return 'all';
  const d = new Date(at);
  if (period === 'day') return d.toISOString().slice(0, 10);
  // ISO week: the week belongs to the year of its Thursday; weeks start on Monday.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const KEY_PATTERN: Record<Period, RegExp> = { all: /^all$/, week: /^\d{4}-W\d{2}$/, day: /^\d{4}-\d{2}-\d{2}$/ };

// ---------------------------------------------------------------------------------------------------------------
// SQL. The sort direction cannot be a bound parameter, so each query exists in two fixed versions (no string building
// from input).
// ---------------------------------------------------------------------------------------------------------------

const UPSERT_BEST = {
  desc: `INSERT INTO leaderboard_scores (board, period, period_key, player_id, display_name, score, achieved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (board, period, period_key, player_id) DO UPDATE
           SET score = excluded.score, display_name = excluded.display_name, achieved_at = excluded.achieved_at
           WHERE excluded.score > leaderboard_scores.score`,
  asc: `INSERT INTO leaderboard_scores (board, period, period_key, player_id, display_name, score, achieved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (board, period, period_key, player_id) DO UPDATE
          SET score = excluded.score, display_name = excluded.display_name, achieved_at = excluded.achieved_at
          WHERE excluded.score < leaderboard_scores.score`
} as const;

// Ties: whoever reached the score first ranks higher (then player id, so the order never flips).
const TOP = {
  desc: `SELECT display_name AS name, score, achieved_at AS at FROM leaderboard_scores
         WHERE board = ? AND period = ? AND period_key = ?
         ORDER BY score DESC, achieved_at ASC, player_id ASC LIMIT ?`,
  asc: `SELECT display_name AS name, score, achieved_at AS at FROM leaderboard_scores
        WHERE board = ? AND period = ? AND period_key = ?
        ORDER BY score ASC, achieved_at ASC, player_id ASC LIMIT ?`
} as const;

const AHEAD = {
  desc: `SELECT COUNT(*) AS n FROM leaderboard_scores
         WHERE board = ? AND period = ? AND period_key = ?
           AND (score > ? OR (score = ? AND (achieved_at < ? OR (achieved_at = ? AND player_id < ?))))`,
  asc: `SELECT COUNT(*) AS n FROM leaderboard_scores
        WHERE board = ? AND period = ? AND period_key = ?
          AND (score < ? OR (score = ? AND (achieved_at < ? OR (achieved_at = ? AND player_id < ?))))`
} as const;

// ---------------------------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

/** Handles /leaderboard/* and returns a Response; returns null for any other path (so your own routes keep working). */
export async function handleLeaderboard(request: Request, db: D1Database, opts: LeaderboardOptions): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/leaderboard/')) return null;
  const headers = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  const now = opts.now ?? Date.now;
  try {
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /leaderboard/top') return reply(await top(db, url, now()));
    if (route === 'GET /leaderboard/me') return reply(await me(db, url, await signedIn(request, opts), now()));
    if (route === 'POST /leaderboard/runs') {
      const body = await readBody(request);
      return reply(await startRun(db, board(body.board), await signedIn(request, opts), now(), opts.newId ?? (() => crypto.randomUUID())), 201);
    }
    if (route === 'POST /leaderboard/scores') {
      const body = await readBody(request);
      return reply(await submit(db, body, await signedIn(request, opts), now()), 201);
    }
    return reply({ error: 'not_found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.code }, e.status);
    throw e;
  }
}

async function signedIn(request: Request, opts: LeaderboardOptions): Promise<Player> {
  const player = await opts.verify(request.headers.get('authorization'));
  if (!player) throw new HttpError(401, 'sign_in_required');
  if (player.banned) throw new HttpError(403, 'banned');
  return player;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'json_body_required');
  return body as Record<string, unknown>;
}

function board(name: unknown): string {
  const key = name === undefined ? 'main' : name;
  if (typeof key !== 'string' || !Object.hasOwn(BOARDS, key)) throw new HttpError(400, 'unknown_board');
  return key;
}

function period(p: string | null): Period {
  const v = p ?? 'all';
  if (!(PERIODS as string[]).includes(v)) throw new HttpError(400, 'period_must_be_all_week_or_day');
  return v as Period;
}

function key(p: Period, raw: string | null, at: number): string {
  if (raw === null) return periodKey(p, at);
  if (!KEY_PATTERN[p].test(raw)) throw new HttpError(400, 'bad_period_key');
  return raw;
}

async function top(db: D1Database, url: URL, at: number) {
  const b = board(url.searchParams.get('board') ?? undefined);
  const p = period(url.searchParams.get('period'));
  const k = key(p, url.searchParams.get('key'), at);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '10', 10) || 10, 1), MAX_LIMIT);
  const { results } = await db.prepare(TOP[BOARDS[b]!.sort]).bind(b, p, k, limit).all<{ name: string | null; score: number; at: number }>();
  return { board: b, period: p, key: k, sort: BOARDS[b]!.sort, entries: results.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, at: r.at })) };
}

async function me(db: D1Database, url: URL, player: Player, at: number) {
  const b = board(url.searchParams.get('board') ?? undefined);
  const p = period(url.searchParams.get('period'));
  const k = key(p, url.searchParams.get('key'), at);
  const sort = BOARDS[b]!.sort;
  const total = (await db.prepare('SELECT COUNT(*) AS n FROM leaderboard_scores WHERE board = ? AND period = ? AND period_key = ?').bind(b, p, k).first<number>('n')) ?? 0;
  const mine = await db
    .prepare('SELECT score, achieved_at FROM leaderboard_scores WHERE board = ? AND period = ? AND period_key = ? AND player_id = ?')
    .bind(b, p, k, player.id)
    .first<{ score: number; achieved_at: number }>();
  if (!mine) return { board: b, period: p, key: k, rank: null, score: null, total };
  const ahead = (await db.prepare(AHEAD[sort]).bind(b, p, k, mine.score, mine.score, mine.achieved_at, mine.achieved_at, player.id).first<number>('n')) ?? 0;
  return { board: b, period: p, key: k, rank: ahead + 1, score: mine.score, total };
}

async function startRun(db: D1Database, b: string, player: Player, at: number, newId: () => string) {
  // Starting runs has the same per-minute cap as submitting, so runs cannot be piled up in advance.
  const max = BOARDS[b]!.maxPerMinute;
  if (max !== null) {
    const recent = (await db.prepare('SELECT COUNT(*) AS n FROM leaderboard_runs WHERE player_id = ? AND board = ? AND started_at > ?').bind(player.id, b, at - 60_000).first<number>('n')) ?? 0;
    if (recent >= max) throw new HttpError(429, 'too_many_runs');
  }
  const runId = newId();
  await db.prepare('INSERT INTO leaderboard_runs (run_id, board, player_id, started_at) VALUES (?, ?, ?, ?)').bind(runId, b, player.id, at).run();
  return { runId, startedAt: at };
}

async function rateLimit(db: D1Database, b: string, player: Player, at: number) {
  const max = BOARDS[b]!.maxPerMinute;
  if (max === null) return;
  const recent = (await db.prepare('SELECT COUNT(*) AS n FROM leaderboard_submissions WHERE player_id = ? AND board = ? AND created_at > ?').bind(player.id, b, at - 60_000).first<number>('n')) ?? 0;
  if (recent >= max) throw new HttpError(429, 'too_many_submissions');
}

async function submit(db: D1Database, body: Record<string, unknown>, player: Player, at: number) {
  const b = board(body.board);
  const rule = BOARDS[b]!;
  const score = body.score;
  if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < rule.min || score > rule.max) throw new HttpError(400, 'score_out_of_range');
  await rateLimit(db, b, player, at);

  let runId: string | null = null;
  if (rule.requireRun) {
    if (typeof body.runId !== 'string') throw new HttpError(400, 'run_required');
    runId = body.runId;
    // Mark the run used first, so the same run can never count twice (even with two requests at once).
    const run = await db
      .prepare('UPDATE leaderboard_runs SET used_at = ? WHERE run_id = ? AND player_id = ? AND board = ? AND used_at IS NULL AND started_at > ? RETURNING started_at')
      .bind(at, runId, player.id, b, at - RUN_TTL_MS)
      .first<{ started_at: number }>();
    if (!run) throw new HttpError(409, 'run_not_found_or_used');
    const playedMs = at - run.started_at;
    if (rule.minRunMs !== null && playedMs < rule.minRunMs) throw new HttpError(422, 'run_too_short');
    // Points boards: the score cannot grow faster than the game allows. (Time boards: use minRunMs — the fastest
    // possible clear — since the server measured the real play time.)
    if (rule.maxScorePerSecond !== null && rule.sort === 'desc' && score > (playedMs / 1000) * rule.maxScorePerSecond) throw new HttpError(422, 'score_too_fast');
  }

  const upsert = db.prepare(UPSERT_BEST[rule.sort]);
  const results = await db.batch([
    db.prepare(
      `INSERT INTO leaderboard_boards (board, sort, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (board) DO UPDATE SET sort = excluded.sort, updated_at = excluded.updated_at WHERE leaderboard_boards.sort <> excluded.sort`
    ).bind(b, rule.sort, at),
    db.prepare('INSERT INTO leaderboard_submissions (board, player_id, score, run_id, created_at) VALUES (?, ?, ?, ?, ?)').bind(b, player.id, score, runId, at),
    ...PERIODS.map((p) => upsert.bind(b, p, periodKey(p, at), player.id, player.displayName, score, at))
  ]);
  const improved = Object.fromEntries(PERIODS.map((p, i) => [p, (results[i + 2]?.meta.changes ?? 0) > 0])) as Record<Period, boolean>;
  return { board: b, score, improved };
}

// ---------------------------------------------------------------------------------------------------------------
// Scheduled clean-up (call from scheduled()). All-time rows are never removed here.
// ---------------------------------------------------------------------------------------------------------------

export async function cleanupLeaderboard(db: D1Database, at: number = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM leaderboard_scores WHERE period = 'day' AND period_key < ?").bind(periodKey('day', at - KEEP_DAYS * 86_400_000)),
    db.prepare("DELETE FROM leaderboard_scores WHERE period = 'week' AND period_key < ?").bind(periodKey('week', at - KEEP_WEEKS * 7 * 86_400_000)),
    db.prepare('DELETE FROM leaderboard_submissions WHERE created_at < ?').bind(at - HISTORY_DAYS * 86_400_000),
    db.prepare('DELETE FROM leaderboard_runs WHERE started_at < ?').bind(at - RUN_TTL_MS)
  ]);
}
