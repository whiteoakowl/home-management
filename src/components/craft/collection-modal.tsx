import { saveCollectionEntry } from "@/app/actions/craft";
import { RecordModal } from "@/components/forms/config-form";
import { COLLECTION_FIELDS } from "@/lib/craft-config";
import { fileUrl } from "@/lib/files";

type Entry = { id: string; status: string; quantity: number; acquiredOn: string | null; location: string | null; notes: string | null; photoFileId: string | null };

export function CollectionModal({ itemId, entry, label = "Add to collection" }: { itemId: string; entry?: Entry; label?: string }) {
  return (
    <RecordModal
      title={entry ? "Edit collection entry" : "Add to your collection"}
      triggerLabel={label}
      triggerVariant={entry ? undefined : "soft"}
      edit={!!entry}
      size="md"
      action={saveCollectionEntry}
      fields={COLLECTION_FIELDS}
      defaults={entry ? { ...entry } : { status: "owned", quantity: 1 }}
      hidden={{ itemId, ...(entry ? { id: entry.id } : {}) }}
      imageUrls={{ photo: entry ? fileUrl(entry.photoFileId) : null }}
    />
  );
}
