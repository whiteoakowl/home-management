import type { Metadata } from "next";
import Link from "next/link";
import { Gem } from "lucide-react";
import { deleteCollectionEntry } from "@/app/actions/craft";
import { CollectionModal } from "@/components/craft/collection-modal";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { DeleteButton } from "@/components/forms/inline";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { collectionFor } from "@/lib/craft";
import { fileUrl } from "@/lib/files";
import { craftViewer } from "../shared";

export const metadata: Metadata = { title: "Crystal & tool collection" };

export default async function CollectionPage() {
  const viewer = await craftViewer();
  const rows = await collectionFor(viewer);
  const canEdit = viewer.can("witchcraft", "edit");
  return (
    <>
      <PageHeader eyebrow="Witchcraft" title="Our collection" description="The crystals and tools your family owns or wishes for. Add pieces from any crystal or tool page." />
      <CraftTabs active="crystal" />
      {rows.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, item }) => (
            <article key={c.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <Link href={`/witchcraft/item/${item.id}`} className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50 text-3xl">
                {c.photoFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(c.photoFileId, true)!} alt={item.name} className="size-full object-cover" />
                ) : (
                  <span aria-hidden>{item.emoji}</span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/witchcraft/item/${item.id}`} className="font-semibold hover:text-primary-700">
                  {item.name}
                </Link>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone={c.status === "wishlist" ? "mist" : "olive"}>{c.status === "wishlist" ? "Wish list" : `${c.quantity} ${c.status}`}</Badge>
                  <Badge>{item.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{[c.location, c.acquiredOn ? fmtDate(c.acquiredOn) : null].filter(Boolean).join(" · ")}</p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 flex-col">
                  <CollectionModal itemId={item.id} entry={c} />
                  <DeleteButton action={deleteCollectionEntry} fields={{ id: c.id }} what="this collection entry" />
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Gem />} title="Your collection is empty" description="Open any crystal or tool and choose “Add to collection”." />
        </Card>
      )}
    </>
  );
}
