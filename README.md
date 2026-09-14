# Mt. Albertine — Investor Model

A single self-contained page (`index.html`) — no build step, no dependencies,
no external assets besides Google Fonts. Styles, script and both images
(cover photo, site aerial) are inlined in the file.

The site is **gated**: a Netlify Edge Function (`netlify/edge-functions/gate.js`)
sits in front of every request and only lets someone through after they enter
an email address plus a shared password. Nobody sees the deck by guessing
the URL.

This is a separate Netlify site from the 26 on Riley investor model — same
pattern, its own password, its own URL.

## Test credentials (right now, before you deploy anything)

Any email address + password **`PasswordAlbertine13`** gets in. The email
isn't verified against a real inbox — it's just logged (see "Who signed in"
below) so you can see who's been through the gate. The password is what
actually keeps people out.

That password is a **hardcoded fallback** built into `gate.js` so the gate
works the moment you deploy, before you've configured anything in Netlify.
Once you're ready to send this to real investors, set your own password
(see next section) — anyone who's seen this file or the code could otherwise
guess it.

## Where you manage the password once it's live

**Netlify dashboard → Site settings → Environment variables**, or from the
CLI:
```bash
netlify env:set SITE_PASSWORD "choose-a-real-password"
netlify env:set AUTH_SECRET "$(openssl rand -hex 32)"
```
There's no login/admin screen for this — it's a single environment variable
on the Netlify site itself. `SITE_PASSWORD` is the shared password investors
type in. `AUTH_SECRET` signs the login cookie; rotate it any time (same
command, new random value) to instantly log everyone out — useful right
after you change `SITE_PASSWORD`, since an old cookie would otherwise still
work until it expires (30 days) even after the password changes, unless the
secret changes too.

Until you set `SITE_PASSWORD`, the gate page shows a small on-page notice
that it's running on the default test password, as a reminder to set a real
one before sharing the link.

## Deploy — this requires CLI or Git deploy, not drag-and-drop

⚠️ The drag-and-drop flow at app.netlify.com/drop only uploads static files —
it does **not** run Edge Functions, so the gate would be skipped and the
deck would be public. Use the CLI or a Git-based deploy instead (same
caveat that tripped up the Riley site's first deploy).

**Netlify CLI:**
```bash
npx netlify-cli login
cd netlify_site_albertine
npx netlify-cli init            # creates a new site (or links an existing one)
npx netlify-cli deploy --prod   # ships it live, gate included, on the test password
```
Skip `netlify env:set` for now if you just want to test with
`PasswordAlbertine13` — add it later, any time, followed by a redeploy
(`npx netlify-cli deploy --prod` again) once you're ready to switch to a real one.

**Git-based deploy (recommended if you found the CLI login flow fiddly last time):**
1. Push this folder to a GitHub/GitLab repo (or use GitHub's web upload —
   drag the whole folder in, including the `netlify` folder).
2. In Netlify: "Import an existing project" → point it at the repo.
   Leave the build command blank — `netlify.toml` already sets the
   publish directory to the repo root, so nothing needs to be built.
3. It deploys live on the test password. Add `SITE_PASSWORD` /
   `AUTH_SECRET` under Site settings → Environment variables whenever
   you're ready, then trigger a deploy.

## Who signed in

There's no database or investor list behind this — it's a static site.
Every successful login is written to a line in Netlify's own function logs
(dashboard → your site → **Logs → Edge functions**, or `netlify logs:function`
from the CLI), formatted as:
```
[albertine-investor-gate] signed in: someone@example.com
```
That's the only record kept.

## How the gate works

- Every request hits `gate.js` first, before any file is served.
- Visiting the site shows a branded login page (not a browser popup) asking
  for an email and the shared password.
- Right password (any-looking email) → sets two signed, `HttpOnly` cookies
  good for 30 days and lets the visitor through to `index.html`.
- Wrong password, bad email format, no cookie, or a tampered cookie → the
  login page again.
- The real password lives only in Netlify's environment variables — it is
  never written into the HTML/JS that ships to the browser. (The fallback
  test password is the one exception, since it's meant to work with zero
  setup — see above.)

## Notes on the model itself

- Editing the model: open `index.html` in any editor. The financial
  logic lives in the `<script>` block near the bottom (`DEFAULTS`, the
  `compute()` function, and the investor waterfall math).
- Two exit paths are built in: Option 1 sells the 13 entitled/graded lots
  as-is; Option 2 builds and sells all 13 completed homes. Every price,
  cost, loan rate, and timeline input is editable live on the page — the
  price-per-lot assumption in Option 1 is **not** in the original deck, it's
  a placeholder for your own broker opinion of value.
- Viewer inputs to the calculator are remembered via `localStorage` in
  each visitor's own browser only — nothing is sent anywhere, there's no
  backend for the model itself (only the gate is server-side).
- To change the hero/site images, replace the base64 `data:image/jpeg`
  strings in the CSS/HTML with your own (or swap to a hosted image URL).
