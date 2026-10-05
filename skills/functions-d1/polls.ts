/**
 * polls.ts — an example feature built the functions-d1 way: users vote once per poll, everyone sees the counts.
 * From the `functions-d1` Skill. Copy to `functions/src/polls.ts`, change POLLS, or use it as the pattern for your own
 * endpoints (verify the caller → check the input against rules the server owns → write with bound parameters and a
 * constraint the database enforces → answer JSON).
 *
 *   GET  /polls/:poll          → { poll, counts: { red: 3, … }, total }
 *   GET  /polls/:poll/mine     → { choice | null }                      (needs the user's token)
 *   POST /polls/:poll/vote     { choice } → 201 { choice }              (needs the user's token)
 * Errors: 404 unknown_poll · 400 unknown_choice / bad_json · 401 sign_in_required · 403 banned · 409 already_voted / poll_closed
 */

import { HttpError, json, readJson, requireUser, router } from './api-kit';
import type { KumoEnv } from './kumo';

/** The polls and their choices. Server-owned: the page cannot add a choice or vote after `closesAt`. */
export const POLLS: Record<string, { choices: string[]; closesAt?: string }> = {
  favorite_color: { choices: ['red', 'green', 'blue'] }
};

const pollOf = (key: string) => {
  // Object.hasOwn: "__proto__" and friends are not polls
  if (!Object.hasOwn(POLLS, key)) throw new HttpError(404, 'unknown_poll');
  return POLLS[key]!;
};

export function pollRoutes(env: KumoEnv & { DB: D1Database }, now: () => number = Date.now) {
  return router([
    [
      'GET',
      '/polls/:poll',
      async (_req, { poll }) => {
        const def = pollOf(poll!);
        const { results } = await env.DB.prepare('SELECT choice, COUNT(*) AS n FROM poll_votes WHERE poll = ?1 GROUP BY choice')
          .bind(poll)
          .all<{ choice: string; n: number }>();
        const counts: Record<string, number> = Object.fromEntries(def.choices.map((c) => [c, 0]));
        for (const r of results) if (r.choice in counts) counts[r.choice] = r.n;
        return json({ poll, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
      }
    ],
    [
      'GET',
      '/polls/:poll/mine',
      async (req, { poll }) => {
        pollOf(poll!);
        const user = await requireUser(req, env);
        const row = await env.DB.prepare('SELECT choice FROM poll_votes WHERE poll = ?1 AND player_id = ?2').bind(poll, user.id).first<{ choice: string }>();
        return json({ choice: row?.choice ?? null });
      }
    ],
    [
      'POST',
      '/polls/:poll/vote',
      async (req, { poll }) => {
        const def = pollOf(poll!);
        const user = await requireUser(req, env);
        if (def.closesAt && now() >= Date.parse(def.closesAt)) throw new HttpError(409, 'poll_closed');
        const { choice } = await readJson<{ choice?: unknown }>(req);
        if (typeof choice !== 'string' || !def.choices.includes(choice)) throw new HttpError(400, 'unknown_choice');
        // ON CONFLICT DO NOTHING + changes: two votes sent at the same moment still count once (the primary key decides)
        const r = await env.DB.prepare('INSERT INTO poll_votes (poll, player_id, choice, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING')
          .bind(poll, user.id, choice, now())
          .run();
        if (!r.meta.changes) throw new HttpError(409, 'already_voted');
        return json({ choice }, 201);
      }
    ]
  ]);
}
