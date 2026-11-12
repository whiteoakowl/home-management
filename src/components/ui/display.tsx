import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";
import { memberColor, onSolid } from "@/lib/colors";

// ─── Badge ───────────────────────────────────────────────────────────────────

type Tone = "neutral" | "primary" | "olive" | "wine" | "mist";
const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-soft",
  primary: "bg-primary-50 text-primary-700",
  olive: "bg-olive-50 text-olive-700",
  wine: "bg-wine-50 text-wine-700",
  mist: "bg-mist-50 text-mist-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

const avatarSizes = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

export function Avatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  const c = memberColor(color);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface", avatarSizes[size], className)}
      style={{ backgroundColor: c.solid, color: onSolid(color) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ members, max = 4 }: { members: { id: string; displayName: string; color: string }[]; max?: number }) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <span className="flex -space-x-2">
      {shown.map((m) => (
        <Avatar key={m.id} name={m.displayName} color={m.color} size="sm" />
      ))}
      {rest > 0 && (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-sunken text-xs font-semibold text-ink-soft ring-2 ring-surface">
          +{rest}
        </span>
      )}
    </span>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────

export function ProgressBar({ value, max = 100, label, tone = "primary" }: { value: number; max?: number; label?: string; tone?: "primary" | "olive" | "wine" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { primary: "bg-primary-500", olive: "bg-olive-500", wine: "bg-wine-500" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProgressRing({ value, max = 100, size = 56, children }: { value: number; max?: number; size?: number; children?: ReactNode }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={6} className="stroke-sunken" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={6}
          strokeLinecap="round"
          className="stroke-primary-500 transition-[stroke-dashoffset] duration-700"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-ink">{children}</span>
    </span>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  example,
  compact,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  example?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-2 py-4" : "gap-3 py-10")}>
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-primary-50 to-olive-50 text-primary-600",
          compact ? "size-11 [&>svg]:size-5" : "size-16 [&>svg]:size-7",
        )}
      >
        {icon}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn("font-semibold text-ink", compact ? "text-[15px]" : "font-display text-xl")}>{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {example && <div className="mt-1 text-sm text-muted italic">{example}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        {eyebrow && <p className="text-sm font-medium text-primary-600">{eyebrow}</p>}
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">{title}</h1>
        {description && <p className="max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
