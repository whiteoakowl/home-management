import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cleanNow } from "@/app/actions/chores";
import { ActionButton } from "@/components/forms/inline";
import { ProgressRing } from "@/components/ui/display";
import type { ChoreTemplate } from "@/lib/chores";
import { condition, conditionLabel, intervalDays } from "@/lib/cleanliness";
import { cn } from "@/lib/utils";

const BAR = { primary: "bg-primary-500", olive: "bg-olive-500", wine: "bg-wine-500" };

/** Room-by-room cleanliness: each task's meter drains between cleanings. */
export function CleanlinessBoard({ templates, today, canLog }: { templates: ChoreTemplate[]; today: string; canLog: boolean }) {
  const rows = templates.map((t) => {
    const c = condition(t.lastDone, intervalDays(t.rule, t.chore.cleaningCadence), today);
    return { t, c, l: conditionLabel(c) };
  });
  if (!rows.length) return null;
  const rooms = [...Map.groupBy(rows, (r) => r.t.roomName ?? "Whole house").entries()]
    .map(([room, items]) => ({ room, items: items.sort((a, b) => a.c - b.c), score: items.reduce((s, x) => s + x.c, 0) / items.length }))
    .sort((a, b) => a.score - b.score);
  const overall = rows.reduce((s, r) => s + r.c, 0) / rows.length;
  return (
    <section className="mb-8" aria-labelledby="cleanliness">
      <div className="mb-3 flex items-center gap-4">
        <ProgressRing value={Math.round(overall * 100)} size={56}>
          {Math.round(overall * 100)}%
        </ProgressRing>
        <div>
          <h2 id="cleanliness" className="text-xl font-semibold">
            How clean is the house?
          </h2>
          <p className="text-sm text-muted">Each bar empties as a task&apos;s next cleaning gets closer. Rooms that need the most love are first.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.map(({ room, items, score }) => (
          <article key={room} className="rounded-2xl border border-line bg-surface p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{room}</h3>
              <span className={cn("text-sm font-semibold", score >= 0.66 ? "text-primary-700" : score >= 0.33 ? "text-olive-700" : "text-wine-600")}>{Math.round(score * 100)}%</span>
            </header>
            <ul className="flex flex-col gap-2.5">
              {items.map(({ t, c, l }) => (
                <li key={t.chore.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <Link href={`/house/chores/${t.chore.id}`} className="truncate font-medium hover:underline">
                        {t.chore.title}
                      </Link>
                      <span className="shrink-0 text-xs text-muted">{l.label}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c * 100)} aria-label={`${t.chore.title} cleanliness`}>
                      <div className={cn("h-full rounded-full", BAR[l.tone])} style={{ width: `${Math.max(3, c * 100)}%` }} />
                    </div>
                  </div>
                  {canLog && c < 0.95 && (
                    <ActionButton action={cleanNow} fields={{ id: t.chore.id }} label={`Mark ${t.chore.title} clean now`} className="size-8 shrink-0 rounded-full text-primary-600 hover:bg-primary-50">
                      <Sparkles className="size-4" />
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
