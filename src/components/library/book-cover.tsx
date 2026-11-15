import { cn } from "@/lib/utils";

const SPINES = [
  ["#2d0f26", "#6a2d5e"],
  ["#1f2a44", "#3c5a7a"],
  ["#3f3f1e", "#6d6a3c"],
  ["#4d1c2b", "#94505f"],
  ["#2a2a24", "#5a5548"],
  ["#3a2a52", "#6b5b9a"],
  ["#1d3a35", "#3f6b5f"],
] as const;

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * A book's cover: the photo or downloaded cover when there is one, otherwise a
 * typographic cover (title & author on a cloth-coloured board) so shelves
 * never look empty.
 */
export function BookCover({ title, author, coverFileId, className, large }: { title: string; author?: string | null; coverFileId?: string | null; className?: string; large?: boolean }) {
  const src = coverFileId ? `/api/files/${coverFileId}` : null;
  const base = cn("relative aspect-[2/3] w-full overflow-hidden rounded-r-lg rounded-l-sm shadow-[0_1px_2px_rgb(0_0_0/0.12),0_8px_20px_-8px_rgb(45_15_38/0.35)]", className);
  if (src) {
    return (
      <div className={cn(base, "bg-sunken")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Cover of ${title}`} loading="lazy" className="size-full object-cover" />
        <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/25 to-transparent" aria-hidden />
      </div>
    );
  }
  const [a, b] = SPINES[hash(title) % SPINES.length]!;
  return (
    <div className={cn(base, "flex flex-col justify-between p-[9%] text-[#fbf6ee]")} style={{ background: `linear-gradient(160deg, ${b}, ${a})` }} role="img" aria-label={`Cover of ${title}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/30 to-transparent" aria-hidden />
      <span className="pointer-events-none absolute inset-[6%] rounded-sm border border-[#e0c27e]/40" aria-hidden />
      <span className={cn("relative font-display leading-tight font-semibold [overflow-wrap:anywhere]", large ? "line-clamp-6 text-2xl" : "line-clamp-5 text-[13px] sm:text-sm")}>{title}</span>
      {author && <span className={cn("relative truncate text-[#e0c27e]", large ? "text-sm" : "text-[10px] sm:text-[11px]")}>{author}</span>}
    </div>
  );
}

export function Stars({ value, className }: { value: number | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn("inline-flex text-[#c9a24e]", className)} aria-label={`${value} out of 5 stars`} title={`${value} of 5`}>
      {"★".repeat(value)}
      <span className="text-line-strong">{"★".repeat(5 - value)}</span>
    </span>
  );
}
