import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Reject loopback, private, link-local and other non-public addresses (SSRF guard). */
export function isPublicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return !(a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPublicAddress(v.slice(7));
  return !(v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80"));
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links can be imported.");
  if (url.username || url.password) throw new Error("Links with credentials aren't allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => !isPublicAddress(a.address))) throw new Error("That address isn't reachable from here.");
}

/** Fetch a public URL with redirects re-checked, a timeout and a size cap. */
export async function safeFetch(raw: string, opts: { maxBytes?: number; accept?: string; timeoutMs?: number } = {}) {
  let url = new URL(raw);
  const maxBytes = opts.maxBytes ?? 3_000_000;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; FamilyHomeRecipeImporter/1.0)", accept: opts.accept ?? "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The site answered ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new Error("That page is too large.");
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("That page is too large.");
      }
      chunks.push(value);
    }
    return { url: url.toString(), contentType: res.headers.get("content-type") ?? "", body: Buffer.concat(chunks) };
  }
  throw new Error("Too many redirects.");
}
