/**
 * do-room.ts — a match room that checks every move on the server (a Durable Object). From the `functions-d1` Skill.
 * Copy to `functions/src/do-room.ts` next to the starter's `kumo.ts`. The example game is tic-tac-toe for 2 players:
 * replace `newGame` / `checkMove` with the game's own rules and keep the rest.
 *
 *   page → wss://<functions URL>/rooms/<room>/ws?access_token=<token>
 *        → roomRoute (Worker): verifies the user → ROOMS.idFromName(<room>) → MatchRoom (one object per room name)
 *        ← { type: 'state', game } after every accepted move, to everyone in the room
 *        ← { type: 'error', code } to the sender only, when a move is refused
 *
 * Why it is built this way:
 *   - The user is verified ONCE, in the Worker (players.verify), and the object gets the id in X-Kumo-Player, a header
 *     the Worker sets itself after dropping any incoming one. The object never reads a user id from a message: anything
 *     the browser sends can be changed by the person using it.
 *   - Browsers cannot set Authorization on a WebSocket, so the token comes as ?access_token= (over wss only). Do not
 *     log request URLs.
 *   - Hibernation calls (ctx.acceptWebSocket + webSocketMessage): the object sleeps between moves and costs no running
 *     time then. ws.accept() would keep it awake (and billed) for as long as anyone is connected.
 *   - The game is saved in the object's own SQLite (ctx.storage.sql) after each accepted move: the object can restart at
 *     any moment and memory is lost then. One row per room, written once per move = the cheapest storage pattern.
 *   - A socket that sends more than MAX_PER_SECOND messages is closed: messages are billed (20 = 1 request), so a
 *     flooding client must not grow the creator's bill.
 */

import { DurableObject } from 'cloudflare:workers';
import { Kumo, type KumoEnv } from './kumo';

export interface RoomEnv extends KumoEnv {
  ROOMS: DurableObjectNamespace<MatchRoom>;
}

const PLAYER_HEADER = 'x-kumo-player';
/** Room names come from the URL: keep them short and plain so one user cannot create endless odd names. */
const ROOM_NAME = /^[A-Za-z0-9_-]{1,64}$/;
/** Messages per second per socket before it is closed (a person plays far slower; raise it for a real-time game). */
const MAX_PER_SECOND = 20;
/** Biggest message accepted (bytes). A move is tiny; Cloudflare's own limit is 32 MiB. */
const MAX_MESSAGE_BYTES = 1024;

// ---- The game's rules: replace these two for another game ----

type Mark = 'X' | 'O';
interface Game {
  players: string[]; // verified user ids, in join order: [X, O]
  board: (Mark | null)[]; // 9 cells
  turn: Mark;
  winner: Mark | 'draw' | null;
}

function newGame(): Game {
  return { players: [], board: Array(9).fill(null), turn: 'X', winner: null };
}

/** Returns the error code, or null when the move is allowed. The ONLY place that decides what a move may do. */
function checkMove(game: Game, playerId: string, cell: unknown): string | null {
  const mark: Mark | undefined = game.players[0] === playerId ? 'X' : game.players[1] === playerId ? 'O' : undefined;
  if (!mark) return 'not_in_match';
  if (game.players.length < 2) return 'waiting_for_player';
  if (game.winner) return 'match_over';
  if (mark !== game.turn) return 'not_your_turn';
  if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) return 'bad_move';
  if (game.board[cell]) return 'cell_taken';
  return null;
}

function applyMove(game: Game, cell: number): void {
  game.board[cell] = game.turn;
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const won = lines.some(([a, b, c]) => game.board[a!] && game.board[a!] === game.board[b!] && game.board[a!] === game.board[c!]);
  game.winner = won ? game.turn : game.board.every(Boolean) ? 'draw' : null;
  game.turn = game.turn === 'X' ? 'O' : 'X';
}

// ---- The Worker side: verify, then hand the socket to the room ----

/** In fetch(), before the final 404: `const room = await roomRoute(request, this.env); if (room) return room;` */
export async function roomRoute(request: Request, env: RoomEnv): Promise<Response | null> {
  const m = /^\/rooms\/([^/]+)\/ws$/.exec(new URL(request.url).pathname);
  if (!m) return null;
  const name = decodeURIComponent(m[1]!);
  if (!ROOM_NAME.test(name)) return Response.json({ error: 'bad_room' }, { status: 400 });
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return Response.json({ error: 'websocket_only' }, { status: 426 });
  const token = new URL(request.url).searchParams.get('access_token');
  const user = token ? await new Kumo(env).players.verify(`Bearer ${token}`) : null;
  if (!user) return Response.json({ error: 'sign_in_required' }, { status: 401 });
  if (user.banned) return Response.json({ error: 'banned' }, { status: 403 });
  const headers = new Headers(request.headers);
  headers.delete(PLAYER_HEADER); // only this Worker may set it
  headers.set(PLAYER_HEADER, user.id);
  return env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(new Request(request, { headers }));
}

// ---- The room: one object per room name ----

interface SocketInfo {
  playerId: string;
  windowStart: number;
  count: number;
}

export class MatchRoom extends DurableObject<RoomEnv> {
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS game (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)');
  }

  private load(): Game {
    const row = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM game WHERE id = 1').toArray()[0];
    return row ? (JSON.parse(row.json) as Game) : newGame();
  }

  private save(game: Game): void {
    this.ctx.storage.sql.exec('INSERT INTO game (id, json) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET json = excluded.json', JSON.stringify(game));
  }

  private broadcast(game: Game): void {
    const text = JSON.stringify({ type: 'state', game });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // a socket closing right now: its webSocketClose will run
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const playerId = request.headers.get(PLAYER_HEADER);
    if (!playerId) return Response.json({ error: 'sign_in_required' }, { status: 401 });
    const game = this.load();
    if (!game.players.includes(playerId)) {
      if (game.players.length >= 2) return Response.json({ error: 'room_full' }, { status: 409 });
      game.players.push(playerId);
      this.save(game);
    }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [playerId]);
    server.serializeAttachment({ playerId, windowStart: Date.now(), count: 0 } satisfies SocketInfo);
    this.broadcast(game); // the new socket is already in getWebSockets()
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const info = ws.deserializeAttachment() as SocketInfo;
    const now = Date.now();
    if (now - info.windowStart >= 1000) {
      info.windowStart = now;
      info.count = 0;
    }
    info.count += 1;
    ws.serializeAttachment(info);
    if (info.count > MAX_PER_SECOND) return ws.close(1008, 'too_many_messages');
    const size = typeof message === 'string' ? message.length * 3 : message.byteLength; // ×3: worst case UTF-8
    if (size > MAX_MESSAGE_BYTES) return ws.send(JSON.stringify({ type: 'error', code: 'message_too_large' }));

    let msg: { type?: unknown; cell?: unknown };
    try {
      msg = typeof message === 'string' ? JSON.parse(message) : {};
    } catch {
      return ws.send(JSON.stringify({ type: 'error', code: 'bad_json' }));
    }
    if (msg.type !== 'move') return ws.send(JSON.stringify({ type: 'error', code: 'unknown_type' }));

    const game = this.load();
    const refused = checkMove(game, info.playerId, msg.cell);
    if (refused) return ws.send(JSON.stringify({ type: 'error', code: refused }));
    applyMove(game, msg.cell as number);
    this.save(game);
    this.broadcast(game);
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // The seat is kept: the same user can reconnect and continue. Clear the room when the match is over and nobody is left
    // (the stored row is the only thing billed while the room sleeps).
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      // already closed
    }
    const open = this.ctx.getWebSockets().filter((s) => s !== ws);
    if (open.length === 0 && this.load().winner) this.ctx.storage.sql.exec('DELETE FROM game');
  }
}
