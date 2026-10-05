/**
 * Chat history for your own Functions + your own database (D1). Copy to functions/src/chat.ts.
 * Tables: chat.sql. Messages travel through a realtime channel (kumo.realtime); this file is where YOUR server checks
 * who sent a message, applies YOUR rules (length, rate, blocked words) and keeps the history in YOUR database.
 * The realtime channel itself stores nothing.
 *
 *   GET  /chat/history?channel=lobby&limit=50[&before=<id>]   → { channel, delivery, maxLength, messages: [...] } (player token required)
 *   POST /chat/messages  { channel, text, clientId }            → 201 { message }                                  (player token required)
 *   message = { id, clientId, playerId, name, text, at }        (oldest first in `messages`)
 *
 * Two ways a message reaches the channel (per channel, `delivery` in CHANNELS below):
 *   'direct' — the game saves the message here, then sends it to the channel itself (ch.send). Fast and cheap. A modified
 *              game could skip this server and send anything straight to the channel (the channel's own size and rate
 *              limits still apply).
 *   'server' — the game only calls POST /chat/messages; this server checks, saves, then sends it to the channel with
 *              your secret key (`relay` below). Nothing unchecked is shown, because the game shows only messages
 *              that come from the server. One extra hop per message, and your key can send about 600 messages a minute.
 *
 * Wire it into src/index.ts (inside fetch, before the 404):
 *   const chat = await handleChat(request, this.env.DB, {
 *     verify: (auth) => new Kumo(this.env).players.verify(auth),
 *     relay: (channel, type, data) =>
 *       new Kumo(this.env).request('POST', `/v1/realtime/channels/${encodeURIComponent(channel)}/messages`, { type, data }),
 *     room: (channel) => new Kumo(this.env).request('GET', `/v1/realtime/channels/${encodeURIComponent(channel)}`),
 *     headers: cors
 *   });
 *   if (chat) return chat;
 * and in scheduled():  await cleanupChat(this.env.DB);
 *
 * Before a message is saved, the channel is asked (with your secret key) whether the sender may write there: in the
 * channel, not muted, not banned, and allowed to send when only invited players may send. So a mute or ban in the
 * channel also stops the history and the 'server' relay, not only the live channel. See `roomRefusal` below.
 *
 * No imports on purpose: the player check and the relay are passed in, so this file works with the starter's kumo.ts
 * and is easy to test on its own.
 */

// ---------------------------------------------------------------------------------------------------------------
// Settings — decided by the game's creator. Every protection is optional; null / [] = off.
// ---------------------------------------------------------------------------------------------------------------

export interface ChatRule {
  /** 'direct' = the game sends to the channel after saving; 'server' = this server sends it (see the top of the file). */
  delivery: 'direct' | 'server';
  /** Longest message, in characters (Unicode code points: 'é' and most emoji count as one). */
  maxLength: number;
  /** At most this many messages per player per minute in this channel (null = no limit). */
  maxPerMinute: number | null;
  /** Words or phrases to stop (matched without case, anywhere in the message). */
  blockedWords: string[];
  /** 'reject' = refuse the message (400 blocked_word); 'mask' = replace the word with * and keep the message. */
  onBlocked: 'reject' | 'mask';
}

/**
 * Which channels keep a history, and their rules. Keys are channel names; a key ending in `*` matches every name that
 * starts with the part before it ('match-*' → 'match-12', '@*' → rooms players create). An exact name wins over a
 * pattern, and the longest pattern wins. Channels not listed here are not saved (400 unknown_channel).
 */
export const CHANNELS: Record<string, ChatRule> = {
  lobby: { delivery: 'direct', maxLength: 200, maxPerMinute: 20, blockedWords: [], onBlocked: 'reject' }
};

/** How long messages are kept (days). The scheduled clean-up removes older rows. */
export const KEEP_DAYS = 30;
/** The message type used on the realtime channel (ch.send(type, …) / on('message')). */
export const MESSAGE_TYPE = 'chat';
const MAX_LIMIT = 100;
const CHANNEL_NAME = /^@?[A-Za-z0-9_][A-Za-z0-9_\-:.]{0,62}$/;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
/**
 * How long one answer from `room` is reused for the same channel (milliseconds, per running copy of your server).
 * WHY a cache: every message would otherwise cost one extra call, and GET /v1/realtime/channels/:name shares your key's
 * limit of 300 calls a minute with mute / kick / ban — a busy chat must not use up the calls you need to moderate.
 * WHY only 3 s: a player muted or banned in the channel can still post for at most this long. 0 = ask every time.
 */
export const ROOM_CACHE_MS = 3_000;

export interface Player {
  id: string;
  displayName: string | null;
  banned: boolean;
}

export interface ChatMessage {
  id: number;
  clientId: string;
  playerId: string;
  name: string | null;
  text: string;
  at: number;
}

/**
 * The parts of GET /v1/realtime/channels/:name (secret key) this file reads. The answer has more (join, allow, open, …).
 * muted[].until: ISO time, or null = until unmuted. Expired mutes are already left out by the channel.
 */
export interface ChatRoom {
  ownerId: string | null;
  send: 'anyone' | 'invited';
  speakers: string[];
  muted: Array<{ playerId: string; until: string | null }>;
  banned: string[];
  members: Array<{ id: string }>;
}

export interface ChatOptions {
  /** Checks the caller's `Authorization: Bearer <token>`; null = not signed in. */
  verify: (authorization: string | null) => Promise<Player | null>;
  /** Sends a message to the channel with your secret key. Needed only for channels with delivery: 'server'. */
  relay?: (channel: string, type: string, data: unknown) => Promise<unknown>;
  /**
   * May this player read this channel's history? Default: any signed-in player. For invite-only rooms, check the
   * channel's member / invite lists (GET /v1/realtime/channels/:name with your secret key) — see SKILL.md.
   */
  canRead?: (player: Player, channel: string) => Promise<boolean>;
  /**
   * Reads the channel with your secret key (GET /v1/realtime/channels/:name). Used before saving to check that the
   * sender may write there (`roomRefusal`). A thrown error with status 404 means "no such channel" (nobody is in it).
   */
  room?: (channel: string) => Promise<ChatRoom | null>;
  /**
   * Replaces the check above with your own: return true to allow, false or a short code (e.g. 'not_on_team') to refuse
   * with 403. One of `room` / `canPost` is required, so a new setup never saves without asking the channel first.
   * To turn the check off on purpose: canPost: async () => true (then a muted or banned player can still post here).
   */
  canPost?: (player: Player, channel: string, rule: ChatRule) => Promise<boolean | string>;
  /** Extra response headers (CORS). */
  headers?: Record<string, string>;
  /** Clock (tests). */
  now?: () => number;
}

// ---------------------------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------------------------

/** The rule for a channel name, or null when the channel is not saved. */
export function ruleFor(channel: string): ChatRule | null {
  if (Object.hasOwn(CHANNELS, channel) && !channel.endsWith('*')) return CHANNELS[channel]!;
  let best: string | null = null;
  for (const key of Object.keys(CHANNELS)) {
    if (!key.endsWith('*')) continue;
    const prefix = key.slice(0, -1);
    if (channel.startsWith(prefix) && (best === null || prefix.length > best.length - 1)) best = key;
  }
  return best === null ? null : CHANNELS[best]!;
}

/**
 * Tidies a message: trims, removes control characters (they can break how a line looks), turns runs of spaces and
 * new lines into one space. Returns '' for a message with nothing left.
 */
export function cleanText(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Why this player may not write in this channel right now, or null when they may. The same rules the channel itself
 * applies to live messages, so the history and the 'server' relay never carry what the channel would refuse:
 *   not_in_channel — not in it (or the channel does not exist); channel_banned — banned there; muted — muted there;
 *   send_forbidden — the channel lets only invited players send (send: 'invited') and this player is not one of them.
 * WHY the same check for 'direct' channels too: there the channel stops the live message, but the game saves first,
 * so without this a muted player (or a non-speaker in an announcement channel) could still put lines in the history
 * that everyone sees on the next load.
 */
export function roomRefusal(room: ChatRoom | null, playerId: string, now: number): string | null {
  if (!room) return 'not_in_channel';
  if (room.banned.includes(playerId)) return 'channel_banned';
  if (!room.members.some((m) => m.id === playerId)) return 'not_in_channel';
  const mute = room.muted.find((m) => m.playerId === playerId);
  if (mute && (mute.until === null || Date.parse(mute.until) > now)) return 'muted';
  if (room.send === 'invited' && playerId !== room.ownerId && !room.speakers.includes(playerId)) return 'send_forbidden';
  return null;
}

/** Finds blocked words (without case). Returns the masked text, and whether anything matched. */
export function applyBlockedWords(text: string, words: string[]): { text: string; blocked: boolean } {
  let out = text;
  let blocked = false;
  for (const w of words) {
    const word = w.trim();
    if (!word) continue;
    const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    out = out.replace(re, (m) => {
      blocked = true;
      return '*'.repeat([...m].length);
    });
  }
  return { text: out, blocked };
}

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

/** Handles /chat/* and returns a Response; returns null for any other path (so your own routes keep working). */
export async function handleChat(request: Request, db: D1Database, opts: ChatOptions): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/chat/')) return null;
  const headers = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  const now = opts.now ?? Date.now;
  try {
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /chat/history') return reply(await history(db, url, await signedIn(request, opts), opts));
    if (route === 'POST /chat/messages') {
      const player = await signedIn(request, opts);
      const body = (await request.json().catch(() => null)) as unknown;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'json_body_required');
      return reply(await post(db, body as Record<string, unknown>, player, now(), opts), 201);
    }
    return reply({ error: 'not_found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.code }, e.status);
    throw e;
  }
}

async function signedIn(request: Request, opts: ChatOptions): Promise<Player> {
  const player = await opts.verify(request.headers.get('authorization'));
  if (!player) throw new HttpError(401, 'sign_in_required');
  if (player.banned) throw new HttpError(403, 'banned');
  return player;
}

function channelOf(raw: unknown): { channel: string; rule: ChatRule } {
  if (typeof raw !== 'string' || !CHANNEL_NAME.test(raw)) throw new HttpError(400, 'bad_channel');
  const rule = ruleFor(raw);
  if (!rule) throw new HttpError(400, 'unknown_channel');
  return { channel: raw, rule };
}

type Row = { id: number; client_id: string; player_id: string; display_name: string | null; body: string; created_at: number };
const toMessage = (r: Row): ChatMessage => ({ id: r.id, clientId: r.client_id, playerId: r.player_id, name: r.display_name, text: r.body, at: r.created_at });

async function history(db: D1Database, url: URL, player: Player, opts: ChatOptions) {
  const { channel, rule } = channelOf(url.searchParams.get('channel') ?? undefined);
  if (opts.canRead && !(await opts.canRead(player, channel))) throw new HttpError(403, 'not_allowed');
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 1), MAX_LIMIT);
  const beforeRaw = url.searchParams.get('before');
  const before = beforeRaw === null ? Number.MAX_SAFE_INTEGER : Number.parseInt(beforeRaw, 10);
  if (!Number.isSafeInteger(before) || before < 1) throw new HttpError(400, 'bad_before');
  const { results } = await db
    .prepare(
      `SELECT id, client_id, player_id, display_name, body, created_at FROM chat_messages
       WHERE channel = ? AND type = ? AND id < ? ORDER BY id DESC LIMIT ?`
    )
    .bind(channel, MESSAGE_TYPE, before, limit)
    .all<Row>();
  // Newest first from the database (so `limit` keeps the latest), oldest first in the answer (the order to show them).
  return { channel, delivery: rule.delivery, maxLength: rule.maxLength, messages: results.reverse().map(toMessage) };
}

// channel → the last answer from `room` (see ROOM_CACHE_MS). Lives as long as this running copy of the server.
const rooms = new Map<string, { at: number; room: ChatRoom | null }>();

async function fetchRoom(channel: string, at: number, opts: ChatOptions): Promise<ChatRoom | null> {
  let room: ChatRoom | null;
  try {
    room = await opts.room!(channel);
  } catch (e) {
    if ((e as { status?: unknown } | null)?.status !== 404) throw new HttpError(503, 'room_check_failed'); // unknown → refuse, never let it through
    room = null;
  }
  if (rooms.size > 1_000) rooms.clear();
  rooms.set(channel, { at, room });
  return room;
}

async function checkCanPost(player: Player, channel: string, rule: ChatRule, at: number, opts: ChatOptions): Promise<void> {
  if (opts.canPost) {
    const ok = await opts.canPost(player, channel, rule);
    if (ok !== true) throw new HttpError(403, typeof ok === 'string' && ok ? ok : 'not_allowed');
    return;
  }
  const hit = rooms.get(channel);
  const fresh = hit && at - hit.at >= 0 && at - hit.at < ROOM_CACHE_MS;
  let refusal = roomRefusal(fresh ? hit.room : await fetchRoom(channel, at, opts), player.id, at);
  // Someone who joined just after the cached answer looks "not in the channel": ask again, but at most once a second
  // per channel, so refused posts (e.g. from a player who is not in the room) cannot use up the key's calls.
  if (refusal === 'not_in_channel' && fresh && at - hit.at >= 1_000) refusal = roomRefusal(await fetchRoom(channel, at, opts), player.id, at);
  if (refusal) throw new HttpError(403, refusal);
}

async function post(db: D1Database, body: Record<string, unknown>, player: Player, at: number, opts: ChatOptions) {
  const { channel, rule } = channelOf(body.channel);
  if (rule.delivery === 'server' && !opts.relay) throw new HttpError(500, 'relay_not_configured');
  if (!opts.room && !opts.canPost) throw new HttpError(500, 'room_check_not_configured');
  if (typeof body.clientId !== 'string' || !CLIENT_ID.test(body.clientId)) throw new HttpError(400, 'bad_client_id');
  const clientId = body.clientId;
  if (typeof body.text !== 'string') throw new HttpError(400, 'text_required');
  let text = cleanText(body.text);
  if (!text) throw new HttpError(400, 'text_required');
  if ([...text].length > rule.maxLength) throw new HttpError(400, 'too_long');
  const words = applyBlockedWords(text, rule.blockedWords);
  if (words.blocked && rule.onBlocked === 'reject') throw new HttpError(400, 'blocked_word');
  text = words.text;

  // The same message sent again (a retry after a lost answer) returns the saved one instead of a second copy.
  const existing = await db
    .prepare('SELECT id, client_id, player_id, display_name, body, created_at FROM chat_messages WHERE player_id = ? AND client_id = ?')
    .bind(player.id, clientId)
    .first<Row>();
  if (existing) return { channel, delivery: rule.delivery, message: toMessage(existing) };

  if (rule.maxPerMinute !== null) {
    const recent =
      (await db.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE player_id = ? AND channel = ? AND created_at > ?').bind(player.id, channel, at - 60_000).first<number>('n')) ?? 0;
    if (recent >= rule.maxPerMinute) throw new HttpError(429, 'too_many_messages');
  }

  // After the cheap checks (text, retry, rate: all in this file or the database) and before saving: may this player
  // write in this channel? (SEC-VOICE-03: without this, a player muted or banned in the channel — or not in it at all —
  // could post through this endpoint, and 'server' channels would relay it to everyone with your secret key.)
  await checkCanPost(player, channel, rule, at, opts);

  const row = await db
    .prepare(
      `INSERT INTO chat_messages (channel, type, player_id, display_name, body, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (player_id, client_id) DO NOTHING
       RETURNING id, client_id, player_id, display_name, body, created_at`
    )
    .bind(channel, MESSAGE_TYPE, player.id, player.displayName, text, clientId, at)
    .first<Row>();
  // Two identical requests at the same moment: the second one finds the row the first one wrote.
  const saved = row ?? (await db.prepare('SELECT id, client_id, player_id, display_name, body, created_at FROM chat_messages WHERE player_id = ? AND client_id = ?').bind(player.id, clientId).first<Row>());
  if (!saved) throw new HttpError(500, 'not_saved');
  const message = toMessage(saved);

  if (rule.delivery === 'server' && row) {
    try {
      await opts.relay!(channel, MESSAGE_TYPE, message);
    } catch {
      // Not delivered → not kept either, so the history never shows a message nobody saw. The game may send it again.
      await db.prepare('DELETE FROM chat_messages WHERE id = ?').bind(saved.id).run();
      throw new HttpError(502, 'delivery_failed');
    }
  }
  return { channel, delivery: rule.delivery, message };
}

// ---------------------------------------------------------------------------------------------------------------
// Scheduled clean-up (call from scheduled())
// ---------------------------------------------------------------------------------------------------------------

export async function cleanupChat(db: D1Database, at: number = Date.now()): Promise<void> {
  await db.prepare('DELETE FROM chat_messages WHERE created_at < ?').bind(at - KEEP_DAYS * 86_400_000).run();
}
