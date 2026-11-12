import Link from "next/link";
import { cn } from "@/lib/utils";

/** URL-driven tabs (server-rendered, shareable, back-button friendly). */
export function LinkTabs({
  tabs,
  active,
  className,
}: {
  tabs: { href: string; label: string; count?: number; key: string }[];
  active: string;
  className?: string;
}) {
  return (
    <nav className={cn("-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1", className)} aria-label="Sections">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
              on ? "bg-ink text-white" : "bg-surface text-ink-soft ring-1 ring-line hover:bg-sunken",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn("rounded-full px-1.5 text-xs", on ? "bg-white/20" : "bg-sunken text-muted")}>{t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function SegmentLinks({
  items,
  active,
}: {
  items: { href: string; label: string; key: string }[];
  active: string;
}) {
  return (
    <div className="inline-flex rounded-xl bg-sunken p-1" role="group">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === active ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            i.key === active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
