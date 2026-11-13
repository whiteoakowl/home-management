import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { files } from "@/db/schema";
import type { Viewer } from "./dal";

/**
 * Storage adapter. On Netlify (where the server's disk isn't kept between
 * requests) files go to Netlify Blobs; elsewhere to local disk (STORAGE_DIR,
 * default ./storage). STORAGE_DRIVER=blobs|disk forces one or the other.
 */
const ROOT = process.env.STORAGE_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");

const onNetlify = () =>
  process.env.STORAGE_DRIVER === "blobs" ||
  (process.env.STORAGE_DRIVER !== "disk" && !!((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT));

const blobStore = async () => (await import("@netlify/blobs")).getStore({ name: "uploads", consistency: "strong" });

const storage = {
  async put(key: string, data: Buffer) {
    if (onNetlify()) {
      await (await blobStore()).set(key, new Uint8Array(data).buffer as ArrayBuffer);
      return;
    }
    const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  },
  async get(key: string): Promise<Buffer> {
    if (onNetlify()) {
      const ab = await (await blobStore()).get(key, { type: "arrayBuffer" });
      if (!ab) throw new Error("File not found");
      return Buffer.from(ab);
    }
    return readFile(/*turbopackIgnore: true*/ path.join(ROOT, key));
  },
  async remove(key: string) {
    if (onNetlify()) {
      await (await blobStore()).delete(key).catch(() => undefined);
      return;
    }
    await unlink(/*turbopackIgnore: true*/ path.join(ROOT, key)).catch(() => undefined);
  },
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];
const DOC_TYPES = ["application/pdf", "text/plain"];
const MAX_BYTES = 10 * 1024 * 1024;

export class UploadError extends Error {
  readonly userFacing = true;
  readonly field = "image";
}

/**
 * Save an uploaded File. Images are auto-rotated, resized to ≤2048px and a
 * 320px thumbnail (both WebP). Returns the files.id, or null if nothing uploaded.
 */
export async function saveUpload(viewer: Viewer, file: FormDataEntryValue | null, opts: { allowDocs?: boolean } = {}) {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new UploadError("Files must be 10 MB or smaller.");
  const isImage = IMAGE_TYPES.includes(file.type);
  if (!isImage && !(opts.allowDocs && DOC_TYPES.includes(file.type))) {
    throw new UploadError(opts.allowDocs ? "Upload an image or PDF." : "Upload a JPG, PNG, WebP or HEIC image.");
  }
  const id = randomUUID();
  const base = `${viewer.family.id}/${id}`;
  const input = Buffer.from(await file.arrayBuffer());

  if (!isImage) {
    const key = `${base}${path.extname(file.name) || ".bin"}`;
    await storage.put(key, input);
    await db.insert(files).values({
      id,
      familyId: viewer.family.id,
      uploadedByMemberId: viewer.member.id,
      storageKey: key,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: input.length,
    });
    return id;
  }

  let main: { data: Buffer; info: { width: number; height: number } };
  let thumb: Buffer;
  try {
    const img = sharp(input, { failOn: "none" }).rotate();
    main = await img.clone().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    thumb = await img.clone().resize(320, 320, { fit: "cover" }).webp({ quality: 75 }).toBuffer();
  } catch {
    throw new UploadError("That image couldn't be read. Try a JPG or PNG.");
  }
  await storage.put(`${base}.webp`, main.data);
  await storage.put(`${base}.thumb.webp`, thumb);
  await db.insert(files).values({
    id,
    familyId: viewer.family.id,
    uploadedByMemberId: viewer.member.id,
    storageKey: `${base}.webp`,
    thumbnailKey: `${base}.thumb.webp`,
    originalName: file.name,
    mimeType: "image/webp",
    sizeBytes: main.data.length,
    width: main.info.width,
    height: main.info.height,
  });
  return id;
}

export async function readFamilyFile(familyId: string, id: string, thumb: boolean) {
  const [row] = await db.select().from(files).where(and(eq(files.id, id), eq(files.familyId, familyId)));
  if (!row) return null;
  const key = thumb && row.thumbnailKey ? row.thumbnailKey : row.storageKey;
  try {
    return { data: await storage.get(key), mime: row.mimeType, name: row.originalName };
  } catch {
    return null;
  }
}

export async function deleteFamilyFile(familyId: string, id: string | null | undefined) {
  if (!id) return;
  const [row] = await db.delete(files).where(and(eq(files.id, id), eq(files.familyId, familyId))).returning();
  if (row) {
    await storage.remove(row.storageKey);
    if (row.thumbnailKey) await storage.remove(row.thumbnailKey);
  }
}

/** URL for an uploaded file (served by app/api/files/[id]). */
export const fileUrl = (id: string | null | undefined, thumb = false) => (id ? `/api/files/${id}${thumb ? "?thumb=1" : ""}` : null);
