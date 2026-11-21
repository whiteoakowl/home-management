/**
 * File storage drivers for uploads (photos, receipts, PDFs).
 *
 *   supabase  Supabase Storage, private bucket (SUPABASE_URL + SUPABASE_SECRET_KEY)
 *   blobs     Netlify Blobs (automatic when running on Netlify)
 *   disk      local folder (STORAGE_DIR, default ./storage) for development
 *
 * Priority: STORAGE_DRIVER if set; else Supabase when configured; else Netlify
 * Blobs on Netlify; else disk. Files are only ever served through
 * /api/files/[id], which checks family membership (and medical privacy), so
 * the Supabase bucket stays private and the secret key never reaches a browser.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageDriver {
  name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  /** Remove many objects in one request (Supabase). */
  removeMany?(keys: string[]): Promise<void>;
  /** A short-lived direct download link (Supabase), so big files skip the app server's size limit. */
  signedUrl?(key: string, seconds: number): Promise<string | null>;
}

// ─── Supabase Storage (REST API) ────────────────────────────────────────────

/**
 * The project's base address from whatever was pasted into SUPABASE_URL:
 * "https://abc.supabase.co/rest/v1/", ".../storage/v1", "abc.supabase.co", or a
 * dashboard link "https://supabase.com/dashboard/project/abc" all become
 * "https://abc.supabase.co". (A path left on the end sends uploads to the
 * database API instead, which answers 404 PGRST125.)
 */
export function supabaseBaseUrl(raw: string) {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return t.replace(/\/+$/, "");
  }
  const dash = u.hostname.endsWith("supabase.com") && u.pathname.match(/\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  // A database connection string: postgres.<ref>@…pooler.supabase.com or db.<ref>.supabase.co
  const pooler = u.username.match(/^postgres\.([a-z0-9]+)$/i);
  if (pooler) return `https://${pooler[1]}.supabase.co`;
  const direct = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (direct) return `https://${direct[1]}.supabase.co`;
  return u.origin === "null" ? `https://${u.host}` : u.origin;
}

export function supabaseDriver(opts: { url: string; key: string; bucket?: string; fetch?: typeof fetch }): StorageDriver {
  const base = `${supabaseBaseUrl(opts.url)}/storage/v1`;
  const bucket = opts.bucket ?? "uploads";
  const f = opts.fetch ?? fetch;
  const headers = (extra: Record<string, string> = {}) => ({ apikey: opts.key, Authorization: `Bearer ${opts.key}`, ...extra });
  const objectPath = (key: string) => `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  let bucketChecked = false;

  /** Create the private bucket on first use if it doesn't exist yet. */
  async function ensureBucket() {
    if (bucketChecked) return;
    const res = await f(`${base}/bucket`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ id: bucket, name: bucket, public: false }) });
    // 200 = created; 400/409 "already exists" is fine too.
    if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Supabase Storage: couldn't create bucket "${bucket}" (${res.status} ${await res.text().catch(() => "")})`);
    bucketChecked = true;
  }

  return {
    name: "supabase",
    async put(key, data, contentType) {
      const upload = () =>
        f(`${base}/object/${objectPath(key)}`, {
          method: "POST",
          headers: headers({ "Content-Type": contentType || "application/octet-stream", "x-upsert": "true", "cache-control": "max-age=31536000" }),
          body: new Uint8Array(data),
        });
      let res = await upload();
      if (!res.ok && (res.status === 404 || res.status === 400)) {
        const text = await res.text().catch(() => "");
        if (/bucket/i.test(text)) {
          await ensureBucket();
          res = await upload();
        } else throw new Error(`Supabase Storage upload failed (${res.status} ${text})`);
      }
      if (!res.ok) throw new Error(`Supabase Storage upload failed (${res.status} ${await res.text().catch(() => "")})`);
    },
    async get(key) {
      const res = await f(`${base}/object/authenticated/${objectPath(key)}`, { headers: headers() });
      if (!res.ok) throw new Error(`Supabase Storage: file not found (${res.status})`);
      return Buffer.from(await res.arrayBuffer());
    },
    async remove(key) {
      await f(`${base}/object/${encodeURIComponent(bucket)}`, { method: "DELETE", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: [key] }) }).catch(() => undefined);
    },
    async removeMany(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const res = await f(`${base}/object/${encodeURIComponent(bucket)}`, { method: "DELETE", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: keys.slice(i, i + 1000) }) });
        if (!res.ok) throw new Error(`Supabase Storage delete failed (${res.status})`);
      }
    },
    async signedUrl(key, seconds) {
      const res = await f(`${base}/object/sign/${objectPath(key)}`, { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: seconds }) });
      if (!res.ok) return null;
      const body = (await res.json().catch(() => null)) as { signedURL?: string } | null;
      return body?.signedURL ? `${base}${body.signedURL.startsWith("/") ? "" : "/"}${body.signedURL}` : null;
    },
  };
}

// ─── Netlify Blobs ───────────────────────────────────────────────────────────

const blobStore = async () => (await import("@netlify/blobs")).getStore({ name: "uploads", consistency: "strong" });
const blobsDriver: StorageDriver = {
  name: "blobs",
  async put(key, data) {
    await (await blobStore()).set(key, new Uint8Array(data).buffer as ArrayBuffer);
  },
  async get(key) {
    const ab = await (await blobStore()).get(key, { type: "arrayBuffer" });
    if (!ab) throw new Error("File not found");
    return Buffer.from(ab);
  },
  async remove(key) {
    await (await blobStore()).delete(key).catch(() => undefined);
  },
};

// ─── Local disk ──────────────────────────────────────────────────────────────

const ROOT = process.env.STORAGE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");
const diskDriver: StorageDriver = {
  name: "disk",
  async put(key, data) {
    const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  get: (key) => readFile(/*turbopackIgnore: true*/ path.join(ROOT, key)),
  async remove(key) {
    await unlink(/*turbopackIgnore: true*/ path.join(ROOT, key)).catch(() => undefined);
  },
};

// ─── Selection ───────────────────────────────────────────────────────────────

const supabaseKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const onNetlify = () => !!((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT);

let cached: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (cached) return cached;
  const want = process.env.STORAGE_DRIVER;
  if (want === "supabase" || (!want && process.env.SUPABASE_URL && supabaseKey())) {
    if (!process.env.SUPABASE_URL || !supabaseKey()) throw new Error("STORAGE_DRIVER=supabase needs SUPABASE_URL and SUPABASE_SECRET_KEY.");
    cached = supabaseDriver({ url: process.env.SUPABASE_URL, key: supabaseKey()!, bucket: process.env.SUPABASE_BUCKET });
  } else if (want === "blobs" || (!want && onNetlify())) cached = blobsDriver;
  else cached = diskDriver;
  return cached;
}
