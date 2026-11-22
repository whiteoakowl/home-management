import Link from "next/link";
import { Heart } from "lucide-react";
import { Badge, ProgressBar } from "@/components/ui/display";
import { percentRead, STATUS_TONE, statusLabel } from "@/lib/library-config";
import { cn } from "@/lib/utils";
import { BookCover, Stars } from "./book-cover";

type B = {
  id: string;
  title: string;
  author: string | null;
  coverFileId: string | null;
  rating: number | null;
  isFavorite: boolean;
  pageCount: number | null;
  /** The viewer's own reading-log entry, if the book is in their log. */
  reading?: { status: string; currentPage: number | null } | null;
};

/** Cover-first card for grid views and dashboard shelves. */
export function BookCard({ b, compact }: { b: B; compact?: boolean }) {
  const pct = percentRead(b.reading, b.pageCount);
  const status = b.reading?.status;
  return (
    <Link href={`/library/books/${b.id}`} className="group flex min-w-0 flex-col gap-2">
      <div className="relative transition-transform group-hover:-translate-y-0.5">
        <BookCover title={b.title} author={b.author} coverFileId={b.coverFileId} />
        {b.isFavorite && (
          <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Heart className="size-3.5 fill-[#f3c3d2] text-[#f3c3d2]" aria-label="Favorite" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={cn("line-clamp-2 leading-snug font-semibold group-hover:text-primary-700", compact ? "text-sm" : "text-[15px]")}>{b.title}</p>
        {b.author && <p className="truncate text-sm text-muted">{b.author}</p>}
        {!compact && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {status && <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>}
            <Stars value={b.rating} className="text-xs" />
          </div>
        )}
        {status === "reading" && (
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar value={pct} label={`${pct}% read`} />
            <span className="shrink-0 text-xs text-muted tabular-nums">{pct}%</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function BookGrid({ books, compact }: { books: B[]; compact?: boolean }) {
  return (
    // Sized by the space it is given (container queries), so it works in a narrow card or a full page.
    <div className="@container">
      <div className={cn("grid gap-x-4 gap-y-6", compact ? "grid-cols-3 @xl:grid-cols-4 @3xl:grid-cols-6" : "grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6")}>
        {books.map((b) => (
          <BookCard key={b.id} b={b} compact={compact} />
        ))}
      </div>
    </div>
  );
}

/** Table-like row: cover, title, author, categories, status, rating. */
export function BookRow({ b, categories }: { b: B; categories: string[] }) {
  const pct = percentRead(b.reading, b.pageCount);
  const status = b.reading?.status;
  return (
    <li>
      <Link href={`/library/books/${b.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pr-4 hover:border-primary-300">
        <div className="w-11 shrink-0">
          <BookCover title={b.title} author={null} coverFileId={b.coverFileId} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{b.title}</span>
            {b.isFavorite && <Heart className="size-3.5 shrink-0 fill-wine-500 text-wine-500" aria-label="Favorite" />}
          </p>
          <p className="truncate text-sm text-muted">{b.author ?? "Unknown author"}</p>
          {categories.length > 0 && <p className="truncate text-xs text-muted sm:hidden">{categories.join(" · ")}</p>}
        </div>
        <p className="hidden w-48 truncate text-sm text-muted md:block">{categories.join(", ") || "—"}</p>
        <div className="flex w-28 shrink-0 flex-col items-end gap-1 sm:w-36">
          {status && <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>}
          {status === "reading" ? <span className="text-xs text-muted tabular-nums">{pct}% read</span> : <Stars value={b.rating} className="text-xs" />}
        </div>
      </Link>
    </li>
  );
}
