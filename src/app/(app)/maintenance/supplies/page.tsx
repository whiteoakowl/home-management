import type { Metadata } from "next";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { PageHeader } from "@/components/ui/display";
import { loadStorage, StorageAddButton, StorageItems } from "@/components/storage/storage-items";
import { maintViewer } from "../shared";

export const metadata: Metadata = { title: "Home supplies" };

/** Home maintenance supplies: filters, light bulbs, batteries, paint, hardware. */
export default async function MaintenanceSuppliesPage() {
  const viewer = await maintViewer();
  const { cats, items } = await loadStorage(viewer, "home");
  return (
    <>
      <PageHeader eyebrow="Home maintenance" title="Home supplies" description="Filters, light bulbs, batteries, paint and hardware on hand. Also listed under House → Storage." actions={<StorageAddButton viewer={viewer} location="home" cats={cats} />} />
      <MaintenanceTabs active="supplies" />
      <StorageItems viewer={viewer} location="home" cats={cats} items={items} empty={{ title: "No home supplies tracked", description: "Track furnace filters, light bulbs, batteries, touch-up paint and hardware.", example: "Furnace filter 16×25×1 · 2 · alert at 1" }} />
    </>
  );
}
