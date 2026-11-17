import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { ArrowLeft, Plane, Printer } from "lucide-react";
import { db } from "@/db";
import { animalHealthRecords, animals, choreChecklistItems, chores, recurrenceRules } from "@/db/schema";
import { AnimalAvatar } from "@/components/farm/animal-avatar";
import { AutoPrint } from "@/components/meals/week-controls";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, daysBetween, formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { occurrencesBetween, type Rule } from "@/lib/recurrence";

export const metadata: Metadata = { title: "Farm vacation instructions" };

const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const long = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });

function age(birth: string, today: string) {
  const d = daysBetween(birth, today);
  if (d < 60) return `${d} days`;
  if (d < 730) return `${Math.round(d / 30)} months`;
  return `${Math.floor(d / 365)} years`;
}

/**
 * Printable instructions for a farm sitter: the dates away, every day's farm
 * chores, and a full profile (care steps, feed, health) for each animal.
 */
export default async function FarmVacationPage({ searchParams }: PageProps<"/farm/vacation">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const all = await db.select().from(animals).where(and(eq(animals.familyId, viewer.family.id), eq(animals.status, "active"))).orderBy(asc(animals.species), asc(animals.name));
  const from = iso(sp.from);
  let to = iso(sp.to);
  const picked = typeof sp.animals === "string" ? sp.animals.split(",") : Array.isArray(sp.animals) ? sp.animals : null;
  const note = typeof sp.note === "string" ? sp.note.slice(0, 2000) : "";

  // Step 1: choose the days and animals.
  if (!from) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/farm" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Farm
        </Link>
        <PageHeader eyebrow="Farm" title="Vacation instructions" description="Print everything a farm sitter needs: each day's chores and a full profile for every animal." />
        <Card>
          <form action="/farm/vacation" className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                First day
                <Input type="date" name="from" required defaultValue={today} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Last day
                <Input type="date" name="to" required defaultValue={addDays(today, 6)} />
              </label>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Animals to include</legend>
              {all.length === 0 && <p className="text-sm text-muted">No active animals yet.</p>}
              <div className="grid gap-1 sm:grid-cols-2">
                {all.map((a) => (
                  <label key={a.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-sunken">
                    <input type="checkbox" name="animals" value={a.id} defaultChecked className="size-4 accent-primary-600" />
                    <AnimalAvatar species={a.species} photoUrl={fileUrl(a.imageFileId, true)} size="sm" />
                    <span className="min-w-0 truncate">
                      {a.name} <span className="text-muted">· {a.headCount > 1 ? `${a.headCount} ${a.species}` : a.species}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Notes for the sitter
              <Textarea name="note" rows={4} placeholder="Our phone numbers, the vet, where the feed and keys are, gate codes…" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="auto" value="print" icon={<Printer className="size-4" />}>
                Print instructions
              </Button>
              <Button type="submit" variant="secondary">
                Preview
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (!to || to < from) to = from;
  if (daysBetween(from, to) > 60) to = addDays(from, 60);
  const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  const chosen = picked ? all.filter((a) => picked.includes(a.id)) : all;
  const ids = chosen.map((a) => a.id);

  const [templates, health] = await Promise.all([
    db
      .select({ chore: chores, rule: recurrenceRules })
      .from(chores)
      .leftJoin(recurrenceRules, eq(recurrenceRules.id, chores.recurrenceRuleId))
      .where(and(eq(chores.familyId, viewer.family.id), eq(chores.kind, "farm"), isNull(chores.archivedAt), isNull(chores.deletedAt)))
      .orderBy(asc(chores.title)),
    ids.length ? db.select().from(animalHealthRecords).where(inArray(animalHealthRecords.animalId, ids)).orderBy(desc(animalHealthRecords.date)) : [],
  ]);
  const checklist = templates.length
    ? await db.select().from(choreChecklistItems).where(inArray(choreChecklistItems.choreId, templates.map((t) => t.chore.id))).orderBy(asc(choreChecklistItems.position))
    : [];
  const itemsOf = Map.groupBy(checklist, (c) => c.choreId);
  const tasksOn = new Map<string, (typeof templates)[number]["chore"][]>();
  for (const { chore, rule } of templates) {
    const dates = rule && rule.enabled ? occurrencesBetween(rule as unknown as Rule, from, to) : chore.dueDate && chore.dueDate >= from && chore.dueDate <= to ? [chore.dueDate] : [];
    for (const d of dates) tasksOn.set(d, [...(tasksOn.get(d) ?? []), chore]);
  }
  const healthOf = Map.groupBy(health, (h) => h.animalId);
  const dueDuring = health.filter((h) => h.nextDueOn && h.nextDueOn >= from && h.nextDueOn <= to);
  const auto = sp.auto === "print";

  return (
    <div className="mx-auto max-w-3xl">
      <AutoPrint when={auto} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/farm/vacation" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Change days or animals
        </Link>
        <PrintButton label="Print instructions" />
      </div>

      {/* Cover */}
      <section className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 print:border-0 print:p-0">
        <p className="flex items-center gap-2 text-sm font-medium tracking-[0.2em] text-primary-600 uppercase">
          <Plane className="size-4" aria-hidden /> The {viewer.family.name} Farm
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Farm care while we&apos;re away</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {long(from)} – {long(to, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {days.length} day{days.length === 1 ? "" : "s"}
        </p>
        {note && <p className="mt-5 rounded-xl border border-line p-4 text-[15px] whitespace-pre-line">{note}</p>}
        <h2 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Animals</h2>
        <ul className="grid gap-1 text-[15px] sm:grid-cols-2">
          {chosen.map((a) => (
            <li key={a.id}>
              {a.name} <span className="text-muted">· {a.headCount > 1 ? `${a.headCount} × ${a.species}` : a.species}{a.groupName ? ` · ${a.groupName}` : ""}</span>
            </li>
          ))}
        </ul>
        {dueDuring.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Care due while we&apos;re away</h2>
            <ul className="text-[15px]">
              {dueDuring.map((h) => (
                <li key={h.id}>
                  {formatShortDate(h.nextDueOn!)}: {chosen.find((a) => a.id === h.animalId)?.name} · {h.kind}
                  {h.description ? ` (${h.description})` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Daily tasks */}
      <section className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 print:border-0 print:p-0">
        <h2 className="text-2xl font-semibold">Daily tasks</h2>
        {chosen.some((a) => a.careSteps.length) && (
          <div className="mt-4 rounded-xl bg-sunken/60 p-4 print:border print:border-line print:bg-transparent">
            <p className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Every day</p>
            {chosen
              .filter((a) => a.careSteps.length)
              .map((a) => (
                <div key={a.id} className="mb-2 last:mb-0">
                  <p className="font-semibold">{a.name}</p>
                  <ol className="ml-5 list-decimal text-[15px]">
                    {a.careSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              ))}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-5">
          {days.map((d) => {
            const list = tasksOn.get(d) ?? [];
            return (
              <div key={d} className="break-inside-avoid">
                <h3 className="border-b border-line pb-1 font-sans text-base font-semibold">{long(d)}</h3>
                {list.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">{chosen.some((a) => a.careSteps.length) ? "Just the everyday care above." : "No scheduled farm chores."}</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {list.map((c) => (
                      <li key={c.id} className="flex gap-3 text-[15px]">
                        <span className="mt-1 size-4 shrink-0 rounded border border-line-strong" aria-hidden />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {c.title}
                            {c.estimatedMinutes ? <span className="font-normal text-muted"> · about {c.estimatedMinutes} min</span> : null}
                          </p>
                          {(c.instructions || c.description) && <p className="text-sm whitespace-pre-line text-ink-soft">{c.instructions ?? c.description}</p>}
                          {(itemsOf.get(c.id) ?? []).length > 0 && (
                            <ul className="ml-4 list-disc text-sm text-ink-soft">
                              {itemsOf.get(c.id)!.map((it) => (
                                <li key={it.id}>{it.text}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Animal profiles, one per page */}
      {chosen.map((a) => {
        const photo = fileUrl(a.imageFileId);
        const facts: [string, string | null][] = [
          ["Type", a.headCount > 1 ? `${a.headCount} × ${a.species}` : a.species],
          ["Breed", a.breed],
          ["Sex", a.sex === "unknown" ? null : a.sex],
          ["Group", a.groupName],
          ["Age", a.birthDate ? age(a.birthDate, today) : null],
          ["Feed", a.feed],
        ];
        const recent = (healthOf.get(a.id) ?? []).slice(0, 4);
        return (
          <section key={a.id} className="print-page mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 print:border-0 print:p-0">
            <div className="flex items-center gap-5">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="size-32 shrink-0 rounded-2xl object-cover" />
              ) : (
                <AnimalAvatar species={a.species} size="xl" />
              )}
              <div>
                <p className="text-sm font-medium text-primary-600">{a.species}</p>
                <h2 className="text-3xl font-semibold">{a.name}</h2>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium tracking-wide text-muted uppercase">{k}</dt>
                    <dd className="text-[15px] capitalize">{v}</dd>
                  </div>
                ))}
            </dl>
            {a.careSteps.length > 0 && (
              <>
                <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Care steps</h3>
                <ol className="ml-5 list-decimal text-[15px]">
                  {a.careSteps.map((s, i) => (
                    <li key={i} className="mb-1">
                      {s}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {a.careInstructions && (
              <>
                <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Instructions &amp; things to know</h3>
                <p className="text-[15px] whitespace-pre-line">{a.careInstructions}</p>
              </>
            )}
            {a.notes && (
              <>
                <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Notes</h3>
                <p className="text-[15px] whitespace-pre-line">{a.notes}</p>
              </>
            )}
            {recent.length > 0 && (
              <>
                <h3 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Health</h3>
                <ul className="text-[15px]">
                  {recent.map((h) => (
                    <Fragment key={h.id}>
                      <li>
                        {formatShortDate(h.date)}: {h.kind}
                        {h.description ? ` · ${h.description}` : ""}
                        {h.nextDueOn ? <span className="text-muted"> (next {formatShortDate(h.nextDueOn)})</span> : null}
                      </li>
                    </Fragment>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
