"use server";

import { requireModule } from "@/lib/dal";
import { startVideoUpload } from "@/lib/files";
import { rateLimit } from "@/lib/rate-limit";

/** Reserve a video and get the link the browser uploads it to (see lib/files.ts). */
export async function beginVideoUpload(meta: { name: string; size: number; type: string }): Promise<{ ok: true; fileId: string; uploadUrl: string; direct: boolean } | { ok: false; message: string }> {
  try {
    const viewer = await requireModule("photos", "use");
    if (!(await rateLimit(`video:${viewer.member.id}`, 60, 3600))) return { ok: false, message: "Too many uploads. Please wait a bit." };
    const r = await startVideoUpload(viewer, { name: String(meta.name ?? "video"), size: Number(meta.size), type: String(meta.type ?? "") });
    return { ok: true, ...r };
  } catch (e) {
    const err = e as { userFacing?: boolean; message?: string };
    return { ok: false, message: err.userFacing ? err.message! : "That video couldn't be uploaded. Please try again." };
  }
}
