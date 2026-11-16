/**
 * Client-side photo shrinking before upload.
 *
 * Phone photos are often 3–12 MB each. The host rejects requests over ~6 MB
 * and slow uploads can time out, so images are resized in the browser (long
 * side ≤ 2048 px, JPEG) before they're sent. The server still re-encodes them.
 * Anything the browser can't decode (e.g. HEIC on Android Chrome) is sent as-is.
 */
const MAX_SIDE = 2048;
const QUALITY = 0.82;
const SKIP_BELOW = 600 * 1024; // small enough already
/** Keep each request comfortably under the host's ~6 MB limit. */
export const MAX_REQUEST_BYTES = 5.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml" || file.size < SKIP_BELOW) return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** A copy of the form data with every photo shrunk. Order and non-file fields are kept. */
export async function shrinkFormData(fd: FormData): Promise<{ data: FormData; bytes: number }> {
  const out = new FormData();
  let bytes = 0;
  for (const [key, value] of Array.from(fd.entries())) {
    if (typeof value === "string") {
      out.append(key, value);
      bytes += value.length;
    } else if (value.size === 0) {
      out.append(key, value, value.name);
    } else {
      const f = await shrinkImage(value);
      out.append(key, f, f.name);
      bytes += f.size;
    }
  }
  return { data: out, bytes };
}

export const tooLargeMessage = (bytes: number) =>
  `These files add up to ${(bytes / 1024 / 1024).toFixed(1)} MB, which is too much to send at once. Add fewer photos at a time (or smaller PDFs).`;

/** What to tell someone when the request itself failed (no answer from the server). */
export function networkFailureMessage() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "You're offline, so this wasn't saved. Reconnect and try again.";
  return "This didn't save: the connection dropped or the server took too long. Please try again. If it keeps happening, try with fewer or smaller photos.";
}
