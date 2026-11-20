import { Camera, Images, Trash2 } from "lucide-react";
import { addAlbumPhotos, deleteAlbumPhoto } from "@/app/actions/photos";
import { FormModal } from "@/components/forms/action-form";
import { PhotosField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";

type Photo = { id: string; caption: string | null; thumb: string; full: string; mine: boolean };

/** A photo album card: grid of photos, "Add photos" (several at once), remove. */
export function PhotoAlbum({ kind, entityId, photos, canAdd, canRemoveAll, title = "Photos" }: { kind: "animal" | "plant" | "member"; entityId: string; photos: Photo[]; canAdd: boolean; canRemoveAll: boolean; title?: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader
        title={title}
        icon={<Images className="size-4" />}
        action={
          canAdd ? (
            <FormModal title="Add photos" action={addAlbumPhotos} refreshOnSuccess triggerLabel="Add photos" triggerIcon={<Camera className="size-4" />} triggerVariant="secondary" size="sm" submitLabel="Upload">
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="entityId" value={entityId} />
              <PhotosField name="photos" label="Photos" required />
              <TextField name="caption" label="Caption (optional)" />
            </FormModal>
          ) : undefined
        }
      />
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              <a href={p.full} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.caption ?? ""} className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
              </a>
              {p.caption && <p className="mt-1 truncate text-xs text-muted">{p.caption}</p>}
              {(canRemoveAll || p.mine) && (
                <ActionButton action={deleteAlbumPhoto} fields={{ id: p.id }} confirm="Remove this photo?" label="Remove photo" className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-surface/90 text-muted shadow hover:text-wine-500">
                  <Trash2 className="size-4" />
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{canAdd ? "No photos yet. Add a few to build an album." : "No photos yet."}</p>
      )}
    </Card>
  );
}
