/**
 * Origin allowlist.
 *
 * Honest scope: the `Origin` header is set by browsers but is trivially forged
 * by anything that is not a browser. This stops casual hotlinking and
 * third-party embedding of our brokered endpoints. It is NOT a security
 * boundary against a determined scraper — the per-IP rate limit and the daily
 * budget cap are what actually bound the damage.
 *
 * Configured via ALLOWED_ORIGINS (comma-separated) in wrangler.toml / .env.
 */

/**
 * Parse ALLOWED_ORIGINS into a Set. Entries are compared exactly, except that
 * a leading "*." permits any single-label subdomain (e.g. "*.pages.dev"
 * matches "preview.pages.dev" but not "a.b.pages.dev").
 * @param {string|undefined} raw
 */
export function parseAllowedOrigins(raw) {
  return String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string|null} origin
 * @param {string[]} allowed
 * @returns {boolean}
 */
export function isOriginAllowed(origin, allowed) {
  if (!origin) return false;
  for (const pattern of allowed) {
    if (pattern === origin) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // ".pages.dev"
      try {
        const host = new URL(origin).host;
        const bare = host.endsWith(suffix) ? host.slice(0, -suffix.length) : null;
        // Single label only: "preview" ok, "a.b" not.
        if (bare && bare.length > 0 && !bare.includes('.')) return true;
      } catch {
        // Malformed Origin header — treat as not allowed.
      }
    }
  }
  return false;
}

/**
 * Resolve the request's origin against the allowlist.
 *
 * Same-origin browser requests may omit `Origin` entirely, and non-browser
 * clients (curl, monitoring) always do. We allow a missing Origin through —
 * blocking it would break same-origin fetches and health checks — but we
 * return `null` so no CORS header is echoed back. Cross-origin reads are still
 * blocked by the browser in that case, because no allow-origin header is sent.
 *
 * @returns {{ok: true, origin: string|null} | {ok: false, origin: string}}
 */
export function resolveOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return { ok: true, origin: null };

  const allowed = parseAllowedOrigins(env?.ALLOWED_ORIGINS);
  if (isOriginAllowed(origin, allowed)) return { ok: true, origin };
  return { ok: false, origin };
}
