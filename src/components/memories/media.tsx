import { Download, Heart, Trash2 } from "lucide-react";
import { addMediaComment, deleteMediaComment, toggleFavorite, toggleMediaReaction } from "@/app/actions/memories";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { memberColor } from "@/lib/colors";
import { relativeTime } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { REACTION_EMOJI } from "@/lib/memories";
import { cn } from "@/lib/utils";

/** A photo tile (thumbnail in grids, full size with `controls`). */
export function MediaTile({ fileId, alt, className, controls }: { fileId: string; mediaType?: string; alt: string; className?: string; controls?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fileUrl(fileId, !controls)!} alt={alt} className={cn("size-full object-cover", className)} loading="lazy" />;
}

export const downloadHref = (fileId: string) => `${fileUrl(fileId)!}${fileUrl(fileId)!.includes("?") ? "&" : "?"}download=1`;

type Social = {
  comments: { id: string; entityId: string; body: string; createdAt: Date; memberId: string; name: string; color: string }[];
  reactions: { entityId: string; memberId: string; emoji: string }[];
  favorites: Set<string>;
};

/** Reactions, favorite, download and comments under a photo or memory. */
export function SocialBar({ type, id, social, me, isParent, fileId, compact }: { type: "photo" | "memory"; id: string; social: Social; me: string; isParent: boolean; fileId?: string; compact?: boolean }) {
  const mine = social.reactions.filter((r) => r.entityId === id);
  const fav = social.favorites.has(id);
  const comments = social.comments.filter((c) => c.entityId === id);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {REACTION_EMOJI.map((e) => {
          const n = mine.filter((r) => r.emoji === e).length;
          const me_ = mine.some((r) => r.emoji === e && r.memberId === me);
          return (
            <ActionButton key={e} action={toggleMediaReaction} fields={{ type, entityId: id, emoji: e }} label={`React ${e}`} className={cn("h-8 rounded-full border px-2 text-sm", me_ ? "border-primary-400 bg-primary-50" : n ? "border-line" : "border-transparent opacity-60 hover:opacity-100")}>
              {e}
              {n > 0 && <span className="text-xs tabular-nums">{n}</span>}
            </ActionButton>
          );
        })}
        <span className="flex-1" />
        <ActionButton action={toggleFavorite} fields={{ type, entityId: id }} label={fav ? "Remove from favorites" : "Add to favorites"} className={cn("size-9 rounded-full hover:bg-sunken", fav ? "text-wine-600" : "text-muted")}>
          <Heart className={cn("size-[18px]", fav && "fill-current")} />
        </ActionButton>
        {fileId && (
          <a href={downloadHref(fileId)} download aria-label="Download" title="Download" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken">
            <Download className="size-[18px]" />
          </a>
        )}
      </div>
      {!compact && (
        <>
          {comments.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm">
              {comments.map((c) => (
                <li key={c.id} className="group flex items-start gap-2">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: memberColor(c.color).solid }} aria-hidden />
                  <p className="min-w-0 flex-1">
                    <span className="font-semibold">{c.name.split(" ")[0]}</span> {c.body} <span className="text-xs text-muted">{relativeTime(c.createdAt)}</span>
                  </p>
                  {(c.memberId === me || isParent) && (
                    <ActionButton action={deleteMediaComment} fields={{ id: c.id }} label="Delete comment" className="size-7 rounded-full text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-sunken">
                      <Trash2 className="size-3.5" />
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addMediaComment} submitLabel="Post" className="flex flex-col gap-2" resetOnSuccess>
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="entityId" value={id} />
            <TextField name="body" label="Add a comment" maxLength={1000} placeholder="Say something nice…" />
          </ActionForm>
        </>
      )}
    </div>
  );
}
