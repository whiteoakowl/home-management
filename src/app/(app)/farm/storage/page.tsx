import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/display";
import { loadStorage, StorageAddButton, StorageItems } from "@/components/storage/storage-items";
import { getViewer } from "@/lib/dal";
import { FarmTabs } from "../farm-tabs";

export const metadata: Metadata = { title: "Farm storage" };

/** Farm storage: feed, bedding, fencing, tools and medicine kept for the animals. */
export default async function FarmStoragePage() {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const { cats, items } = await loadStorage(viewer, "farm");
  return (
    <>
      <PageHeader eyebrow="Farm" title="Farm storage" description="Feed, bedding, fencing, tools and animal medicine on hand. Also listed under House → Storage." actions={<StorageAddButton viewer={viewer} location="farm" cats={cats} />} />
      <FarmTabs active="storage" />
      <StorageItems viewer={viewer} location="farm" cats={cats} items={items} empty={{ title: "Nothing in farm storage yet", description: "Track feed, bedding, fencing, tools and animal medicine.", example: "Pine shavings · 4 bales · alert at 1" }} />
    </>
  );
}
