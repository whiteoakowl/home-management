import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { db } from "@/db";
import { entityPhotos, photoAlbums } from "@/db/schema";
import { setPhotoMilestone } from "@/app/actions/memories";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { MediaTile, SocialBar } from "@/components/memories/media";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/dal";
import { albumVisible, socialFor } from "@/lib/memories";
import { familyMembersFor } from "@/lib/names";

export const metadata: Metadata = { title: "Photo" };

/** One photo: full size, reactions, comments, favorite, download, milestone. */
export default async function PhotoPage({ params }: PageProps<"/photos/[albumId]/[photoId]">) {
  const viewer = await getViewer();
  if (!viewer.can("photos")) notFound();
  const { albumId, photoId } = await params;
  if (![albumId, photoId].every((x) => /^[0-9a-f-]{36}$/i.test(x))) notFound();
  const [album] = await db.select().from(photoAlbums).where(and(eq(photoAlbums.id, albumId), albumVisible(viewer)));
  if (!album) notFound();
  const all = await db
    .select({ id: entityPhotos.id })
    .from(entityPhotos)
    .where(and(eq(entityPhotos.entityType, "album"), eq(entityPhotos.entityId, album.id)))
    .orderBy(sql`coalesce(${entityPhotos.takenAt}, ${entityPhotos.createdAt}) desc`, asc(entityPhotos.id));
  const i = all.findIndex((p) => p.id === photoId);
  if (i < 0) notFound();
  const [p] = await db.select().from(entityPhotos).where(eq(entityPhotos.id, photoId));
  if (!p) notFound();
  const [social, members] = await Promise.all([socialFor(viewer, "photo", [p.id]), familyMembersFor(viewer)]);
  const by = members.find((m) => m.id === p.createdByMemberId)?.displayName.split(" ")[0];
  const when = (p.takenAt ?? p.createdAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: viewer.family.timezone });
  const prev = all[i - 1]?.id;
  const next = all[i + 1]?.id;
  const nav = "inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/photos/${album.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
          <ArrowLeft className="size-4" /> {album.title}
        </Link>
        <span className="flex items-center gap-2 text-sm text-muted">
          {prev ? (
            <Link href={`/photos/${album.id}/${prev}`} className={nav} aria-label="Newer">
              <ChevronLeft className="size-5" />
            </Link>
          ) : null}
          {i + 1} / {all.length}
          {next ? (
            <Link href={`/photos/${album.id}/${next}`} className={nav} aria-label="Older">
              <ChevronRight className="size-5" />
            </Link>
          ) : null}
        </span>
      </div>
      <div className="flex max-h-[75vh] items-center justify-center overflow-hidden rounded-2xl bg-black">
        <MediaTile fileId={p.fileId} mediaType={p.mediaType} alt={p.caption ?? album.title} controls className="max-h-[75vh] object-contain" />
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {p.milestone && (
              <p className="flex items-center gap-1.5 font-semibold">
                <Star className="size-4 fill-[#f5c84c] text-[#d9a514]" /> {p.milestone}
              </p>
            )}
            {p.caption && <p>{p.caption}</p>}
            <p className="text-sm text-muted">
              {when}
              {by && ` · added by ${by}`}
            </p>
          </div>
          {viewer.can("photos", "use") && (
            <FormModal title="Caption & milestone" triggerLabel={p.milestone ? "Edit" : "⭐ Milestone"} triggerVariant="secondary" triggerSize="sm" action={setPhotoMilestone} size="sm">
              <input type="hidden" name="id" value={p.id} />
              <TextField name="caption" label="Caption" maxLength={200} defaultValue={p.caption ?? ""} />
              <TextField name="milestone" label="Milestone" maxLength={120} defaultValue={p.milestone ?? ""} placeholder="First steps!" hint="Leave empty if it isn't a milestone. Milestones show on the family timeline." />
            </FormModal>
          )}
        </div>
        <SocialBar type="photo" id={p.id} social={social} me={viewer.member.id} isParent={viewer.isParent} fileId={p.fileId} />
      </Card>
    </div>
  );
}
