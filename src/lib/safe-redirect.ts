/**
 * A same-site path to send someone to after an action, or the fallback.
 * Blocks other sites, including tricks like //evil.com and /\evil.com.
 */
export function safePath(raw: unknown, fallback = "/") {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, "http://same.site");
    return u.origin === "http://same.site" ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
