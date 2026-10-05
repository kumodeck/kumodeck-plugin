/**
 * api-kit.ts — small helpers for endpoints in your own Functions. From the `functions-d1` Skill.
 * Copy to `functions/src/api-kit.ts` next to the starter's `kumo.ts`. No dependencies.
 *
 *   const routes = router([
 *     ['GET',  '/polls/:poll',      (req, p) => …],
 *     ['POST', '/polls/:poll/vote', (req, p) => …]
 *   ]);
 *   // in fetch(): const res = await routes(request); if (res) return res;
 *
 * The rules it follows (and why):
 *   - Who is calling comes ONLY from the verified token (`requireUser`), never from an id in the body or the URL:
 *     anything the browser sends can be changed by the person using it. Paid content: `requirePurchase` asks KUMODeck
 *     whether that user bought the product (never trust a "bought: true" sent by the page).
 *   - Errors answer `{ "error": "<code>" }` with the right status, the same shape as the leaderboard / chat Skills, so
 *     the page can branch on the code. Unexpected errors are logged and answer 500 `internal` (no stack traces out).
 *   - Bodies are read with a size cap and must be a JSON object.
 */

import { Kumo, type KumoEnv, type VerifiedPlayer } from './kumo';

/** An error that becomes `{ error: code }` with this HTTP status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Read a JSON object body (64 KB by default). 413 body_too_large · 400 bad_json. */
export async function readJson<T extends Record<string, unknown>>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpError(413, 'body_too_large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad_json');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'bad_json');
  return body as T;
}

/**
 * The signed-in user calling this endpoint (KUMODeck calls users "players").
 * The page sends `Authorization: Bearer <await kumo.auth.getAccessToken()>`.
 * 401 sign_in_required (no / expired / other environment's token) · 403 banned.
 * `players.verify` remembers a token for 30 s per isolate, so a new ban takes effect within 30 s here
 * (at once if your own code bans with `players.ban`, which clears that memory).
 */
export async function requireUser(request: Request, env: KumoEnv): Promise<VerifiedPlayer> {
  const user = await new Kumo(env).players.verify(request.headers.get('authorization'));
  if (!user) throw new HttpError(401, 'sign_in_required');
  if (user.banned) throw new HttpError(403, 'banned');
  return user;
}

/**
 * The signed-in user, only if they own a one-time product bought with KUMODeck payments (e.g. "vip", "pro_lifetime").
 * Use it for content your server must protect (a members-only endpoint); the page alone cannot (it can be modified).
 * Owned = a completed purchase: a full refund or a chargeback removes it, a partial refund keeps it.
 * 401 sign_in_required · 403 banned · 403 purchase_required.
 * maxAgeMs (default 30 s): a "yes" is remembered per user for that long, so a refund takes effect within it; a "no" only
 * for 3 s, so someone who has just paid gets in at once. 0 = ask KUMODeck every time.
 * Consumables (coin packs) have no "owned": read `players.inventory` instead.
 */
export async function requirePurchase(request: Request, env: KumoEnv, product: string, opts: { maxAgeMs?: number } = {}): Promise<VerifiedPlayer> {
  const user = await requireUser(request, env);
  const players = new Kumo(env).players;
  const maxAgeMs = opts.maxAgeMs ?? 30_000;
  // limit 1: "owned" does not depend on the history length, so ask for the smallest answer
  let r = await players.purchases(user.id, { product, limit: 1, maxAgeMs });
  if (r.product?.owned !== true && maxAgeMs > NO_MAX_AGE_MS) r = await players.purchases(user.id, { product, limit: 1, maxAgeMs: NO_MAX_AGE_MS });
  if (r.product?.type === 'consumable') throw new Error(`requirePurchase: "${product}" is a consumable; check players.inventory instead`);
  if (r.product?.owned !== true) throw new HttpError(403, 'purchase_required');
  return user;
}

// How long requirePurchase trusts a remembered "not bought": short, so a new buyer is not locked out, but not 0, so
// one user reloading a locked page does not spend the key's read allowance (6000 a minute)
const NO_MAX_AGE_MS = 3_000;

export type Params = Record<string, string>;
export type Handler = (request: Request, params: Params) => Promise<Response> | Response;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * A tiny router. Patterns are paths with `:name` parts (one path segment each). Returns null when nothing matches,
 * so the starter's own routes and 404 still work. HttpError → `{ error }` with its status; `headers` (e.g. CORS)
 * are added to every answer it makes.
 */
export function router(routes: Array<[Method, string, Handler]>) {
  const compiled = routes.map(([method, pattern, handler]) => {
    const names: string[] = [];
    const re = new RegExp(
      '^' +
        pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_m, name: string) => {
          names.push(name);
          return '/([^/]+)';
        }) +
        '/?$'
    );
    return { method, re, names, handler };
  });
  return async (request: Request, headers: Record<string, string> = {}): Promise<Response | null> => {
    const path = new URL(request.url).pathname;
    for (const r of compiled) {
      const m = r.re.exec(path);
      if (!m || r.method !== request.method) continue;
      const params: Params = {};
      r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1]!)));
      try {
        const res = await r.handler(request, params);
        for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
        return res;
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.code }, e.status, headers);
        console.error('unhandled error', e);
        return json({ error: 'internal' }, 500, headers);
      }
    }
    return null;
  };
}
