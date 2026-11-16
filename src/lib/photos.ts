import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { entityPhotos } from "@/db/schema";
import type { Viewer } from "./dal";
import { fileUrl } from "./files";

export async function albumPhotos(viewer: Viewer, kind: "animal" | "plant" | "member", entityId: string) {
  const rows = await db
    .select()
    .from(entityPhotos)
    .where(and(eq(entityPhotos.familyId, viewer.family.id), eq(entityPhotos.entityType, kind), eq(entityPhotos.entityId, entityId)))
    .orderBy(desc(entityPhotos.createdAt));
  return rows.map((r) => ({ id: r.id, caption: r.caption, thumb: fileUrl(r.fileId, true)!, full: fileUrl(r.fileId)!, mine: r.createdByMemberId === viewer.member.id }));
}
