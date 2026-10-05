/**
 * kumo-boot.js — connect a game to the backend without ever blocking play.
 *
 * Every template ships its own copy of this file (instead of importing a shared one) so that a template folder
 * can be copied anywhere — `kumodeck create --template <name>` will just copy the folder.
 *
 * Where is the backend, and which game are we? Resolved at runtime, first hit wins:
 *   1. query string   ?api=http://localhost:4000&key=pk_dev_…   (handy for a shared test link)
 *   2. window.KUMO_CONFIG from ./kumo-config.js                  (public values only: API URL + publishable key(s);
 *                                                                 `kumodeck init` writes it — see pageEnvironment() below)
 *   3. apiUrl = location.origin                                  (correct when the backend's path hosting serves
 *                                                                 the game: <api>/play/<slug>--dev/)
 * Inside your own iOS / Android app (e.g. a Capacitor shell you build yourself), set window.KUMO_APP (API URL, release key,
 * sign-in callback). It wins over kumo-config.js because location.origin there is capacitor://localhost, not your API.
 * In the app the SDK keeps tokens in the Keychain / Keystore, so no storage override is passed (see connectKumo).
 *
 * The publishable key (pk_…) is public by design: it can only do what a player can do.
 * NEVER put a secret key (sk_…) in a game — the SDK refuses it.
 *
 * ?player=2 (any label) gives this tab its own storage namespace = a different guest. WHY: two tabs on one origin
 * share localStorage, so the second tab would resume the first tab's session and the realtime server would
 * replace the first tab's socket ("same player, newer connection"). Use it to test multiplayer on one machine.
 */

/** Service name for the developer console only (console.warn below; players never see it). KUMODeck since 2026-09-28 — rename it here only. */
export const BACKEND_NAME = 'KUMODeck';

const params = new URLSearchParams(location.search);
const local = window.KUMO_CONFIG || {};
const app = window.KUMO_APP || null;
/** Running inside the Capacitor app (not a browser)? */
export const isNativeApp = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/**
 * Which environment is this page? Used to pick projectKeys.development / projectKeys.production from kumo-config.js.
 * WHY by URL: KUMODeck serves the development copy at <slug>--dev (path /play/<slug>--dev/ or host <slug>--dev.<domain>),
 * and a project slug can never contain "--" (server rule), so "--dev" is an exact marker. A /play/<slug>/ path without it
 * is the production copy (also on a local server). Anything else on localhost / a file:// page is you testing = development.
 * Any other URL (your production domain, your own server) = production.
 * Before 2026-09-27 kumo-config.js held a single projectKey that you pasted by hand; that still works (see below).
 */
export function pageEnvironment(loc = location) {
  const firstLabel = loc.hostname.split('.')[0] || '';
  const playSlug = (loc.pathname.match(/^\/play\/([^/]+)\//) || [])[1] || '';
  if (firstLabel.endsWith('--dev') || playSlug.endsWith('--dev')) return 'development';
  if (playSlug) return 'production';
  const h = loc.hostname;
  const local = loc.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  return local ? 'development' : 'production';
}

const localKeys = local.projectKeys || {};

export const kumoConfig = {
  apiUrl: String(params.get('api') || (app && app.apiUrl) || local.apiUrl || location.origin).replace(/\/+$/, ''),
  // ?key= > the app shell > projectKeys[this page's environment] (written by `kumodeck init`) > a single projectKey (older setup)
  projectKey: params.get('key') || (app && app.projectKey) || localKeys[pageEnvironment()] || local.projectKey || '',
  playerSlot: (params.get('player') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16),
  offline: params.get('offline') === '1'
};

/** localStorage with a per-game (and per ?player=) prefix. Falls back to memory in private mode. */
export function slotStorage(namespace) {
  const prefix = `${namespace}:${kumoConfig.playerSlot ? `${kumoConfig.playerSlot}:` : ''}`;
  let ls = null;
  try {
    ls = window.localStorage;
    ls.setItem('__probe', '1');
    ls.removeItem('__probe');
  } catch {
    ls = null; // blocked storage → memory only (a fresh guest on every reload)
  }
  const mem = new Map();
  return {
    getItem: (k) => (ls ? ls.getItem(prefix + k) : mem.get(prefix + k) ?? null),
    setItem: (k, v) => (ls ? ls.setItem(prefix + k, v) : void mem.set(prefix + k, v)),
    removeItem: (k) => (ls ? ls.removeItem(prefix + k) : void mem.delete(prefix + k))
  };
}

/** Load <api>/sdk.js. The URL depends on config, so it cannot be a static <script> tag. */
function loadSdk(apiUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (window.Kumo) return resolve(window.Kumo);
    const s = document.createElement('script');
    s.src = `${apiUrl}/sdk.js`;
    s.async = true;
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${s.src}`)), timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      window.Kumo ? resolve(window.Kumo) : reject(new Error('SDK loaded but window.Kumo is missing'));
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Could not load ${s.src}`));
    };
    document.head.appendChild(s);
  });
}

/**
 * Connect and sign in (a guest is created automatically on first visit, resumed afterwards).
 * Never throws: returns { kumo: null, reason } when the backend is unreachable or not configured,
 * so the game can still be played offline. A game that refuses to start without a server is a broken game.
 */
export async function connectKumo({ namespace, timeoutMs = 6000 } = {}) {
  if (kumoConfig.offline) return { kumo: null, reason: 'Offline mode (?offline=1)' };
  if (!kumoConfig.projectKey || kumoConfig.projectKey.includes('REPLACE_ME')) {
    return { kumo: null, reason: `No ${pageEnvironment()} publishable key yet — run \`kumodeck init\` in the game folder (see README)` };
  }
  try {
    const Kumo = await loadSdk(kumoConfig.apiUrl, timeoutMs);
    const kumo = await Kumo.init({
      projectKey: kumoConfig.projectKey,
      apiUrl: kumoConfig.apiUrl,
      // Web: per-game (and per-?player=) localStorage. App: let the SDK use the Keychain / Keystore + native sign-in settings
      ...(isNativeApp ? { native: (app && app.native) || {} } : { storage: slotStorage(namespace) })
    });
    return { kumo, reason: null };
  } catch (e) {
    console.warn(`[${BACKEND_NAME}] offline:`, e);
    return { kumo: null, reason: e?.message || String(e) };
  }
}

/** Titles in kumo.config.json may be a string or { en, ja, … }. Pick the page language (<html lang>) so titles match the UI. */
export function pickText(t, lang = document.documentElement.lang || navigator.language || 'en') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const base = lang.toLowerCase().split('-')[0];
  return t[lang] || t[base] || t.en || Object.values(t)[0] || '';
}

/** "Pilot 7F3A" style default name for new guests (the id suffix keeps it stable per player). */
export function defaultName(player, prefix = 'Player') {
  return player?.displayName || `${prefix} ${String(player?.id || '').slice(-4).toUpperCase()}`;
}

/**
 * Render a ranked list ({ entries: [{ rank, playerId, displayName, value }], me }) into an <ol> — for example the
 * response of your own leaderboard Function (the leaderboard Skill in .claude/skills/leaderboard/ builds one on your
 * database). Adds your own row after a "…" gap when you are outside the listed entries — WHY: "you are #184" motivates
 * more than a top 10 you are not in.
 */
export function renderLeaderboard(ol, lb, { format = (v) => String(v), emptyText = 'No scores yet — be the first!' } = {}) {
  ol.replaceChildren();
  const row = (e, isMe) => {
    const li = document.createElement('li');
    if (isMe) li.className = 'me';
    const rank = Object.assign(document.createElement('span'), { className: 'rank', textContent: `#${e.rank}` });
    const name = Object.assign(document.createElement('span'), { className: 'name', textContent: e.displayName || 'Guest' });
    const val = Object.assign(document.createElement('span'), { className: 'val', textContent: format(e.value) });
    li.append(rank, name, val);
    return li;
  };
  if (!lb || lb.entries.length === 0) {
    const li = document.createElement('li');
    li.append(Object.assign(document.createElement('span'), { className: 'empty', textContent: emptyText }));
    ol.append(li);
    return;
  }
  const meId = lb.me?.playerId;
  for (const e of lb.entries) ol.append(row(e, e.playerId === meId));
  if (lb.me && !lb.entries.some((e) => e.playerId === meId)) {
    ol.append(Object.assign(document.createElement('li'), { className: 'gap', textContent: '…' }));
    ol.append(row(lb.me, true));
  }
}

/** Short, non-blocking toast. Queued so two unlocks in a row are both readable. */
const toastQueue = [];
let toastBusy = false;
export function toast(el, text, ms = 2600) {
  toastQueue.push(text);
  if (toastBusy) return;
  const next = () => {
    const t = toastQueue.shift();
    if (t === undefined) {
      toastBusy = false;
      el.hidden = true;
      return;
    }
    toastBusy = true;
    el.textContent = t;
    el.hidden = false;
    // restart the CSS animation for back-to-back toasts
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(next, ms);
  };
  next();
}
