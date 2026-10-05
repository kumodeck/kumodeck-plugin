---
name: user-data
description: KUMODeck の DB を使って保存して — user-writable settings, drafts and solo progress. Store each user's data in the cloud with kumo.saves — an app's settings, drafts, favorites or profile, or a game's save and progress — so it follows the user to every device, with autosave, conflict-safe writes between two devices, and keeping a guest's data when they sign in. Use when the user asks to save or sync user data, settings or preferences, remember something per user, autosave, a draft, continue on another device, a game save or save slot, or a personal best, or "save this with KUMODeck's database" for data the user may freely change (Protect in D1, not in saves).
---

# Per-user data with `kumo.saves`

Each user of the app or game gets JSON documents stored under **slot keys** (`settings`, `draft`, `progress`,
`slot1`…). They follow the user to every device they sign in on. Each slot has a **version**, so two devices cannot
silently overwrite each other. Data is separate per environment: development data never shows up in production.

Naming: KUMODeck's API calls users **players** (`kumo.auth.player`, `players.verify`) and per-user documents **saves**
(`kumo.saves`). In an app they are simply users and their data.

File next to this SKILL.md (copy it, then set the options — do not rewrite it from scratch):

| File | Copy to | What it is |
|---|---|---|
| [user-data.js](user-data.js) | `public/user-data.js` (the deployed folder) | one slot with autosave, a copy in the browser, conflict handling and sign-in changes |

For a single tiny value (a theme setting) the plain calls in section 3 are enough; use `user-data.js` for anything the
user builds up over time (settings with many fields, a draft, favorites, a game's progress).

## Codex: before calling KUMODeck

Read the `deploy` Skill's "Codex: tools and command permissions" section before remote commands. Discover exposed MCP
tools when the host offers that capability; otherwise use the installed CLI. For blocked communication, preserve the
implementation, request only permitted command access, and report the pending verification. Never bypass a denial.
DB / API work alone stays on development; only a publishing request continues to `deploy` §1. If KUMODeck returns
`approval_required` and a `confirmUrl`, use `deploy` §5's link flow: open the returned link, tell the user you are waiting
for their browser confirmation (no chat reply needed), then continue until success or error. CLI confirmation waits in
the existing command instead. Never click the human confirmation or claim unverified storage / API success.

## 1. Pick the defaults, then tell the creator (ask only what you truly cannot decide)

For a small app or game (notes, a to-do list, settings, a game's progress) do not stop to ask these one by one: use the
defaults below, build it, then tell the creator in one line which defaults you picked (they can change them later). Ask
only when you truly cannot decide, and then only one question. The four choices and their defaults:

1. **What to store, in which slots.** Usually one slot per kind of data: `settings`, `draft`, `favorites` in an app;
   `progress` (or `slot1`–`slot3` save files) in a game. Slot keys: lowercase letters, digits and `_`, starting with a
   letter, up to 128 characters. No limit on the number of slots (storage is billed at cost by size), 2 MB of JSON
   per slot — the server's 413 carries the limit in `details.limit`, so read it from there instead of hard-coding it. The `limits` Skill explains each limit.
2. **When to write**: after each change with a short wait (autosave, default 2 s after the last change), or only at
   explicit moments (a "Save" button, the end of a level → call `flush()`).
3. **Two devices at once** (phone + laptop): what should happen when both changed the data? Pick one:
   - **merge** (recommended): e.g. union of favorites, the higher level, the newest value per field;
   - **keep this device's copy** (simple; the other device's changes since its last write are lost);
   - **ask the user** which one to keep (the page shows both).
4. **A guest who signs in to an existing account on a new device** (they used it a bit before signing in): keep the
   account's data (default, safest on shared devices), keep this device's data, or merge the two.
   Linking an email / Google / … to the current guest keeps everything (same user) — nothing to decide there.

Defaults: one slot per kind of data, autosave, merge (union for lists, higher for game numbers, this device for plain
settings), keep the account's data on sign-in. Never pick silently: the one line says what you chose.

**Saves or the creator's database?** ("save it in a DB", "store it on the server" means one of these two.)
The browser writes saves, so a modified page can write anything into them. Pick by who may change the data:

**Protect in D1, not in saves.** Anything a user must not be able to change themselves — scores and rankings, coins, credits, items, purchases, badges, anything shared between users — goes in the project's own Functions + D1. `saves` holds only what the user may freely write (settings, drafts, a solo game's progress).

| Put it in | What | Who writes it |
|---|---|---|
| **saves** (this Skill) | what the user may change freely: settings, progress notes, drafts, favorites, a game's save | the user's own browser (a changed value hurts nobody) |
| **Functions + D1** (the `functions-d1` Skill) | what must be protected: scores and rankings, coins, credits, items, purchases, a verified badge, anything shared between users | only the creator's server code |

When unsure: if a user changing it by hand would be a problem, it goes in D1. **Never keep money, credits or
purchases in saves** (this also fits the creator's own Stripe). Say this if there is a shop or a ranking.

## 2. Turn it on

```bash
kumodeck features on saves      # sets features.saves in kumo.config.json
kumodeck config push            # development; add --env production when the user ships
```

Until it is on, every call fails with 403 `feature_disabled` (details `{ feature: 'saves' }`).
The game templates already have `saves` on — check with `kumodeck features`.

## 3. In the page

The page gets `kumo` from `connectKumo()` in `public/kumo-boot.js` (it is `null` offline — keep the page usable).
No `kumo-boot.js` (the app was not made with `kumodeck create`)? Connect it first: the `start` Skill, "Already have an app".

1. Copy `user-data.js` into `public/` and set it up once, after connecting:

   ```js
   import { createUserData } from './user-data.js';

   // merge = what "both devices changed it" means for THIS data (the creator's answer to question 3)
   const merge = (cloud, local) => ({
     theme: local.theme,                                               // settings: this device wins
     favorites: [...new Set([...cloud.favorites, ...local.favorites])], // lists: union
     level: Math.max(cloud.level, local.level)                         // a game's progress: the higher
   });

   const data = createUserData({
     kumo,                                   // may be null: then it keeps a copy in this browser only
     slot: 'settings',
     initial: { theme: 'light', favorites: [], level: 1 },
     merge,
     onSignIn: 'keep-account'                // or 'keep-device' / 'merge' (question 4)
   });
   let state = await data.load();            // before the first render that needs it
   data.onLoad((s) => { state = s; render(); });   // another user signed in, signed out, or a merge after a conflict
   ```

2. Change the state through `update` (the cloud write happens `delayMs` later, one write per burst of changes):

   ```js
   data.update((s) => { s.favorites.push(itemId); });
   ```

   Explicit-save pages: call `await data.flush()` on "Save" instead of waiting.
   Call `await data.flush()` before anything that leaves the page (a sign-in with `mode: 'redirect'`, a link out).
   Closing the tab is covered: every change is also written to the browser at once and sent on the next visit.
3. Show the state if the creator wants (`data.onStatus((s) => …)`: `saving` / `saved` / `offline` / `off` / `error`).
   Never block the page on it.
4. "Reset" / "New game": `await data.reset()` (deletes the slot, starts from `initial`).

The plain calls, if you need them:

```js kumo-run setup=player features=saves
const s = await kumo.saves.get('settings');                     // null if the slot does not exist yet
const settings = s?.data ?? { theme: 'light' };
settings.theme = 'dark';
const meta = await kumo.saves.set('settings', settings);        // { key, version, size, updatedAt } — overwrites
assert.equal(meta.key, 'settings');
const all = await kumo.saves.list();                            // [{ key, version, size, updatedAt }] (no data)
assert.ok(all.some((x) => x.key === 'settings'));
await kumo.saves.delete('settings');
```

Conflict-safe write without the helper — `ifVersion: 'latest'` means "the version this page last read or wrote";
`ifVersion: 0` means "only if the slot does not exist yet":

```js kumo-run setup=player features=saves
let profile = (await kumo.saves.get('profile'))?.data ?? { visits: 0 };
profile.visits += 1;
try {
  await kumo.saves.set('profile', profile, { ifVersion: 'latest' });
} catch (e) {
  if (e.code !== 'version_conflict') throw e;                   // another device wrote first
  const cloud = await kumo.saves.get('profile');
  profile = { visits: Math.max(cloud.data.visits, profile.visits) };  // the page's own merge
  await kumo.saves.set('profile', profile, { ifVersion: cloud.version });
}
```

## 4. Guests, sign-in and devices

- Every user starts as a guest (the SDK creates one on the first visit). The guest's data belongs to that user.
- `kumo.auth.linkEmail(...)` / `kumo.auth.linkProvider(...)` attach a sign-in to **the same user**: data stays,
  nothing to copy. Offer this before the data matters ("Keep your data: add an email or Google") — the `user-login`
  Skill has the screens.
- Signing in to an **existing** account on another device switches to **another user**: that account's data loads
  (`onLoad` fires) and the guest's data on this device stays with the old guest. `onSignIn` decides whether it is
  kept, dropped or merged. Without `user-data.js`, read the guest's data before `signInWithEmail` /
  `signInWithProvider` and write it after, if the creator chose to keep it.
- **Signing out** (`kumo.auth.signOut()`): the helper puts `initial` back on screen (`onLoad` with `reason: 'signed-out'`)
  and forgets this browser's copy of that user, so the next person on a shared device does not see it. Nothing is saved
  until someone is signed in again (a new guest: `kumo.auth.guest()`, or a reload). Call `await data.flush()` before
  `signOut()`. `onSignOut: 'keep'` leaves the old state on screen instead (not saved) — only if the creator asks.
- If the browser blocks storage (some private modes), a guest is new on every reload, so their data cannot follow them
  until they sign in. The page still works.

## 5. Check it works

1. Open the development copy (`kumodeck deploy --env development`, or `public/` locally with the development key), change
   something, wait 2 s.
2. Reload: the state is back. Open it in a second browser signed in to the same account: same state.
3. Change it in both, a few seconds apart: the second write merges instead of overwriting (`onLoad` fires with
   `reason: 'merged'`).
4. Offline (devtools → Offline): changes keep working, status `offline`; back online + reload: they reach the cloud.

## 6. Errors and what to do

Every error is a `KumoError` with `code`, `message` and `details`, and often **`hint`** (one sentence: what to change
so it works) and `docsUrl`. Read `e.hint` first — log `e.code, e.message, e.hint` when something fails.

| Error (`e.code`, HTTP) | Meaning | Fix |
|---|---|---|
| `feature_disabled` 403 | saves are off for this environment | `kumodeck features on saves` → `kumodeck config push` (`--env production` for the live copy) |
| `version_conflict` 409 | another device wrote first (`details.currentVersion`) | read again, merge, write with the new version (the helper does it) |
| `save_too_large` 413 | more than `details.limit` (2 MB) of JSON in one slot (`details.size`, `details.limit`). The SDK checks before sending: nothing was sent. A raw HTTP body far over the limit gets 413 `invalid_request` instead (same `details.limit`) — same fix | store less (derive what you can), or split into slots; files belong in the creator's Functions storage |
| `invalid_request` 400 | bad slot key or body (`details.issues`) | slot keys are lowercase snake_case, start with a letter, ≤ 128 chars |
| `not_found` 404 | `delete` of a slot that does not exist (`get` returns `null` instead) | ignore |
| `signed_out` 401 | no user on this page: after `kumo.auth.signOut()`, or the session ended (SDK only, nothing was sent) | sign in again, or start as a guest (`kumo.auth.guest()`); the helper waits for the next user by itself |
| `rate_limited` 429 | more than about 60 writes a minute for one user | write less often (debounce; the helper writes at most once per `delayMs`) |
| `forbidden` 403 | the user is banned | nothing to store; the page can show the ban appeal (`user-login` Skill) |
| `service_unavailable` 503 | the creator's prepaid balance is used up, user-facing features paused | the creator runs `kumodeck billing` / `kumodeck billing topup`; the local copy keeps the changes meanwhile |
| `origin_not_allowed` 403 | the page's origin is not in `web.allowedOrigins` | add it to `kumo.config.json` → push |

## 7. Cost and data

- Each `get`, `set`, `list` and `delete` is one API request, billed as KUMODeck's usage fee at cost from prepaid credit
  (plus the stored bytes). Autosave with a wait keeps it to a few requests per visit.
- This is the user's data: `kumo.account.exportData()` includes it and `kumo.account.delete()` removes it.
- Keep slot names stable once people use the app; add a `version` field inside the data if its shape will change, and
  upgrade old data after `load()` instead of renaming slots.
- Data shared between users (a team's board, a public list, anything the server must check) does not fit here: it
  belongs in the creator's own database through Functions (the `functions-d1` Skill). The order that works the first time:
  `kumodeck functions enable` → `kumodeck functions deploy` (creates the empty database and prints the migrate line) →
  `kumodeck functions db migrate DB` (the tables) → call it. A server-rendered app keeps it in its own database instead:
  `kumodeck deploy`, then `kumodeck db migrate DB` (no Functions needed; the `deploy` Skill §9).
