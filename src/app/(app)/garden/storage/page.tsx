import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/display";
import { loadStorage, StorageAddButton, StorageItems } from "@/components/storage/storage-items";
import { getViewer } from "@/lib/dal";
import { GardenTabs } from "../garden-tabs";

export const metadata: Metadata = { title: "Root cellar" };

/** Garden storage and the root cellar: the harvest put by, plus soil, fertilizer and garden supplies. */
export default async function GardenStoragePage() {
  const viewer = await getViewer();
  if (!viewer.can("garden")) notFound();
  const { cats, items } = await loadStorage(viewer, "garden");
  return (
    <>
      <PageHeader eyebrow="Garden" title="Root cellar & garden storage" description="Stored harvest and garden supplies. Also listed under House → Storage." actions={<StorageAddButton viewer={viewer} location="garden" cats={cats} />} />
      <GardenTabs active="storage" />
      <StorageItems viewer={viewer} location="garden" cats={cats} items={items} empty={{ title: "Nothing stored yet", description: "Track potatoes, onions, squash and apples in the root cellar, plus soil, fertilizer and garden supplies.", example: "Potatoes · 25 lb · Bin 2" }} />
    </>
  );
}
