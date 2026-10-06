/**
 * Game-side client for the leaderboard in your Functions (leaderboard.ts). Copy it next to the game code that imports
 * it (public/ without a build step, src/ with one such as Vite).
 * No dependencies. Sends the signed-in player's token so your server knows who is submitting.
 *
 *   import { createLeaderboard } from './leaderboard-client.js';
 *   const board = createLeaderboard({ url: FUNCTIONS_URL, kumo });
 *   const run = await board.startRun('main');            // only if the board sets requireRun
 *   await board.submit('main', score, run?.runId);
 *   const { entries } = await board.top('main', 'week', 10);
 *   const mine = await board.me('main', 'week');         // { rank, score, total } — rank is null before a first score
 *
 * Never let the leaderboard block play: wrap calls in try/catch and keep the game going when they fail.
 */

export function createLeaderboard({ url, kumo }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) throw new Error('createLeaderboard: pass the Functions URL (see `kumodeck functions status`)');

  async function call(method, path, body, signed) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (signed) headers.authorization = `Bearer ${await kumo.auth.getAccessToken()}`;
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`leaderboard ${method} ${path}: ${res.status} ${data.error || ''}`.trim());
      err.status = res.status;
      err.code = data.error;
      throw err;
    }
    return data;
  }

  const query = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();

  return {
    startRun: (board = 'main') => call('POST', '/leaderboard/runs', { board }, true),
    submit: (board, score, runId) => call('POST', '/leaderboard/scores', { board, score, ...(runId ? { runId } : {}) }, true),
    top: (board = 'main', period = 'all', limit = 10, key) => call('GET', `/leaderboard/top?${query({ board, period, limit, key })}`),
    me: (board = 'main', period = 'all', key) => call('GET', `/leaderboard/me?${query({ board, period, key })}`, undefined, true)
  };
}
