/** Book Library labels shared by server and client code. */
export const READING_STATUSES = [
  { value: "want_to_read", label: "Want to Read" },
  { value: "not_started", label: "Not Started" },
  { value: "reading", label: "Reading" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number]["value"];
export const STATUS_VALUES = READING_STATUSES.map((s) => s.value) as readonly string[];
export const statusLabel = (v: string | null | undefined) => READING_STATUSES.find((s) => s.value === v)?.label ?? "Not Started";
export const STATUS_TONE: Record<string, "neutral" | "primary" | "olive" | "wine" | "mist"> = {
  want_to_read: "mist",
  not_started: "neutral",
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
  { key: "status", label: "By status" },
] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number]["key"];

export const LIBRARY_SORTS = [
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "recent", label: "Recently added" },
  { value: "rating", label: "Rating" },
  { value: "progress", label: "Progress" },
] as const;

export function percentRead(b: { currentPage: number | null; pageCount: number | null; status: string }) {
  if (b.status === "completed") return 100;
  if (!b.pageCount || !b.currentPage) return 0;
  return Math.max(0, Math.min(100, Math.round((b.currentPage / b.pageCount) * 100)));
}
