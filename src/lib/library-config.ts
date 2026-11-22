/** Book Library labels shared by server and client code. */
/** Reading-log statuses (a book that isn't in someone's log simply has no entry). */
export const READING_STATUSES = [
  { value: "want_to_read", label: "Want to Read" },
  { value: "reading", label: "Reading" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Finished" },
  { value: "abandoned", label: "Stopped" },
] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number]["value"];
export const STATUS_VALUES = READING_STATUSES.map((s) => s.value) as readonly string[];
export const statusLabel = (v: string | null | undefined) => READING_STATUSES.find((s) => s.value === v)?.label ?? "Not in my reading log";
export const STATUS_TONE: Record<string, "neutral" | "primary" | "olive" | "wine" | "mist"> = {
  want_to_read: "mist",
  reading: "primary",
  paused: "olive",
  completed: "olive",
  abandoned: "wine",
};

export const BOOK_FORMATS = [
  { value: "hardcover", label: "Hardcover" },
  { value: "paperback", label: "Paperback" },
  { value: "ebook", label: "eBook" },
  { value: "audiobook", label: "Audiobook" },
  { value: "other", label: "Other" },
] as const;
export const formatLabel = (v: string | null | undefined) => BOOK_FORMATS.find((s) => s.value === v)?.label ?? null;

export const LIBRARY_VIEWS = [
  { key: "grid", label: "Grid" },
  { key: "list", label: "List" },
  { key: "category", label: "By category" },
  { key: "author", label: "By author" },
  { key: "status", label: "By my reading status" },
] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number]["key"];

export const LIBRARY_SORTS = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "recent", label: "Recently added" },
  { value: "rating", label: "Rating" },
  { value: "progress", label: "Progress" },
] as const;

/** How far through a book a reading-log entry is (0–100). */
export function percentRead(entry: { currentPage: number | null; status: string } | null | undefined, pageCount: number | null) {
  if (!entry) return 0;
  if (entry.status === "completed") return 100;
  if (!pageCount || !entry.currentPage) return 0;
  return Math.max(0, Math.min(100, Math.round((entry.currentPage / pageCount) * 100)));
}
