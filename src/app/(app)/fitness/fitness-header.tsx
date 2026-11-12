import Link from "next/link";
import { Avatar } from "@/components/ui/display";
import { LinkTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function FitnessNav({ active, subjectId, members, isParent }: { active: string; subjectId: string; members: { id: string; displayName: string; color: string }[]; isParent: boolean }) {
  const q = `?member=${subjectId}`;
  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <LinkTabs className="mb-0" active={active} tabs={[{ key: "overview", href: `/fitness${q}`, label: "Workouts" }, { key: "food", href: `/fitness/food${q}`, label: "Food journal" }]} />
      {isParent && (
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-sm text-muted">Viewing</span>
          {members.map((m) => (
            <Link key={m.id} href={`/fitness${active === "food" ? "/food" : ""}?member=${m.id}`} title={m.displayName} className={cn("rounded-full p-0.5", m.id === subjectId ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100")}>
              <Avatar name={m.displayName} color={m.color} size="sm" />
              <span className="sr-only">{m.displayName}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
