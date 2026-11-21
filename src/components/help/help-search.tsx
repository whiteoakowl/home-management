"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Search, SearchX, X } from "lucide-react";
import { searchHelp, type SearchDoc } from "@/lib/help";

/** Instant search over the articles this person may read (the list comes from the server). */
export function HelpSearch({ docs, categories, autoFocus }: { docs: SearchDoc[]; categories: Record<string, string>; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const results = useMemo(() => searchHelp(docs, query, 12), [docs, query]);
  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor="help-q" className="sr-only">
          Search help
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="help-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search help (e.g. repeat event)"
          className="h-13 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pr-12 pl-12 text-base shadow-sm outline-none placeholder:text-muted focus:border-primary-500 focus:ring-2 focus:ring-primary-100 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-1.5 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-sunken">
            <X className="size-4" />
          </button>
        )}
      </form>

      {searching && (
        <div aria-live="polite">
          {results.length ? (
            <>
              <p className="mb-2 text-sm text-muted">
                {results.length} {results.length === 1 ? "article" : "articles"}
              </p>
              <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/help/${r.category}/${r.slug}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-sunken">
                      <span className="text-[15px] font-medium text-ink">{r.title}</span>
                      <span className="text-sm text-muted">{r.summary}</span>
                      <span className="text-xs font-medium text-primary-700">{categories[r.category]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-4 py-8 text-center">
              <SearchX className="size-7 text-muted" aria-hidden />
              <p className="font-semibold">No articles match “{query.trim()}”</p>
              <p className="max-w-sm text-sm text-muted">Try a shorter or different word, like “calendar”, “photos” or “password”, or browse the topics below.</p>
              <Link href="/help/troubleshooting/contact-support" className="mt-1 text-sm font-medium text-primary-700 hover:underline">
                Still stuck? Contact support
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
