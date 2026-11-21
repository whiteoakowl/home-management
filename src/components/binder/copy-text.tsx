"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

/** A value with a copy button; secrets (passwords) start hidden. */
export function CopyText({ value, secret }: { value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-[14px]">{shown ? value : "••••••••"}</span>
      {secret && (
        <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Hide" : "Show"} className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunken">
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
      <button
        type="button"
        aria-label="Copy"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunken"
      >
        {done ? <Check className="size-4 text-olive-600" /> : <Copy className="size-4" />}
      </button>
    </span>
  );
}
