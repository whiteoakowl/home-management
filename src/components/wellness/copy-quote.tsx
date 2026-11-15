"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

/** Share a quote with the phone's share sheet, or copy it. */
export function CopyQuote({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            setDone(true);
          }
        } catch {
          /* cancelled */
        }
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken"
    >
      <Share2 className="size-4" /> {done ? "Copied" : "Share"}
    </button>
  );
}
