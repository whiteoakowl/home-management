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
}

// ─── Supabase Storage (REST API) ────────────────────────────────────────────

export function supabaseDriver(opts: { url: string; key: string; bucket?: string; fetch?: typeof fetch }): StorageDriver {
  const base = `${opts.url.replace(/\/+$/, "")}/storage/v1`;
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
