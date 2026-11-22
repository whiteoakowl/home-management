import "server-only";
import { headers } from "next/headers";

/**
 * The site's public address for links in emails. Set SITE_URL in production
 * (e.g. https://app.familybubble.com); Netlify's URL is used otherwise, then
 * the request's own host.
 */
export async function siteUrl() {
  const fixed = process.env.SITE_URL || process.env.URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
