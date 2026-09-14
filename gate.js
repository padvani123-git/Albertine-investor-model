// Password gate for the Mt. Albertine investor model (Developer's Dozen, LLC).
//
// Runs on Netlify's edge, in front of every request, before any static file
// (including index.html) is served. Nobody sees the deck without logging in.
//
// Login model: any email address + one shared password. The email is NOT
// verified as belonging to a real inbox -- it's a lightweight "who's
// looking" identifier (logged to Netlify's function logs), not a second
// factor. The actual gate is the shared password.
//
// Where you manage the password once this is live:
//   Netlify dashboard -> Site settings -> Environment variables -> SITE_PASSWORD
//   or from the CLI:  netlify env:set SITE_PASSWORD "your-real-password"
// Change AUTH_SECRET the same way if you ever want to invalidate every
// signed-in visitor's cookie at once (e.g. after rotating the password).
//
// TEST / DEFAULT PASSWORD: until you set SITE_PASSWORD in Netlify, this
// falls back to "PasswordAlbertine13" so you can test the gate right after
// deploying, before you've configured anything. This fallback is only ever
// checked server-side (it never ships to the browser) -- but it's still a
// shared, guessable default, so set your own SITE_PASSWORD before sending
// the link to real investors. The gate page itself shows a small notice
// whenever it's running on this fallback, as a reminder.
const DEFAULT_PASSWORD = "PasswordAlbertine13";

const AUTH_COOKIE = "albertine_auth";
const EMAIL_COOKIE = "albertine_email";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (request, context) => {
  const url = new URL(request.url);

  const configuredPassword = Netlify.env.get("SITE_PASSWORD") || "";
  const SITE_PASSWORD = configuredPassword || DEFAULT_PASSWORD;
  const usingDefault = !configuredPassword;
  const AUTH_SECRET = Netlify.env.get("AUTH_SECRET") || "albertine-dev-secret-change-me";

  // Handle the login form submission.
  if (url.pathname === "/__login" && request.method === "POST") {
    let email = "";
    let password = "";
    try {
      const form = await request.formData();
      email = (form.get("email") || "").toString().trim();
      password = (form.get("password") || "").toString();
    } catch (e) {
      // fall through to validation below, which will reject
    }

    const emailOk = EMAIL_RE.test(email);
    const passwordOk = password && password === SITE_PASSWORD;

    if (emailOk && passwordOk) {
      // Visible in Netlify: Site -> Logs -> Edge functions. This is the only
      // record kept of who signed in -- there's no database behind this.
      console.log(`[albertine-investor-gate] signed in: ${email}`);

      const token = await sign(AUTH_SECRET, SITE_PASSWORD, email.toLowerCase());
      const headers = new Headers({ Location: "/" });
      const cookieOpts = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
      headers.append("Set-Cookie", `${AUTH_COOKIE}=${token}; ${cookieOpts}`);
      headers.append("Set-Cookie", `${EMAIL_COOKIE}=${encodeURIComponent(email.toLowerCase())}; ${cookieOpts}`);
      return new Response(null, { status: 303, headers });
    }

    return renderGate({
      usingDefault,
      error: !emailOk ? "email" : "password",
      emailValue: email,
    });
  }

  // Already authenticated?
  const cookies = parseCookies(request.headers.get("cookie") || "");
  const authToken = cookies[AUTH_COOKIE];
  const email = cookies[EMAIL_COOKIE] ? decodeURIComponent(cookies[EMAIL_COOKIE]) : "";
  if (authToken && email) {
    const expected = await sign(AUTH_SECRET, SITE_PASSWORD, email);
    if (timingSafeEqual(authToken, expected)) {
      return context.next();
    }
  }

  return renderGate({ usingDefault });
};

function parseCookies(header) {
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

async function sign(secret, password, email) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(`${secret}|${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`albertine-investor-gate|${email}`));
  return toHex(new Uint8Array(sig));
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function renderGate({ error, usingDefault, emailValue } = {}) {
  const message =
    error === "email"
      ? "Enter a valid email address."
      : error === "password"
      ? "That password didn't match. Try again, or contact Prem Advani for access."
      : "This is a private investor page. Enter your email and the password you were given to continue.";

  const safeEmail = (emailValue || "").replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mt. Albertine — Investor Access</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  :root{
    --bg:#0B0B0C; --surface:#151517; --ink:#F4F1EC; --ink-2:#B9B6B0;
    --accent:#D6876D; --border:rgba(255,255,255,0.12); --critical:#e66767; --warn:#e8b64f;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(1200px 600px at 50% -10%, #1c1712 0%, var(--bg) 60%);
    color:var(--ink); font-family:'IBM Plex Sans',system-ui,sans-serif;
    padding:24px;
  }
  .card{
    width:100%; max-width:380px; background:var(--surface); border:1px solid var(--border);
    border-radius:16px; padding:34px 30px; box-shadow:0 20px 60px -20px rgba(0,0,0,0.6);
  }
  .eyebrow{
    font-size:11px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase;
    color:var(--accent); margin-bottom:8px;
  }
  h1{
    font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:26px; margin:0 0 14px;
    letter-spacing:-0.01em;
  }
  p.msg{ font-size:13.5px; line-height:1.6; color:var(--ink-2); margin:0 0 18px; }
  p.msg.err{ color:var(--critical); }
  .notice{
    font-size:12px; line-height:1.5; color:var(--warn); background:rgba(232,182,79,0.1);
    border:1px solid rgba(232,182,79,0.3); border-radius:9px; padding:10px 12px; margin:0 0 18px;
  }
  form{ display:flex; flex-direction:column; gap:12px; }
  label{ font-size:11.5px; color:var(--ink-2); }
  input[type="email"], input[type="password"]{
    background:#0B0B0C; border:1px solid var(--border); border-radius:9px;
    padding:12px 13px; font-size:15px; color:var(--ink); font-family:inherit; width:100%;
    margin-top:5px;
  }
  input:focus{ outline:2px solid var(--accent); outline-offset:1px; border-color:var(--accent); }
  button{
    background:var(--accent); color:#1B0E09; border:none; border-radius:9px;
    padding:12px 14px; font-size:14.5px; font-weight:600; cursor:pointer; font-family:inherit;
    margin-top:6px;
  }
  button:hover{ filter:brightness(1.06); }
  .foot{ margin-top:20px; font-size:11.5px; color:#7C7873; text-align:center; }
</style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">Developer's Dozen, LLC</div>
    <h1>Mt. Albertine — Investor access</h1>
    ${usingDefault ? `<div class="notice">Running on the default test password &mdash; set SITE_PASSWORD in Netlify before sharing this link with real investors.</div>` : ""}
    <p class="msg${error === "password" ? " err" : ""}">${message}</p>
    <form method="POST" action="/__login">
      <div>
        <label for="email">Email address</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" value="${safeEmail}" autofocus required>
      </div>
      <div>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Password" required>
      </div>
      <button type="submit">Enter</button>
    </form>
    <div class="foot">Private &middot; for investors and potential investors only</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
