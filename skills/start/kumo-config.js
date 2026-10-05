// Public settings for this game. Every value here is PUBLIC and safe to ship.
// You normally never edit this file: `kumodeck init` (run in the game folder) replaces the REPLACE_ME values with
// your API URL and your publishable keys, as long as REPLACE_ME is still here. A file you edited yourself is left alone.
//   apiUrl       — your backend API URL. '' = the origin the page was loaded from (right for `kumodeck deploy` path hosting,
//                  <api>/play/<slug>/). Set it when you host the files elsewhere.
//   projectKeys  — PUBLISHABLE keys. kumo-boot.js picks "development" on <slug>--dev URLs and on localhost,
//                  "production" everywhere else. A single `projectKey: 'pk_…'` (older setup) also works.
// NEVER put a secret key (sk_…) here. You can also override both from the URL: ?api=…&key=…
window.KUMO_CONFIG = {
  apiUrl: '',
  projectKeys: {
    development: 'pk_dev_REPLACE_ME',
    production: 'pk_live_REPLACE_ME'
  }
};
