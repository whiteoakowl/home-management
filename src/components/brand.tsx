import { cn } from "@/lib/utils";

/** Vanderbilt Family Home mark: a house with a leaf growing from the hearth. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#2d0f26" />
      <path d="M10 20.5 20 12l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z" fill="#fffdfb" />
      <path d="M20 30.5v-7c0-2.6 2-4.6 4.8-4.8-.1 2.7-2.2 4.8-4.8 4.8" fill="none" stroke="#8e4e7b" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 30.5v-5c0-1.9-1.5-3.4-3.6-3.6.1 2 1.6 3.6 3.6 3.6" fill="none" stroke="#6d6a3c" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="29.5" cy="11" r="2.5" fill="#c991c4" />
    </svg>
  );
}

export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[20px] font-semibold tracking-tight text-ink">Vanderbilt</span>
        {!compact && <span className="mt-0.5 text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Family Home</span>}
      </span>
    </span>
  );
}
