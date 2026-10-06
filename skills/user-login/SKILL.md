---
name: user-login
description: Add user sign-in to this app or game with kumo.auth — use it as a guest first, then keep the data by adding an email + password, Google, Discord, Apple or X; sign in on another device; manage sign-in methods; password reset; display names; banned users and ban appeals. Use when the user asks for login, sign in, sign up, user accounts, a members area, "keep my data across devices", sign in with Google / Discord / Apple / X, a profile or account screen, or ban appeals.
---

# User sign-in with `kumo.auth`

People start using the app or game **before** they sign up: `Kumo.init()` (inside `connectKumo()` in
`kumo-boot.js`) creates a guest on the first visit and resumes it after that. When their data matters to them,
they **add** a sign-in method to the same user — email + password, Google, Discord, Apple or X — and keep everything
(their stored data). On another device they sign in with that method and get the same user back.

Signing in does not change where the data lives, and a signed-in user can still write their own `saves`:

**Protect in D1, not in saves.** Anything a user must not be able to change themselves — scores and rankings, coins, credits, items, purchases, badges, anything shared between users — goes in the project's own Functions + D1. `saves` holds only what the user may freely write (settings, drafts, a solo game's progress).
Details: the `user-data` and `functions-d1` Skills.

Naming: KUMODeck's API calls users **players** (`kumo.auth.player`, `players.verify`, "Players" in the dashboard).
In an app they are simply users; in a game, players.

File next to this SKILL.md (copy it; build the screen in the project's own style around it):

| File | Copy to | What it is |
|---|---|---|
| [user-account.js](user-account.js) | next to the page code that imports it: `public/` without a build step, `src/` with one (Vite) | account-screen helpers: keep data (link), sign in, remove a method, reset, ban appeal, messages |

The code and the screens are the creator's. KUMODeck keeps the sessions, passwords (hashed) and provider logins safe.

## 1. Ask the creator first (they decide; offer these as choices, one short message)

1. **Which ways to sign in** (any mix; guest use is always there):
   - **Email + password** — works everywhere, no setup outside KUMODeck.
   - **Google / Discord / Apple / X** — one tap for users, but **the creator** registers an OAuth app with each
     provider and pastes its client id / secret in the dashboard (**Sign-in methods**). Apple needs a paid Apple
     developer account. X: their own X app (the dashboard shows the steps). You never create these or type the secrets.
     Tell the user in plain words (`INDEX.md` → "Talking to the user"), e.g. "On the Google site, make a sign-in app and
     paste the two texts it shows (an ID and a long password-like text) on the dashboard page Sign-in methods. Not into
     this chat." / 「Google のサイトでログイン用のアプリを作り、出てくる 2 つの文字列（ID と長いパスワードのような文字列）を、
     ダッシュボードの『サインイン方法』のページに貼ってください。このチャットには貼らないでください」
2. **When to offer it**: a "Sign in" / "Keep my data" button in the menu, and/or a prompt at a natural moment (the first
   saved item, the first finished level). Guest use needs no sign-in; a members-only page can show
   the sign-in form first instead.
3. **Display names**: let users pick one (shown to others in rooms and in the creator's own lists), or keep the
   automatic style ("User 7F3A"). Names are 1–32 characters; control and invisible characters are refused.
4. **Account screen**: show which methods are connected and let users remove one (not the last); password reset;
   sign out; delete account and download my data (app stores require in-app deletion).
5. **Banned users**: show "This account is banned" and an appeal form (recommended: users can ask the creator to look
   again; the creator answers in the dashboard).

Do not pick silently. If the creator says "you choose": email + password, a "Keep my data" button in the menu,
display name on, account screen with sign out / delete / download, appeal form — and tell them.

## 2. Turn it on

```bash
kumodeck features on emailLogin        # email + password (sign up, link to a guest, verify, reset)
kumodeck config push                   # development; --env production when the user ships
```

Emails to users (confirm the email, reset the password) show the **project's name**: "Confirm your email for <name>".
`kumodeck init` set it (`--name`; without it, the folder's name, e.g. `app`). Check it in `kumodeck init --json` (`project.name`)
or on the dashboard before turning on email sign-in; if it is a folder-like name, tell the user in one line.

Providers are switched in `kumo.config.json` (not under `features`), after **the user** saved the credentials in the
dashboard under **Sign-in methods**:

```json
{
  "auth": {
    "redirectUrls": ["https://myapp.example.com/*"],
    "providers": { "google": { "enabled": true }, "discord": { "enabled": true } }
  }
}
```

People who open the link from a post on X are inside X's in-app browser, where Google and X sign-in cannot finish.
To move them to their normal browser as the same guest, also set `"share": { "inAppBrowser": { "enabled": true } }`
(the helper then shows a one-time link; without it they only get a message).

`redirectUrls`: the pages the provider (and the email links) may return to — exact URLs, or a trailing `*` for a path.
Only needed when the project is served from its own domain or server: localhost in development and the KUMODeck-hosted
URLs are allowed automatically. Push again after changing it.

## 3. In the page

The page has `kumo` from `connectKumo()` (null offline: hide the account button then).
No `kumo-boot.js` (the app was not made with `kumodeck create`)? Connect it first: the `start` Skill, "Already have an app".

**The app already has a name or accounts of its own** (it was built before sign-in was added):
- A name the user typed before (kept in the browser): make it their display name once, while they have none. A name
  the server refuses keeps the automatic one; the app goes on:
  ```js
  const old = (localStorage.getItem('my-app-name') ?? '').trim();          // the app's own key
  if (kumo.auth.player && !kumo.auth.player.displayName && old) await kumo.auth.setDisplayName(old.slice(0, 32)).catch(() => {});
  ```
- Its own sign-in (its own server, another service): do not remove it or move its users silently. Ask the creator once
  whether this sign-in replaces it or sits next to it. Passwords cannot be copied over (they are kept hashed where they
  are now): people add an email here with `registerWithEmail` from the guest they already are, so what they did on this
  device stays theirs.

```js
import { accountSummary, registerWithEmail, signInWithEmail, continueWith, removeMethod, message } from './user-account.js';

const me = accountSummary(kumo);   // { isGuest, displayName, methods: ['email', 'google'], email, emailVerified, canRemove(m) }
kumo.auth.onChange(() => renderAccount(accountSummary(kumo)));   // after sign-in, link, sign out

// "Keep my data" / "Create account" form (a guest → the email is attached to the same user)
const r = await registerWithEmail(kumo, { email, password, displayName });
if (!r.ok) showError(message(r));          // e.g. email_taken → "This email already has an account. Sign in with it instead."

// "Continue with Google" — in the button's click handler, nothing awaited before it (popups need the click)
button.onclick = async () => {
  const g = await continueWith(kumo, 'google');          // guest → link (data kept); signed in → sign in
  if (g.code === 'needs-browser') showOpenInBrowser(g.url, g.hint);   // inside X's app: copy / open the link
  else if (g.code === 'identity_already_linked') offerSwitch();       // continueWith(kumo, 'google', { link: false })
  else if (!g.ok) showError(message(g));
};

// "I already have an account" (switches to that user; the guest's data stays with the guest — see the user-data Skill)
const s = await signInWithEmail(kumo, email, password);
```

The same with the SDK directly (what the helpers call):

```js kumo-run setup=player features=saves,emailLogin
const email = `ace${Date.now()}@example.com`;
const guestId = kumo.auth.player.id;
await kumo.saves.set('settings', { theme: 'dark' });
await kumo.auth.linkEmail(email, 'correct horse battery');     // same user: data kept
assert.equal(kumo.auth.player.id, guestId);
assert.equal(kumo.auth.player.isGuest, false);
await kumo.auth.setDisplayName('Ace');
await kumo.auth.signOut();
await kumo.auth.signInWithEmail(email, 'correct horse battery'); // another device does the same
assert.equal(kumo.auth.player.id, guestId);
assert.equal((await kumo.saves.get('settings')).data.theme, 'dark');
```

Other calls the account screen uses:

| Call | What it does |
|---|---|
| `kumo.auth.signUpWithEmail(email, password, displayName?)` | a new account without a guest phase (the helper uses it when nobody is signed in) |
| `kumo.auth.signInWithProvider(p, { mode })` / `kumo.auth.linkProvider(p, { mode })` | `p` = `'google' \| 'discord' \| 'apple' \| 'x'`; `mode: 'redirect'` reloads the page — flush unsaved data first |
| `kumo.auth.completeRedirectSignIn()` | after a redirect: `{ player, provider, linked }` or `null` (Kumo.init already picked it up) |
| `kumo.auth.identities()` / `kumo.auth.unlinkIdentity(p)` | list / remove a method (`p` also `'email'`); removing signs out the user's other devices |
| `kumo.auth.resendVerification()` · `kumo.auth.player.emailVerified` | the confirmation email for an email sign-in (the link returns to the page and is handled by `Kumo.init`) |
| `kumo.auth.sendPasswordReset(email)` · `kumo.auth.pendingAction()` · `kumo.auth.resetPassword(token, pw)` | forgot password: when the page opens from the reset email, `pendingAction()` is `{ type: 'reset_password', token }` → show a new-password field |
| `kumo.auth.signOut()` | ends this device's session (a guest who signs out cannot come back: warn them first) |
| `kumo.account.exportData()` · `kumo.account.delete({ password })` | download my data · delete my account (guests confirm with their session) |
| `kumo.auth.getAccessToken()` | the user's token for the creator's own Functions: send it as `Authorization: Bearer …`; the server checks it with `requireUser` (`functions-d1` Skill §3; its database needs `kumodeck functions db migrate DB` after the first deploy) |

### The KUMODeck news box on email screens (required)

Any screen where users type an email to sign up or link needs the KUMODeck news box. KUMODeck draws it (unchecked, adults
only; it draws nothing otherwise) — never write that wording yourself:

```js
const news = await kumo.news.mountNewsOptIn(document.querySelector('#kumo-news'));   // an empty <div> under the form
// … after registerWithEmail(...) succeeded:
await news.submit(email);      // does nothing if not ticked; never throws
```

Only if the user asks to remove it: `kumodeck features off kumoNews` + push.

### Banned users and appeals

The creator bans from the dashboard, from their assistant, or from their Functions (`players.ban` in the starter's
`src/kumo.ts`). A banned user is signed out everywhere; writes fail with 403 `forbidden`.

```js
import { activeBan, appealBan } from './user-account.js';
const ban = await activeBan(kumo);          // readable for up to 15 minutes after the ban (the old session)
if (ban && !ban.appeal) showAppealForm((text) => appealBan(kumo, ban.id, text));
```

On a visit more than 15 minutes later the SDK has already started a fresh guest, and nothing tells the page that this
browser was banned. Keep a small "Banned? Appeal" link in the settings: `appealBan(kumo, null, text)` appeals the ban
that ended this browser's session (`sanction_unknown` / `unauthorized` = no ban found here). One appeal per ban, up
to 2000 characters. The creator answers in the dashboard (**Players → Ban appeals**);
`(await kumo.sanctions.mine()).sanctions[i].appeal` then shows `status: 'accepted' | 'rejected'` and the reply.

## 4. Check it works

1. Development copy (`kumodeck test-deploy`): use it as a guest, store something, "Keep my data" with an email.
   On a local KUMODeck server (the API is `localhost`) no email is sent: read it at `<api>/v1/dev/outbox?to=<email>` (newest
   first; `<api>` = `api` in `kumodeck whoami --json`) and open the link in it. Test accounts belong on development only.
2. Another browser: sign in with that email → same data. `kumo.auth.player.id` is the same on both.
3. Try the errors on purpose: wrong password (message shown), the same email again (`email_taken`), removing the only
   method (`last_login_method`).
4. Providers: the button opens the provider in a popup and returns to the page as the same user.

## 5. Errors and what to do

Every error is a `KumoError` with `code`, `message` and `details`, and often **`hint`** (one sentence: what to change
so it works) and `docsUrl`. Read `e.hint` first — log `e.code, e.message, e.hint` when something fails.

| Error (`e.code`, HTTP) | Meaning | Fix |
|---|---|---|
| `feature_disabled` 403 | email sign-in is off | `kumodeck features on emailLogin` → `kumodeck config push` |
| `provider_disabled` 404 | that provider is not enabled | `auth.providers.<p>.enabled: true` → push |
| `provider_not_configured` 409 | enabled, but the user has not saved its credentials | the user saves them in the dashboard → **Sign-in methods**; keep using it as a guest |
| `redirect_not_allowed` 400 | the return page is not in `auth.redirectUrls` | add the page's URL (or `https://host/*`) → push |
| `unauthorized` 401 | wrong email or password (never says which) | show "Email or password is incorrect" |
| `email_taken` 409 | the email already has an account in this project | offer "Sign in instead" |
| `already_linked` 409 | this user already has an email sign-in | show it on the account screen instead |
| `invalid_request` 400 | bad email, password under 8 characters, bad display name (`details.issues`) | show the rule |
| `identity_already_linked` | that Google / … account belongs to another user (accounts are never merged) | offer to sign in with it instead (switches user) |
| `provider_already_linked` | the user already has a different account of that provider | remove the old one first |
| `last_login_method` 409 | removing the only way to sign in | add another method first |
| `popup_blocked` / `popup_closed` / `timeout` | the popup was blocked (not from a click) / closed / left open 10 min | call from the click handler; let them retry; or `mode: 'redirect'` |
| `signin_needs_browser` | Google / X inside X's in-app browser | `kumo.share.openInBrowser()` → show the link (the helper does it) |
| `transfer_disabled` 404 | `openInBrowser` while `share.inAppBrowser.enabled` is off | turn it on → push, or just show the message |
| `signed_out` 401 | a call that needs a user after `signOut()`, or the session ended (SDK only, nothing was sent) | show sign-in again, or start as a guest (`kumo.auth.guest()`) |
| `reauthentication_failed` 401 | this device's session is stale for a sensitive change | sign in again, retry |
| `forbidden` 403 | the user is banned | show the appeal form |
| `already_appealed` 409 · `sanction_unknown` | one appeal per ban · no ban id known here | show the message |
| `rate_limited` 429 | too many tries | wait and retry |
| `service_unavailable` 503 | the creator's prepaid balance is used up | the creator runs `kumodeck billing topup`; guests keep working on local copies |

## 6. Security notes

- Only the publishable key (`pk_…`) goes in the page. Provider secrets live in the dashboard, never in files or chat.
- Tokens are handled by the SDK (15-minute access token, rotating 90-day refresh token). Never send a user's token
  anywhere except the creator's own Functions over HTTPS, and never log it.
- Show display names as text (`textContent`), never as HTML.
- Accounts are never merged by email: a provider account that belongs to another user is refused, not taken over.
- Cost: sign-in calls are ordinary API requests, billed as KUMODeck's usage fee at cost; Sign in with X is free.
