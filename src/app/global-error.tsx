"use client";

/** Last-resort error page (replaces the root layout, so styles are inline). */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f6f3ef", color: "#2d0f26", fontFamily: "system-ui, sans-serif" }}>
        <title>Something went wrong · Vanderbilt Family</title>
        <main style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26 }}>Something went wrong</h1>
          <p style={{ color: "#6b5d68", lineHeight: 1.5 }}>
            The app couldn&apos;t load. Try again in a moment. If it keeps happening, open the{" "}
            <a href="/api/health" style={{ color: "#6a2d5e" }}>
              setup check
            </a>
            .
          </p>
          <button type="button" onClick={() => retry()} style={{ font: "600 16px system-ui", padding: "12px 22px", border: 0, borderRadius: 12, background: "#6a2d5e", color: "#fff" }}>
            Try again
          </button>
          {digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#6b5d68" }}>Reference {digest}</p>}
        </main>
      </body>
    </html>
  );
}
