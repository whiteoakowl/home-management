import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import exifReader from "exif-reader";
import sharp from "sharp";
import { db } from "@/db";
import { files } from "@/db/schema";
import type { Viewer } from "./dal";
import { familyStorageBytes, familyStorageLimit } from "./housekeeping";
import { storage } from "./storage";

// Uploads are stored via src/lib/storage.ts (Supabase Storage, Netlify Blobs or local disk).
const store = {
  put: async (key: string, data: Buffer, type = "application/octet-stream") => {
    try {
      await storage().put(key, data, type);
    } catch (e) {
      console.error("Upload storage failed:", e);
      throw new UploadError(`The photo couldn't be stored (${storage().name}): ${String((e as Error).message ?? e).slice(0, 200)}`);
    }
  },
  get: (key: string) => storage().get(key),
  remove: (key: string) => storage().remove(key),
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];
const DOC_TYPES = ["application/pdf", "text/plain"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Shown as the form's message (not tied to one field: album and journal forms have no "image" field). */
export class UploadError extends Error {
  readonly userFacing = true;
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
  // Fair-use allowance per family (FAMILY_STORAGE_GB, default 10 GB).
  if ((await familyStorageBytes(viewer.family.id)) + file.size > familyStorageLimit()) {
    throw new UploadError(`Your family has used its ${Math.round(familyStorageLimit() / 1024 ** 3)} GB of photo and file storage. Delete some old photos or files to make room, or contact us for more.`);
  }
  const id = randomUUID();
  const base = `${viewer.family.id}/${id}`;
  const input = Buffer.from(await file.arrayBuffer());

  if (!isImage) {
    const key = `${base}${path.extname(file.name) || ".bin"}`;
    await store.put(key, input, file.type);
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
  let takenAt: Date | null = null;
  try {
    const img = sharp(input, { failOn: "none" }).rotate();
    // When the photo was taken (camera data), for the timeline. The saved copy keeps no camera data or location.
    takenAt = await img
      .metadata()
      .then((m) => (m.exif ? exifDate(m.exif) : null))
      .catch(() => null);
    main = await img.clone().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    thumb = await img.clone().resize(320, 320, { fit: "cover" }).webp({ quality: 75 }).toBuffer();
  } catch {
    throw new UploadError("That image couldn't be read. Try a JPG or PNG.");
  }
  await store.put(`${base}.webp`, main.data, "image/webp");
  await store.put(`${base}.thumb.webp`, thumb, "image/webp");
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
    takenAt,
  });
  return id;
}

function exifDate(buf: Buffer): Date | null {
  try {
    const e = exifReader(buf) as { Photo?: { DateTimeOriginal?: Date }; Image?: { DateTime?: Date } };
    const d = e.Photo?.DateTimeOriginal ?? e.Image?.DateTime ?? null;
    return d instanceof Date && !Number.isNaN(+d) && d.getFullYear() > 1990 && d <= new Date() ? d : null;
  } catch {
    return null;
  }
}

// ─── Videos: uploaded straight from the phone to storage ─────────────────────

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/3gpp"];
export const maxVideoBytes = () => Math.max(10, Number(process.env.MAX_VIDEO_MB) || 300) * 1024 * 1024;

/**
 * Reserve a stored file for a video and return where the browser should send
 * it. Supabase: a one-time direct upload link (the app server never carries
 * the video, so the host's ~6 MB limit doesn't apply). Other storage: the
 * app's own upload route (for development).
 */
export async function startVideoUpload(viewer: Viewer, meta: { name: string; size: number; type: string }) {
  const type = meta.type || "video/mp4";
  if (!VIDEO_TYPES.includes(type)) throw new UploadError("Upload an MP4 or MOV video.");
  if (!(meta.size > 0) || meta.size > maxVideoBytes()) throw new UploadError(`Videos must be ${Math.round(maxVideoBytes() / 1024 / 1024)} MB or smaller.`);
  if ((await familyStorageBytes(viewer.family.id)) + meta.size > familyStorageLimit()) throw new UploadError(`Your family has used its ${Math.round(familyStorageLimit() / 1024 ** 3)} GB of photo and file storage.`);
  const id = randomUUID();
  const ext = type === "video/quicktime" ? ".mov" : type === "video/webm" ? ".webm" : ".mp4";
  const key = `${viewer.family.id}/${id}${ext}`;
  const s = storage();
  const direct = s.signedUploadUrl ? await s.signedUploadUrl(key) : null;
  if (s.signedUploadUrl && !direct) throw new UploadError("Video uploads aren't available right now. Please try again.");
  await db.insert(files).values({ id, familyId: viewer.family.id, uploadedByMemberId: viewer.member.id, storageKey: key, originalName: meta.name.slice(0, 200), mimeType: type, sizeBytes: Math.round(meta.size) });
  return { fileId: id, uploadUrl: direct ?? `/api/upload/${id}`, direct: !!direct };
}

/** Video files of this family among the given ids (to attach to an album or memory). */
export async function familyVideos(familyId: string, ids: string[]) {
  const clean = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
  if (!clean.length) return [];
  const rows = await db.select({ id: files.id, mime: files.mimeType }).from(files).where(and(eq(files.familyId, familyId), inArray(files.id, clean)));
  return rows.filter((r) => r.mime.startsWith("video/")).map((r) => r.id);
}

export async function readFamilyFile(familyId: string, id: string, thumb: boolean) {
  const [row] = await db.select().from(files).where(and(eq(files.id, id), eq(files.familyId, familyId)));
  if (!row) return null;
  const key = thumb && row.thumbnailKey ? row.thumbnailKey : row.storageKey;
  try {
    return { data: await store.get(key), mime: row.mimeType, name: row.originalName };
  } catch {
    return null;
  }
}

/** A short-lived direct link for files over 4 MB, when the storage service supports it. */
export async function bigFileLink(familyId: string, id: string) {
  const s = storage();
  if (!s.signedUrl) return null;
  const [row] = await db.select({ key: files.storageKey, size: files.sizeBytes, mime: files.mimeType }).from(files).where(and(eq(files.id, id), eq(files.familyId, familyId)));
  // Videos always stream straight from storage (seeking needs it); other files when over 4 MB.
  if (!row || (row.size <= 4 * 1024 * 1024 && !row.mime.startsWith("video/"))) return null;
  return s.signedUrl(row.key, 300).catch(() => null);
}

export async function deleteFamilyFile(familyId: string, id: string | null | undefined) {
  if (!id) return;
  const [row] = await db.delete(files).where(and(eq(files.id, id), eq(files.familyId, familyId))).returning();
  if (row) {
    await store.remove(row.storageKey);
    if (row.thumbnailKey) await store.remove(row.thumbnailKey);
  }
}

/** URL for an uploaded file (served by app/api/files/[id]). */
export const fileUrl = (id: string | null | undefined, thumb = false) => (id ? `/api/files/${id}${thumb ? "?thumb=1" : ""}` : null);
