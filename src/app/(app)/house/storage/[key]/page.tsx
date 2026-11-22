import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteStorageArea, saveStorageArea } from "@/app/actions/kitchen";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { PageHeader } from "@/components/ui/display";
import { loadStorage, StorageAddButton, StorageItems } from "@/components/storage/storage-items";
import { getViewer } from "@/lib/dal";
import { canSeeStorage, storageArea } from "@/lib/storage-areas";
import { STORAGE_PLACES } from "@/lib/storage-places";
import { HouseTabs } from "../../house-tabs";

export const metadata: Metadata = { title: "Storage" };

/** One storage area: craft supplies, other storage, or one of the family's own areas. */
export default async function StorageAreaPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const viewer = await getViewer();
  if (!viewer.can("house") && !(key === "craft" && canSeeStorage(viewer, "craft"))) notFound();
  const area = key === "craft" || key === "other" ? null : await storageArea(viewer.family.id, key);
  if (!area && key !== "craft" && key !== "other") notFound();
  const location = key === "craft" ? "craft" : "other";
  const title = area ? area.name : STORAGE_PLACES[location].label;
  const { cats, items } = await loadStorage(viewer, location, area?.id);
  const manage = !!area && (viewer.isParent || viewer.can("house", "edit"));

  return (
    <>
      <PageHeader
        eyebrow="Storage"
        title={title}
        description={key === "craft" ? "Yarn, fabric, paint, paper, candles, herbs and other craft and ritual supplies." : area ? "Everything kept here." : "Things that aren't in any other storage area."}
        actions={
          <>
            {manage && (
              <FormModal title="Rename storage area" triggerLabel="Edit" triggerVariant="secondary" action={saveStorageArea}>
                <input type="hidden" name="id" value={area.id} />
                <TextField name="name" label="Name" required defaultValue={area.name} />
              </FormModal>
            )}
            {manage && <DeleteButton action={deleteStorageArea} fields={{ id: area.id }} what={`${area.name} (its items move to Other storage)`} />}
            <StorageAddButton viewer={viewer} location={location} areaId={area?.id} cats={cats} label={`Add to ${title}`} />
          </>
        }
      />
      {viewer.can("house") && <HouseTabs active="storage" viewer={viewer} />}
      <StorageItems viewer={viewer} location={location} areaId={area?.id} cats={cats} items={items} empty={{ title: `Nothing in ${title} yet`, description: "Add what's kept here, with a shelf or bin and a low-stock alert if you like." }} />
    </>
  );
}
