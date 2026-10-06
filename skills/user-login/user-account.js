/**
 * user-account.js — sign-in helpers for an app's or a game's account screen. From the `user-login` Skill.
 * Copy it next to the page code that imports it (`public/` without a build step, `src/` with one); build the screen
 * (buttons, inputs) in the project's own style and call these from it.
 * (KUMODeck's API calls users "players": `kumo.auth.player` is the signed-in user.)
 *
 * Every function returns a plain result object instead of throwing for the cases a user causes (wrong password,
 * closed the sign-in window, email already used…), so the screen can show a message and let them try again.
 * Unexpected errors still throw. `message(result)` turns a result into a short English sentence (translate as needed).
 *
 * The rules this follows (and why):
 *   - A guest who adds an email or a provider keeps their data: `link…` attaches it to the SAME user. So
 *     `registerWithEmail` / `continueWith` link when the user is a guest, and only sign in (switch user) when asked to.
 *   - Signing in to an existing account switches to ANOTHER user; the guest's data stays with the guest.
 *     The `user-data` Skill's `onSignIn` decides what happens to it.
 *   - Provider sign-in opens a popup: call it straight from a click handler (browsers block popups opened later).
 *   - Inside X's in-app browser, Google and X sign-in cannot finish: move the user to their normal browser first
 *     (same guest, data kept) with a one-time link.
 *   - The last way to sign in cannot be removed (the server refuses with 409 `last_login_method`).
 */

/** Sign-in methods a user can add (besides being a guest). */
export const METHODS = ['email', 'google', 'discord', 'apple', 'x'];

const NAMES = { email: 'email', google: 'Google', discord: 'Discord', apple: 'Apple', x: 'X' };

/** What the account screen needs to know about the current user. */
export function accountSummary(kumo) {
  const p = kumo && kumo.auth.player;
  if (!p) return { signedIn: false, isGuest: false, displayName: null, methods: [], email: null, emailVerified: null, canRemove: () => false };
  const methods = p.identities.map((i) => i.provider).filter((m) => m !== 'guest');
  const email = (p.identities.find((i) => i.provider === 'email') || {}).email || null;
  return {
    signedIn: true,
    isGuest: p.isGuest,
    displayName: p.displayName,
    /** e.g. ['email', 'google'] — the ways this user can sign in on another device */
    methods,
    email,
    /** null when there is no email sign-in; false until they click the link in the confirmation email */
    emailVerified: p.emailVerified ?? null,
    /** can this method be removed? (there must be another one left) */
    canRemove: (m) => methods.includes(m) && methods.length > 1
  };
}

const fail = (e) => ({ ok: false, code: (e && e.code) || 'error', error: e });

/** Errors a user causes (show a message, let them retry). Anything else is rethrown. */
const USER_ERRORS = new Set([
  'unauthorized', 'email_taken', 'already_linked', 'invalid_request', 'identity_already_linked', 'provider_already_linked',
  'popup_blocked', 'popup_closed', 'timeout', 'signin_needs_browser', 'last_login_method', 'forbidden', 'rate_limited',
  'provider_disabled', 'provider_not_configured', 'feature_disabled', 'redirect_not_allowed', 'reauthentication_failed',
  'already_appealed', 'sanction_unknown', 'not_found', 'service_unavailable', 'transfer_disabled'
]);
async function attempt(fn) {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e && USER_ERRORS.has(e.code)) return fail(e);
    throw e;
  }
}

/**
 * "Create an account" / "Keep my data" with an email + password: a guest gets it attached (same user, data kept);
 * nobody signed in → a new account.
 */
export function registerWithEmail(kumo, { email, password, displayName } = {}) {
  return attempt(async () => {
    if (kumo.auth.player && kumo.auth.player.isGuest) {
      const player = await kumo.auth.linkEmail(email, password);
      if (displayName) await kumo.auth.setDisplayName(displayName);
      return { player: kumo.auth.player || player, linked: true };
    }
    const player = await kumo.auth.signUpWithEmail(email, password, displayName);
    return { player, linked: false };
  });
}

/** Sign in to an existing email account (switches user). */
export function signInWithEmail(kumo, email, password) {
  return attempt(async () => ({ player: await kumo.auth.signInWithEmail(email, password), linked: false }));
}

/**
 * Google / Discord / Apple / X — CALL FROM A CLICK HANDLER (popup).
 *   link: true (default for a guest) attaches it to the current user (data kept); false signs in (switches user).
 *   mode: 'popup' (default) | 'redirect' (the page reloads: flush unsaved data first).
 * Result codes to handle on screen: 'needs-browser' (show `url` / `hint`: open the page in the normal browser),
 * 'identity_already_linked' (that account is another user's: offer to sign in with it instead, link: false),
 * 'popup_blocked' (not called from a click), 'popup_closed' (the user closed it).
 */
export async function continueWith(kumo, provider, { link, mode } = {}) {
  const linkIt = link ?? !!(kumo.auth.player && kumo.auth.player.isGuest);
  const opts = mode ? { mode } : {};
  const r = await attempt(async () => {
    const res = linkIt ? await kumo.auth.linkProvider(provider, opts) : await kumo.auth.signInWithProvider(provider, opts);
    return { player: res.player, linked: res.linked };
  });
  if (r.ok || r.code !== 'signin_needs_browser') return r;
  // X's in-app browser: a one-time link (10 minutes) that opens the page in the normal browser as the same user.
  // Needs share.inAppBrowser.enabled in kumo.config.json; without it (transfer_disabled) the user gets the plain message
  const moved = await attempt(async () => kumo.share.openInBrowser());
  return moved.ok ? { ok: false, code: 'needs-browser', url: moved.url, hint: moved.hint, opened: moved.opened } : r;
}

/** After a sign-in with mode 'redirect' the page reloads; this gives the result (null when it was not a sign-in). */
export function redirectResult(kumo) {
  return attempt(async () => ({ result: await kumo.auth.completeRedirectSignIn() }));
}

/** Remove a sign-in method. Refused (code 'last_login_method') when it is the last one: add another first. */
export function removeMethod(kumo, provider) {
  return attempt(async () => ({ player: await kumo.auth.unlinkIdentity(provider) }));
}

/** Forgot password: always "sent" (the server never says whether an email is registered). */
export function sendPasswordReset(kumo, email, redirectUrl) {
  return attempt(async () => {
    await kumo.auth.sendPasswordReset(email, redirectUrl);
    return {};
  });
}

/** The page was opened from a password-reset email: show a "new password" field, then call this. */
export function finishPasswordReset(kumo, newPassword) {
  const pending = kumo.auth.pendingAction();
  if (!pending || pending.type !== 'reset_password') return Promise.resolve({ ok: false, code: 'no_reset_pending' });
  return attempt(async () => {
    await kumo.auth.resetPassword(pending.token, newPassword);
    return {};
  });
}

/** The user's active ban, or null. Readable only while the session that was banned is still open (up to 15 minutes). */
export async function activeBan(kumo) {
  try {
    const { sanctions } = await kumo.sanctions.mine();
    return sanctions.find((s) => s.kind === 'ban' && s.active) || null;
  } catch {
    return null;
  }
}

/**
 * Appeal a ban (once per ban, up to 2000 characters). banId may be null on a later visit: the SDK then appeals the ban
 * that ended this browser's session. Codes: 'already_appealed', 'sanction_unknown' / 'unauthorized' (no ban found here).
 */
export function appealBan(kumo, banId, message) {
  return attempt(async () => kumo.sanctions.appeal(banId || null, String(message).slice(0, 2000)));
}

/** A short English sentence for a result (or an error code). Translate these as needed. */
export function message(r) {
  if (r && r.ok) return 'Done.';
  const code = typeof r === 'string' ? r : r && r.code;
  const who = NAMES[r && r.error && r.error.details && r.error.details.provider] || 'that account';
  switch (code) {
    case 'unauthorized': return 'Email or password is incorrect.';
    case 'email_taken': return 'This email already has an account. Sign in with it instead.';
    case 'already_linked': return 'This account already has an email sign-in.';
    case 'invalid_request': return 'Check the email address; the password needs at least 8 characters.';
    case 'identity_already_linked': return 'That account is already used by someone else here. Sign in with it instead?';
    case 'provider_already_linked': return 'A different account of this kind is already connected. Remove it first.';
    case 'popup_blocked': return 'The sign-in window was blocked. Tap the button again.';
    case 'popup_closed': case 'timeout': return 'Sign-in was not finished.';
    case 'needs-browser': return 'Open this page in your browser to sign in; your data comes with you.';
    case 'signin_needs_browser': case 'transfer_disabled': return `Sign in with ${who} works in your normal browser, not inside this app.`;
    case 'last_login_method': return 'This is your only way to sign in. Add another one before removing it.';
    case 'forbidden': return 'This account is banned.';
    case 'rate_limited': return 'Too many tries. Wait a minute and try again.';
    case 'already_appealed': return 'You have already appealed this ban.';
    case 'sanction_unknown': case 'not_found': return 'No ban was found for this browser.';
    case 'no_reset_pending': return 'Open the link from the password-reset email again.';
    case 'provider_disabled': case 'provider_not_configured': case 'feature_disabled': case 'redirect_not_allowed':
      return 'This sign-in option is not available right now.';
    case 'service_unavailable': return 'Sign-in is unavailable right now. Please try again later.';
    default: return 'Something went wrong. Please try again.';
  }
}
