import Link from "next/link";
import { Avatar } from "@/components/ui/display";
import { cn } from "@/lib/utils";

/** "Me / people who share with me" switcher for personal areas. Hidden when only the viewer is available. */
export function PersonalSwitcher({ subjects, current, base }: { subjects: { id: string; displayName: string; color: string }[]; current: string; base: string }) {
  if (subjects.length < 2) return null;
  return (
    <nav aria-label="Whose records" className="-mt-2 mb-1 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Viewing</span>
      {subjects.map((s, i) => (
        <Link
          key={s.id}
          href={i === 0 ? base : `${base}?member=${s.id}`}
          aria-current={s.id === current ? "page" : undefined}
          className={cn("inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1 text-sm", s.id === current ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}
        >
          <Avatar name={s.displayName} color={s.color} size="sm" />
          {i === 0 ? "Me" : s.displayName}
        </Link>
      ))}
    </nav>
  );
}
