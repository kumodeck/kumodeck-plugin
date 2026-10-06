/**
 * Game-side chat: a realtime channel (kumo.realtime) for live messages + your Functions (chat.ts) for checks and history.
 * Copy it next to the game code that imports it (public/ without a build step, src/ with one such as Vite).
 * No dependencies.
 *
 *   import { openChat } from './chat-client.js';
 *   const chat = await openChat({
 *     url: FUNCTIONS_URL, kumo, channel: 'lobby',
 *     onMessage: (m) => addLine(m.name, m.text, m.mine)     // { id, clientId, playerId, name, text, at, mine }
 *   });                                                     // the saved history arrives first, oldest first, then live messages
 *   await chat.send('hello');                               // throws with err.code: too_long, blocked_word, too_many_messages, muted, …
 *   const older = await chat.more();                        // the page before the oldest message shown (oldest first)
 *   chat.channel;                                           // the kumo.realtime Channel (members, and kick / mute / ban for the owner)
 *   await chat.leave();
 *
 * Show `name` and `text` as text (textContent), never as HTML: anyone can type anything.
 */

export async function openChat({ url, kumo, channel, onMessage, historyLimit = 50 }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) throw new Error('openChat: pass the Functions URL (see `kumodeck functions status`)');
  if (typeof onMessage !== 'function') throw new Error('openChat: pass onMessage(message)');

  async function call(method, path, body) {
    const headers = { authorization: `Bearer ${await kumo.auth.getAccessToken()}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`chat ${method} ${path.split('?')[0]}: ${res.status} ${data.error || ''}`.trim());
      err.status = res.status;
      err.code = data.error;
      throw err;
    }
    return data;
  }

  // A name (string) joins that channel; a Channel from kumo.realtime.create() / join() is used as it is.
  const ch = typeof channel === 'string' ? await kumo.realtime.join(channel) : channel;
  const name = ch.name;
  const me = ch.myId;

  // Names of the people in the channel, so a live message can show who sent it (remembered after they leave).
  const names = new Map(ch.members.map((m) => [m.id, m.displayName]));
  ch.on('playerJoined', (p) => names.set(p.id, p.displayName));

  // Every message is shown once, even when it arrives both live and in the history (or twice after a retry).
  const seen = new Set();
  const show = (m) => {
    if (seen.has(m.clientId)) return;
    seen.add(m.clientId);
    onMessage({ ...m, mine: m.playerId === me });
  };

  let settings = { delivery: 'direct', maxLength: 200 };
  // A live message → the shape of a saved one, or null when it is not a chat message this game should show.
  const fromLive = ({ from, type, data, at }) => {
    if (type !== 'chat' || !data || typeof data !== 'object') return null;
    if (settings.delivery === 'server') {
      // Only messages your server checked and sent count; anything a player sent straight to the channel is ignored.
      if (from !== 'server' || typeof data.text !== 'string' || typeof data.playerId !== 'string' || typeof data.clientId !== 'string') return null;
      return { id: data.id ?? null, clientId: data.clientId, playerId: data.playerId, name: data.name ?? null, text: data.text, at: data.at ?? at };
    }
    // `from` is set by the realtime server, so the sender cannot pretend to be someone else.
    if (from === 'server' || typeof data.text !== 'string' || typeof data.clientId !== 'string') return null;
    return { id: null, clientId: data.clientId, playerId: from, name: names.get(from) ?? null, text: [...data.text].slice(0, settings.maxLength).join(''), at };
  };

  // Live messages that arrive while the history is loading wait here, so the order on screen stays right
  // (and so they are read with the channel's settings, which come with the history).
  let pending = [];
  const onLive = (event) => {
    if (pending) return void pending.push(event);
    const m = fromLive(event);
    if (m) show(m);
  };
  const stopLive = ch.on('message', onLive);

  let oldest = null;
  try {
    const first = await call('GET', `/chat/history?channel=${encodeURIComponent(name)}&limit=${historyLimit}`);
    settings = { delivery: first.delivery, maxLength: first.maxLength };
    for (const m of first.messages) show(m);
    oldest = first.messages[0]?.id ?? null;
  } catch (e) {
    // Without the history the settings are unknown: stop listening and leave the error to the game.
    stopLive();
    throw e;
  }
  const waiting = pending;
  pending = null;
  for (const event of waiting) onLive(event);

  const randomId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  return {
    channel: ch,
    get delivery() {
      return settings.delivery;
    },
    get maxLength() {
      return settings.maxLength;
    },
    /** Checks and saves the message on your server, then it reaches everyone in the channel. Resolves with the saved message. */
    async send(text) {
      // Muted or not allowed to speak in this channel (the owner or your server decided): stop before saving anything.
      if (!ch.canSend || (ch.mutedUntil !== null && ch.mutedUntil > Date.now())) {
        const err = new Error('chat send: you cannot send in this channel right now');
        err.code = ch.canSend ? 'muted' : 'send_forbidden';
        throw err;
      }
      const clientId = randomId();
      const { message } = await call('POST', '/chat/messages', { channel: name, text: String(text), clientId });
      // 'direct': this game sends the checked text (maybe with masked words) to the channel itself.
      if (settings.delivery === 'direct') await ch.send('chat', { clientId: message.clientId, text: message.text });
      show(message);
      return message;
    },
    /** Loads the page of history before the oldest message loaded so far (oldest first). Empty when there is no more. */
    async more(limit = historyLimit) {
      if (oldest === null) return [];
      const page = await call('GET', `/chat/history?channel=${encodeURIComponent(name)}&limit=${limit}&before=${oldest}`);
      const list = page.messages.filter((m) => !seen.has(m.clientId));
      for (const m of list) seen.add(m.clientId);
      oldest = page.messages[0]?.id ?? null;
      return list.map((m) => ({ ...m, mine: m.playerId === me }));
    },
    leave: () => {
      stopLive();
      return ch.leave();
    }
  };
}
