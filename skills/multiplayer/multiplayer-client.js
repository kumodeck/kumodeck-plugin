/**
 * Game-side helper for online play with KUMODeck rooms (kumo.rooms). Copy to public/multiplayer-client.js
 * (the game's deployed folder). No dependencies; no server code: rooms run on KUMODeck once `multiplayer` is on.
 *
 *   import { playOnline, resumeAfterReload, warmUpOnline } from './multiplayer-client.js';
 *   // page load, before showing the menu: back in the match after a reload of THIS tab (host or guest), else null
 *   const back = await resumeAfterReload({ kumo, mode: 'duel', ...sameCallbacksAsBelow });
 *   warmUpOnline(kumo);                     // optional, when the online button appears: connect before it is pressed
 *   const online = await playOnline({
 *     kumo,                                   // from connectKumo() in kumo-boot.js (null offline)
 *     mode: 'duel',                           // multiplayer.modes[].key in kumo.config.json
 *     // code: 'K7QM3X',                      // join a friend's room by its 6-letter code
 *     // hostPrivate: true,                   // or make a private room and show online.code to a friend
 *     // roomOptions: { hostOnlyState: true }, // with hostPrivate: only the host may write shared state
 *     onMessage: ({ from, type, data }) => …, // what other players sent with online.send()
 *     onPlayers: (players) => …,              // [{ id, displayName, connected, state }] — after every change
 *     onState: (state) => …,                  // shared room state (online.setState), same order for everyone
 *     onStatus: (status) => …,                // 'matching' | 'playing' | 'reconnecting' | 'ended:<reason>'
 *     onPresence: ({ playerId, kind, reason }) => … // someone dropped / came back / left: show it at once (below)
 *   });
 *   online.send('move', { x, y });            // to everyone else (≤ 16 KB, ≤ 30 messages a second)
 *   if (online.isHost) await online.start();  // host only: lock the room so quick match stops adding players
 *   await online.leave();
 *
 * Waiting for a quick match can take up to the mode's fillTimeoutSeconds: show a "Cancel" button that calls
 * kumo.rooms.cancelMatch() (the pending playOnline() then rejects with code 'match_cancelled').
 *
 * What this does for you (the WHY of each step is next to it):
 *   - after a page reload, resumeAfterReload() goes back to the seat (same tab, same player, while the seat is kept:
 *     about 10 s after the tab closed, 20 s after a dropped connection). A guest who came by invite link gets back too
 *   - onPresence tells you at once when another player drops: kind 'disconnected' with reason 'closed' (they closed or
 *     reloaded the tab — back within ~10 s or gone) or 'lost' (connection dropped / went silent), then 'reconnected' or
 *     'left'. Show "Waiting for <name>…" right away instead of a frozen screen
 *   - reports reconnects (the SDK reconnects by itself; the server keeps the seat for 20 s) and re-reads the
 *     room from the snapshot when it is back (messages sent while you were away are not replayed)
 *   - drops nothing silently: rate / size warnings from the server reach onWarning
 * Never let online play block the game: wrap playOnline() in try/catch and keep a single-player path.
 */

/**
 * Optional: call when the online button appears (title or menu screen), not on page load of a single-player game.
 * It loads the rooms code, opens the connection and signs in while the player is still reading the menu, so pressing
 * the button only waits for the room itself. Never throws; playOnline() works the same with or without it.
 *   showMenu(); warmUpOnline(kumo);
 */
export function warmUpOnline(kumo) {
  if (!kumo) return;
  // kumo.rooms.warmUp() loads the rooms code, opens the connection and signs in; it never throws. playOnline() reuses the connection.
  // An older SDK without warmUp(): fetchHeldRoom() opens the same connection
  if (typeof kumo.rooms.warmUp === 'function') void kumo.rooms.warmUp();
  else kumo.rooms.fetchHeldRoom().catch(() => null);
}

/**
 * Page load: if THIS tab was in a match of `mode` and the server still keeps the seat, go back to it (host or guest alike)
 * and return the same object as playOnline(); otherwise null. Never throws. Call it before showing the menu:
 *   const online = await resumeAfterReload({ kumo, mode: 'duel', onMessage, onPlayers, onState, onStatus, onPresence });
 *   if (online) continueMatch(online); else showMenu();
 * WHY only this tab: the same player in a second tab must not take over the first tab's match (one connection per player).
 * After it returns, redraw from online.state: messages sent while you were away are not replayed.
 */
export async function resumeAfterReload({ kumo, mode, ...callbacks }) {
  if (!kumo || typeof kumo.rooms.rejoinIfReloaded !== 'function') return null; // offline / an older SDK
  const room = await kumo.rooms.rejoinIfReloaded().catch(() => null);
  if (!room) return null;
  if (room.mode !== mode) {
    await room.leave().catch(() => undefined); // a different game mode of this site: do not keep the seat
    return null;
  }
  return wire(kumo, room, callbacks);
}

export async function playOnline({ kumo, mode, code, hostPrivate = false, roomOptions = {}, ...callbacks }) {
  if (!kumo) throw Object.assign(new Error('Online play needs a connection (kumo is null)'), { code: 'offline' });
  callbacks.onStatus?.('matching');

  // 1. A seat kept from before a page reload? Go back to it when it is the same game we are asked for.
  //    WHY not always: create / join / quickMatch release the old seat by themselves (the others see a normal leave),
  //    so asking for a different room is enough to drop it.
  let room = null;
  const held = await kumo.rooms.fetchHeldRoom().catch(() => null);
  if (held && held.mode === mode && (!code || held.code === code.trim().toUpperCase())) {
    room = await kumo.rooms.rejoin().catch(() => null); // seat_expired / no_held_room → start fresh below
  }

  // 2. Otherwise: a friend's code, a private room to share, or quick match (waits until minPlayers are in).
  if (!room) {
    if (code) room = await kumo.rooms.join(code);
    else if (hostPrivate) room = await kumo.rooms.create(mode, { ...roomOptions, private: true });
    else room = await kumo.rooms.quickMatch(mode);
  }

  return wire(kumo, room, callbacks);
}

// 3. Wire the events. room.players / room.state are always the server's latest copy.
function wire(kumo, room, { onMessage, onPlayers, onState, onStatus, onWarning, onPresence }) {
  const status = (s) => onStatus?.(s);
  const players = () => onPlayers?.(room.players);
  const offs = [
    room.on('message', (m) => onMessage?.(m)),
    room.on('playerJoined', players),
    room.on('playerLeft', (e) => { players(); onPresence?.({ playerId: e.playerId, kind: 'left', reason: e.reason }); }),
    // Seat kept while they reconnect (connected: false). Arrives at once when their tab closes (reason 'closed') or
    // when their connection drops / goes silent (reason 'lost'): do not wait for playerLeft to tell the player
    room.on('playerDisconnected', (e) => { players(); onPresence?.({ playerId: e.playerId, kind: 'disconnected', reason: e.reason ?? 'lost' }); }),
    room.on('playerReconnected', (e) => { players(); onPresence?.({ playerId: e.playerId, kind: 'reconnected' }); }),
    room.on('playerStateChanged', players),
    room.on('hostChanged', players),
    room.on('stateChanged', ({ state }) => onState?.(state)),
    room.on('reconnecting', () => status('reconnecting')),
    // Back in the same seat: players and state were replaced from a snapshot, so redraw everything from them
    room.on('resumed', () => { status('playing'); players(); onState?.(room.state); }),
    room.on('closed', ({ reason }) => { offs.forEach((off) => off()); status(`ended:${reason}`); }),
    kumo.rooms.on('warning', (w) => onWarning?.(w)) // rate_limited / payload_too_large: the message was dropped
  ];

  status('playing');
  players();
  onState?.(room.state);

  return {
    room,
    get code() { return room.code; },         // 6 letters: show it, or put it in an invite link (?join=CODE)
    get myId() { return room.myId; },
    get isHost() { return room.isHost; },
    get players() { return room.players; },
    get state() { return room.state; },
    send: (type, data, opts) => room.send(type, data, opts),     // opts.to = [playerId] for one player
    setState: (patch) => room.setState(patch),                   // shared, ≤ 64 KB in total, null deletes a key
    setMyState: (patch) => room.setMyState(patch),               // mine, ≤ 8 KB (name, color, ready…)
    start: () => room.lock(true),                                // host only (host_only otherwise)
    leave: () => room.leave()
  };
}
