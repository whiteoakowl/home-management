"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly fallback for unexpected server errors, with a pointer to the setup check. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-wine-50 text-2xl" aria-hidden>
        ⚠️
      </span>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-[15px] text-muted">
        The page couldn&apos;t load. Try again in a moment. If it keeps happening, open the{" "}
        <a href="/api/health" className="font-medium text-primary-700 underline">
          setup check
        </a>
        , which explains common database and setup problems.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => retry()} className="h-11 rounded-xl bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700">
          Try again
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-xl border border-line-strong px-5 font-medium hover:bg-sunken">
          Home
        </Link>
      </div>
      {digest && <p className="font-mono text-xs text-muted">Reference {digest}</p>}
    </main>
  );
}
