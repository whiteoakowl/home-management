import { isIP } from "node:net";

/** Turn what people paste (webcal://, http://) into an https URL, or null. */
export function cleanCalendarUrl(raw: string): string | null {
  let s = raw.trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  if (/^http:\/\//i.test(s)) s = s.replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}
