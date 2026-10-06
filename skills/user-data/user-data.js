/**
 * user-data.js — one piece of per-user data (a game's progress, an app's settings or draft, a profile) that follows the
 * user to every device and never blocks the page. From the `user-data` Skill. Copy it next to the page code that imports
 * it (`public/` without a build step, `src/` with one), then set the options; keep the behaviour described here. (KUMODeck's API calls users "players": `kumo.saves` stores per-user JSON "slots".)
 *
 *   import { createUserData } from './user-data.js';
 *   const data = createUserData({ kumo, slot: 'settings', initial: { theme: 'light', favorites: [] }, merge });
 *   let state = await data.load();                  // cloud copy, or this browser's copy, or `initial`
 *   data.update((s) => { s.favorites.push(id); });  // change it; the cloud write happens a moment later
 *   data.onLoad((s) => { state = s; render(); });   // another user signed in (their data), or signed out (`initial`)
 *   await data.flush();                             // before something that leaves the page (e.g. a sign-in redirect)
 *
 * What it does, and why:
 *   - Keeps the state in memory and a copy in this browser (localStorage), written on every change. A reload, a closed tab
 *     or a lost connection never loses changes; the next load sends what did not reach the cloud.
 *   - Writes to the cloud (`kumo.saves.set`) `delayMs` after the last change (default 2 s), one write at a time.
 *     WHY: pages change state often (every frame in a game, every keystroke in a form); the backend allows about 60 writes
 *     a minute per user (429 `rate_limited` above that), and every write is a billed request. One write per burst is enough.
 *   - Writes with `ifVersion: 'latest'`. If another device saved in between, the server answers 409 `version_conflict`
 *     instead of letting this device overwrite newer data. Then it reads the cloud copy and calls
 *     `merge(cloudData, localData)`, and writes the result (up to 3 tries).
 *   - The data belongs to the signed-in user. When a different user signs in on this page (a guest signs in to an
 *     existing account on a new device), it loads that user's data and calls `onLoad`. `onSignIn` decides what happens
 *     to what was done before signing in: 'keep-account' (default), 'keep-device', 'merge', or your own function.
 *     Linking an email / Google / … to the current guest keeps the same user, so nothing needs to happen then.
 *   - Signing out (`kumo.auth.signOut()`) puts `initial` back on screen (`onLoad` with reason 'signed-out') and forgets
 *     this browser's copy of the user who left, unless it still holds changes the cloud did not get.
 *     WHY: on a shared device (a family tablet, a school PC) the next person must not see the previous user's data.
 *     Until 2026-09-28 the old state stayed on screen and was silently no longer saved (found while testing with an AI agent).
 *     `onSignOut: 'keep'` restores that old behaviour (a page that reloads itself on sign-out does not need it).
 *   - The app already kept its data in the browser before (its own localStorage key, from before KUMODeck was added):
 *     `existing: () => oldDataOrNull` hands it over. The first load in this browser takes it, merges it with the cloud copy
 *     (`merge(cloud, old)`) when the account already has one, and sends it. It is taken once per browser (then the cloud
 *     copy is the one that counts) and only for the user signed in at that moment. The old key is never deleted.
 *     WHY (2026-10-06): most apps get cloud saves added after people already played them. Without this the page starts
 *     from `initial` and the progress looks lost; reading the old key in `initial` instead would ignore it whenever the
 *     account already has a cloud copy, and would hand it to every user who signs in on this browser.
 *   - Never throws from `update`; `load` and `flush` do not throw on connection or server errors either (the page keeps
 *     working on the local copy). Read `status` / `lastError`, or listen with `onStatus`.
 *
 * Status values: 'idle' (not loaded yet) · 'saving' · 'saved' · 'offline' (no connection, no user or the backend is
 * paused; kept locally and retried) · 'off' (cloud storage is turned off for this project or the user is banned; kept
 * locally only) · 'error' (this data cannot be saved as is — too large, bad slot name; see `lastError`).
 */

/** The server's rules for a slot key: lowercase snake_case, starts with a letter, at most 128 characters. */
const SLOT_KEY = /^[a-z][a-z0-9_]{0,127}$/;
/*
 * No size limit is written here. The SDK checks the size before sending and throws 413 `save_too_large` with
 * `details.limit` (bytes) and `details.size`; the server answers the same way. Read the number from there.
 * WHY not a constant here (2026-10-04): the limit is being raised (KUMODeck is removing the limits it sets itself).
 * A copy in every app would keep refusing data the server already accepts, so this file keeps no copy.
 */
/** Tries per write when another device keeps saving in between (409 `version_conflict`). */
const CONFLICT_TRIES = 3;

/** Errors that mean "this cannot be saved as it is": retrying the same data would fail the same way. */
const DATA_ERRORS = new Set(['save_too_large', 'invalid_request']);
/** Errors that mean "cloud storage is not available for this project / this user": keep the local copy, stop writing. */
const OFF_ERRORS = new Set(['feature_disabled', 'feature_unavailable', 'forbidden']);

function browserStorage() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem('__save_probe', '1');
    ls.removeItem('__save_probe');
    return ls;
  } catch {
    return null; // private mode / blocked storage: memory only
  }
}

const clone = (v) => (v === undefined ? v : typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/**
 * @param {object} opts
 * @param {object|null} opts.kumo       the SDK instance (null = offline: local copy only)
 * @param {string} [opts.slot]          slot key, default 'main'
 * @param {*|(() => *)} opts.initial    the state of a new user (a value or a function returning one)
 * @param {(cloud: *, local: *) => *} [opts.merge]  combine two versions (default: keep the local one)
 * @param {'keep-account'|'keep-device'|'merge'|((account: *|null, device: *) => *)} [opts.onSignIn]
 * @param {() => *} [opts.existing]  the app's data from before cloud saves (e.g. read its old localStorage key); null = none
 * @param {'reset'|'keep'} [opts.onSignOut]  after sign-out: 'reset' = show `initial` (default) / 'keep' = leave the state on screen
 * @param {number} [opts.delayMs]       wait after the last change before writing (default 2000)
 * @param {number} [opts.retryMs]       wait before retrying after a connection / rate-limit error (default 15000)
 * @param {{getItem(k:string):string|null,setItem(k:string,v:string):void,removeItem?(k:string):void}|null} [opts.storage]  default localStorage
 * @param {string} [opts.prefix]        prefix of the local copy's key (default 'userdata'); use one per project on a shared domain
 */
export function createUserData(opts) {
  const {
    kumo,
    slot = 'main',
    initial = {},
    merge = (_cloud, local) => local,
    onSignIn = 'keep-account',
    onSignOut = 'reset',
    existing = null,
    delayMs = 2000,
    retryMs = 15000,
    storage = browserStorage(),
    prefix = 'userdata'
  } = opts;
  if (!SLOT_KEY.test(slot)) throw new Error(`slot "${slot}": use lowercase letters, digits and _ (start with a letter, max 128)`);

  const fresh = () => clone(typeof initial === 'function' ? initial() : initial);
  let state = fresh();
  let userId = null;
  let loaded = false;
  /** local changes the cloud has not got yet */
  let dirty = false;
  /** cloud writes are off (feature off / banned) until another user signs in */
  let off = false;
  let status = 'idle';
  let lastError = null;
  let timer = null;
  /** the write in flight (one at a time) */
  let writing = null;
  const statusFns = new Set();
  const loadFns = new Set();

  const setStatus = (s, err = null) => {
    lastError = err;
    if (s === status) return;
    status = s;
    for (const fn of statusFns) fn(s, err);
  };

  // ---- this browser's copy (per user, so one user's data never shows up for another on a shared device)
  const localKey = (id) => `${prefix}:${slot}:${id ?? 'offline'}`;
  const readLocal = (id) => {
    try {
      const raw = storage?.getItem(localKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const writeLocal = () => {
    try {
      storage?.setItem(localKey(userId), JSON.stringify({ data: state, dirty, at: Date.now() }));
    } catch {
      /* storage full or blocked: the cloud copy still works */
    }
  };

  // ---- the app's data from before cloud saves (`existing`): taken once per browser.
  // The mark is per prefix + slot (not per user): the old key belongs to this browser, not to one account.
  const importedKey = `${prefix}:${slot}:imported`;
  const takeExisting = () => {
    if (typeof existing !== 'function') return null;
    try {
      if (storage?.getItem(importedKey)) return null;
      const old = existing();
      return old === undefined || old === null ? null : clone(old);
    } catch {
      return null; // a broken old save: start without it (the old key stays as it is)
    }
  };
  const markImported = () => {
    try {
      storage?.setItem(importedKey, String(Date.now()));
    } catch {
      /* blocked storage: it may be offered again next time; merge keeps that harmless for max / union merges */
    }
  };

  // ---- errors → status. Returns true when the write should be retried later
  const classify = (e) => {
    const code = e && e.code;
    if (OFF_ERRORS.has(code)) {
      off = true;
      setStatus('off', e);
      console.warn(`[user-data] cloud storage is not available (${code}); changes are kept on this device only`);
      return false;
    }
    if (DATA_ERRORS.has(code)) {
      setStatus('error', e);
      return false;
    }
    // connection error (TypeError), 429 rate_limited, 503 service_unavailable, 5xx, signed out: keep it locally and retry
    setStatus('offline', e);
    return code !== 'signed_out' && code !== 'not_signed_in';
  };

  const canWrite = () => !!kumo && !!userId && !off;

  /** read the cloud copy; undefined on failure (status set) */
  const readCloud = async () => {
    try {
      return await kumo.saves.get(slot); // null when the slot does not exist yet
    } catch (e) {
      classify(e);
      return undefined;
    }
  };

  async function writeNow() {
    if (!dirty || !canWrite()) return;
    for (let attempt = 1; ; attempt++) {
      const data = state;
      dirty = false;
      setStatus('saving');
      try {
        // 'latest' = the version this SDK last read or wrote for the slot (load() read it)
        await kumo.saves.set(slot, data, { ifVersion: 'latest' });
        if (!dirty) writeLocal(); // record "in the cloud" locally (unless it changed again meanwhile)
        setStatus(dirty ? 'saving' : 'saved');
        if (dirty) schedule(delayMs);
        return;
      } catch (e) {
        dirty = true;
        writeLocal();
        if (e && e.code === 'version_conflict' && attempt < CONFLICT_TRIES) {
          const cloud = await readCloud(); // also updates the version 'latest' refers to
          if (cloud === undefined) return;
          state = cloud ? merge(clone(cloud.data), state) : state;
          writeLocal();
          for (const fn of loadFns) fn(state, { reason: 'merged' });
          continue;
        }
        if (e && e.code === 'version_conflict') {
          setStatus('offline', e);
          schedule(retryMs);
          return;
        }
        if (classify(e)) schedule(retryMs);
        return;
      }
    }
  }

  function run() {
    if (writing) {
      // a write is in flight: write the newer state right after it
      writing.then(() => schedule(0));
      return;
    }
    writing = writeNow().finally(() => {
      writing = null;
    });
  }

  function schedule(ms) {
    if (!canWrite()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      run();
    }, ms);
  }

  /** Load the signed-in user's data (or this browser's copy). Call once after connecting; returns the state. */
  async function load() {
    userId = (kumo && kumo.auth.player && kumo.auth.player.id) || null;
    off = false;
    const local = readLocal(userId);
    loaded = true;
    const old = takeExisting();
    // fold the old data into what this page would show otherwise (base null = nothing yet)
    const withOld = (base) => (old === null ? base : base === null ? old : merge(clone(base), old));
    if (!kumo || !userId) {
      // no user yet: show the old data, but keep offering it until a user's copy holds it (no mark here)
      state = local ? local.data : old ?? fresh();
      dirty = !!(local && local.dirty) || (!local && old !== null);
      setStatus('offline');
      return state;
    }
    const cloud = await readCloud();
    if (cloud === undefined) {
      // could not reach the cloud: work on this browser's copy and send it later
      state = withOld(local ? local.data : null) ?? fresh();
      dirty = !!(local && local.dirty) || old !== null;
      if (old !== null) {
        writeLocal(); // the user's own copy now holds it (dirty): the next load sends it
        markImported();
      }
      if (dirty) schedule(retryMs);
      return state;
    }
    if ((local && local.dirty) || old !== null) {
      // changes from last time that never reached the cloud (closed tab, no connection), and/or the app's old data
      const base = local && local.dirty ? (cloud ? merge(clone(cloud.data), local.data) : local.data) : cloud ? cloud.data : null;
      state = withOld(base) ?? fresh();
      dirty = true;
      writeLocal();
      if (old !== null) markImported();
      setStatus('saving');
      schedule(0);
    } else {
      state = cloud ? cloud.data : fresh();
      dirty = false;
      writeLocal();
      setStatus('saved');
    }
    return state;
  }

  /** Another user signed in on this page (see onSignIn). */
  async function switchUser(newId) {
    if (timer) clearTimeout(timer);
    timer = null;
    if (writing) await writing;
    const before = { state, dirty };
    if (!newId) {
      // signed out: stop writing until someone signs in (there is no session to write with)
      const leaving = userId;
      userId = null;
      off = false;
      setStatus('offline');
      if (onSignOut === 'keep') return; // the old behaviour: the state stays on screen, nothing is saved
      // Forget this browser's copy of the user who left — but only when the cloud has it all. A copy with changes that
      // never reached the cloud (dirty) stays, so it is sent the next time that user signs in here (load() merges it).
      // Call `await data.flush()` before `signOut()` so there is nothing pending.
      if (!before.dirty) {
        try {
          storage?.removeItem?.(localKey(leaving));
        } catch {
          /* blocked storage: nothing to forget */
        }
      }
      state = fresh();
      dirty = false;
      for (const fn of loadFns) fn(state, { reason: 'signed-out' });
      return;
    }
    if (onSignIn === 'keep-account') {
      await load();
    } else {
      userId = newId;
      off = false;
      const cloud = await readCloud();
      if (cloud === undefined) return;
      const account = cloud ? cloud.data : null;
      state =
        typeof onSignIn === 'function'
          ? onSignIn(clone(account), before.state)
          : onSignIn === 'keep-device'
            ? before.state
            : account === null
              ? before.state
              : merge(clone(account), before.state);
      dirty = true;
      writeLocal();
      schedule(0);
    }
    for (const fn of loadFns) fn(state, { reason: 'user-changed' });
  }

  let unsubscribe = () => {};
  if (kumo) {
    unsubscribe = kumo.auth.onChange((p) => {
      const id = (p && p.id) || null;
      if (!loaded || id === userId) return; // same user (e.g. a new display name or a linked email)
      void switchUser(id);
    });
  }

  // Leaving the page: try to send what is pending (the local copy is already written either way)
  const onHide = () => {
    if (globalThis.document && globalThis.document.visibilityState === 'hidden') void flush();
  };
  const onPageHide = () => void flush();
  globalThis.addEventListener?.('pagehide', onPageHide);
  globalThis.document?.addEventListener?.('visibilitychange', onHide);

  /** Write now (clears the wait). Resolves with the status after the write. */
  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (writing) await writing;
    if (dirty && canWrite()) {
      writing = writeNow().finally(() => {
        writing = null;
      });
      await writing;
    }
    return status;
  }

  return {
    load,
    flush,
    /** The current state (the object the page reads). */
    get state() {
      return state;
    },
    get status() {
      return status;
    },
    get lastError() {
      return lastError;
    },
    /** Change the state: `fn` may change it in place or return a new one. Saved locally now, in the cloud a moment later. */
    update(fn) {
      const next = fn(state);
      if (next !== undefined) state = next;
      dirty = true;
      writeLocal();
      if (status === 'error') setStatus('saving'); // new data may fit again
      schedule(delayMs);
      return state;
    },
    /** Replace the whole state. */
    replace(next) {
      state = next;
      dirty = true;
      writeLocal();
      schedule(delayMs);
      return state;
    },
    /** "New game" / "reset": delete the cloud slot and start from `initial`. */
    async reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (writing) await writing;
      state = fresh();
      dirty = false;
      writeLocal();
      if (canWrite()) {
        try {
          await kumo.saves.delete(slot);
        } catch (e) {
          if (!(e && e.status === 404)) classify(e); // 404 = there was nothing to delete
        }
      }
      return state;
    },
    /** Status changes: fn(status, error|null). Returns a function that stops listening. */
    onStatus(fn) {
      statusFns.add(fn);
      return () => statusFns.delete(fn);
    },
    /** The state was replaced from outside: fn(state, { reason }). reason = 'user-changed' (another user signed in),
     *  'merged' (after a conflict) or 'signed-out' (back to `initial`). */
    onLoad(fn) {
      loadFns.add(fn);
      return () => loadFns.delete(fn);
    },
    /** Stop listening to sign-in changes and page events. */
    dispose() {
      unsubscribe();
      globalThis.removeEventListener?.('pagehide', onPageHide);
      globalThis.document?.removeEventListener?.('visibilitychange', onHide);
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}
