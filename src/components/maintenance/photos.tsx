import { FileText, X } from "lucide-react";
import { addHomePhotos, deleteHomePhoto } from "@/app/actions/maintenance";
import { FormModal } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { fileUrl } from "@/lib/files";
import { PHOTO_KINDS } from "@/lib/maintenance-config";

type Photo = { id: string; fileId: string; kind: string; caption: string | null; mime?: string | null };

export function AddPhotosModal({ target, kinds = PHOTO_KINDS.map((k) => k.value), defaultKind = "progress" }: { target: { projectId?: string; repairId?: string; roomId?: string }; kinds?: string[]; defaultKind?: string }) {
  return (
    <FormModal title="Add photos" action={addHomePhotos} triggerLabel="Photos" triggerVariant="soft" triggerSize="sm" size="md" submitLabel="Upload">
      {Object.entries(target).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <SelectField name="kind" label="Type" defaultValue={defaultKind} options={PHOTO_KINDS.filter((k) => kinds.includes(k.value))} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        Photos (receipts and plans may be PDFs)
        <input type="file" name="photos" accept="image/*,application/pdf" multiple required className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
      </label>
      <TextField name="caption" label="Caption" />
    </FormModal>
  );
}

/** Photos grouped by kind; before/after shown side by side. */
export function PhotoGallery({ photos, canEdit, empty = "No photos yet." }: { photos: Photo[]; canEdit: boolean; empty?: string }) {
  if (!photos.length) return <p className="text-sm text-muted">{empty}</p>;
  const groups = PHOTO_KINDS.map((k) => ({ ...k, items: photos.filter((p) => p.kind === k.value) })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.value}>
          <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{g.label}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((p) => (
              <li key={p.id} className="relative">
                <a href={fileUrl(p.fileId)!} target="_blank" rel="noreferrer" className="block">
                  {p.mime === "application/pdf" ? (
                    <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl bg-sunken text-sm text-muted">
                      <FileText className="size-8 text-primary-600" aria-hidden /> PDF
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(p.fileId, true)!} alt={p.caption ?? g.label} className="aspect-square w-full rounded-xl bg-sunken object-cover" />
                  )}
                </a>
                {p.caption && <p className="mt-1 truncate text-xs text-muted">{p.caption}</p>}
                {canEdit && (
                  <ActionButton action={deleteHomePhoto} fields={{ id: p.id }} confirm="Delete this photo?" label="Delete photo" className="absolute top-2 right-2 size-8 rounded-full bg-surface/90 text-muted shadow hover:text-wine-500">
                    <X className="size-4" />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

