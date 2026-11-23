import type { Metadata } from "next";
import Link from "next/link";
import { quickPregnancyLog } from "@/app/actions/pregnancy";
import { ActionButton } from "@/components/forms/inline";
import { BirthModal, EntryModal, PregnancyLogModal } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { formatShortDate, zonedToUtc } from "@/lib/dates";
import { CALL_PROVIDER, CHECKLISTS, SEVERITY } from "@/lib/pregnancy/catalog";
import { weekContent } from "@/lib/pregnancy/data";
import { appointmentsOf, entriesOf, itemsOf, logsOf, pregnancyCounts } from "@/lib/pregnancy/queries";
import { lengthText, URGENT_NOTE, weightText } from "@/lib/pregnancy/weeks";
import { EducationNote, PregnancyHeader, pregnancyContext, ProgressVisual, whenOf } from "../shared";

export const metadata: Metadata = { title: "Pregnancy" };

const big = "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border border-line bg-surface px-2 py-2 text-center text-sm font-medium hover:border-primary-300 hover:bg-sunken";

export default async function PregnancyDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { viewer, p, g, tz, today, now, nowDate, can } = ctx;
  const dayStart = zonedToUtc(today, "00:00", tz);
  const weekAgo = new Date(dayStart.getTime() - 6 * 86_400_000);
  const [wk, appts, recent, todayLogs, meds, counts, journal] = await Promise.all([
    g ? weekContent(g.week) : null,
    appointmentsOf(p.id, { from: new Date(nowDate.getTime() - 2 * 3600_000), limit: 3 }),
    logsOf(p.id, ["symptom", "mood", "weight", "kicks", "contractions"], { since: weekAgo, limit: 60 }),
    logsOf(p.id, ["hydration", "dose"], { since: dayStart, limit: 100 }),
    itemsOf(p.id, "medication"),
    pregnancyCounts(p.id),
    entriesOf(p.id, ["journal"], { limit: 1 }),
  ]);
  const symptoms = recent.filter((l) => l.kind === "symptom").slice(0, 4);
  const mood = recent.find((l) => l.kind === "mood");
  const weight = recent.find((l) => l.kind === "weight");
  const kicks = recent.find((l) => l.kind === "kicks");
  const water = todayLogs.filter((l) => l.kind === "hydration").reduce((s, l) => s + Number(l.amount ?? 1), 0);
  const dosesToday = new Set(todayLogs.filter((l) => l.kind === "dose").map((l) => String(l.data.itemId)));
  const activeMeds = meds.filter((m) => !m.done);
  const prepOpen = g && g.week >= 28 ? CHECKLISTS.filter((c) => c.area === "third" && (c.fromWeek ?? 0) <= g.week) : [];
  const alert = symptoms.some((l) => Number(l.data.severity) >= 4 || CALL_PROVIDER.test(String(l.data.symptom ?? "")));
  const ended = p.status === "born" || p.status === "completed";

  return (
    <>
      <PregnancyHeader ctx={ctx} active="dashboard" />

      {p.status === "born" && p.outcome && (
        <Card className="mb-4 border-olive-200 bg-olive-50">
          <p className="text-lg font-semibold">🎉 Born {p.outcome.date ? formatShortDate(p.outcome.date) : ""}{p.outcome.time ? ` at ${p.outcome.time}` : ""}</p>
          <p className="text-sm text-muted">{[p.outcome.location, p.outcome.weight, p.outcome.length].filter(Boolean).join(" · ")}</p>
          {(p.outcome.babyIds ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(p.outcome.babyIds ?? []).map((b) => (
                <Link key={b} href={`/baby/${b}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  Open Baby tracker →
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {g && wk && !ended && (
        <Card className="mb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary-50 text-5xl" aria-hidden>
              {wk.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary-600">Week {g.week} · Trimester {g.trimester}</p>
              <p className="text-xl font-semibold">About the size of {wk.size}</p>
              <p className="text-sm text-muted">{[lengthText(wk.lengthCm), weightText(wk.weightG)].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-[15px]">{wk.baby}</p>
            </div>
          </div>
          <div className="mt-4">
            <ProgressVisual g={g} dueDate={p.dueDate!} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <EducationNote />
            <Link href={`/pregnancy/${p.id}/weeks?w=${g.week}`} className="text-sm font-medium text-primary-600 hover:underline">
              This week in detail →
            </Link>
          </div>
        </Card>
      )}

      {alert && <p className="mb-4 rounded-2xl border border-wine-100 bg-wine-50 px-4 py-3 text-sm text-wine-700">⚠️ You logged a severe or important symptom recently. {URGENT_NOTE}</p>}

      {prepOpen.length > 0 && !ended && (
        <Link href={`/pregnancy/${p.id}/prepare`} className="mb-4 block rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-[15px]">
          🎒 Third trimester: time for {prepOpen.map((c) => c.title.toLowerCase()).join(" and ")} →
        </Link>
      )}

      {can("tracker") && !ended && (
        <Card className="mb-4">
          <CardHeader title="Log" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <PregnancyLogModal pregnancyId={p.id} kind="symptom" now={now} triggerClassName={big} triggerContent={<><span className="text-xl" aria-hidden>🤒</span>Symptom</>} />
            <PregnancyLogModal pregnancyId={p.id} kind="mood" now={now} triggerClassName={big} triggerContent={<><span className="text-xl" aria-hidden>😊</span>Mood</>} />
            <PregnancyLogModal pregnancyId={p.id} kind="weight" now={now} triggerClassName={big} triggerContent={<><span className="text-xl" aria-hidden>⚖️</span>Weight</>} />
            <Link href={`/pregnancy/${p.id}/kicks`} className={big}>
              <span className="text-xl" aria-hidden>👣</span>Kick count
            </Link>
            <Link href={`/pregnancy/${p.id}/contractions`} className={big}>
              <span className="text-xl" aria-hidden>⏱️</span>Contractions
            </Link>
            {can("journal") ? (
              <EntryModal pregnancyId={p.id} kind="journal" now={now} triggerClassName={big} triggerContent={<><span className="text-xl" aria-hidden>📔</span>Journal</>} />
            ) : (
              <Link href={`/pregnancy/${p.id}/journal`} className={big}>
                <span className="text-xl" aria-hidden>📔</span>Journal
              </Link>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming appointments" href={`/pregnancy/${p.id}/appointments`} />
          {appts.length ? (
            <ul className="flex flex-col gap-2">
              {appts.map((a) => (
                <li key={a.id} className="text-[15px]">
                  <span className="font-medium">{a.title.replace(/^🤰\s*/, "")}</span>
                  <span className="block text-sm text-muted">{[whenOf(a.startsAt, tz), a.provider, a.location].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing booked. Add appointments and they&apos;ll show on the family calendar too.</p>
          )}
          {counts.openQuestions > 0 && (
            <Link href={`/pregnancy/${p.id}/appointments#questions`} className="mt-3 block text-sm font-medium text-primary-600 hover:underline">
              ❓ {counts.openQuestions} question{counts.openQuestions === 1 ? "" : "s"} to ask →
            </Link>
          )}
        </Card>

        <Card>
          <CardHeader title="This week" href={`/pregnancy/${p.id}/health`} hrefLabel="Health" />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Mood</dt>
              <dd className="font-medium">{mood ? `${["", "Low", "Meh", "OK", "Good", "Great"][Number(mood.data.mood)] ?? "Logged"} · ${whenOf(mood.startedAt, tz)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Weight</dt>
              <dd className="font-medium">{weight ? `${Number(weight.amount)} ${String(weight.data.unit ?? "lb")}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Last kick count</dt>
              <dd className="font-medium">{kicks ? `${kicks.amount} in ${Math.max(1, Math.round(((kicks.endedAt ?? kicks.startedAt).getTime() - kicks.startedAt.getTime()) / 60_000))} min` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Water today</dt>
              <dd className="flex items-center gap-2 font-medium">
                {water} glass{water === 1 ? "" : "es"}
                {can("nutrition") && !ended && (
                  <ActionButton action={quickPregnancyLog} fields={{ pregnancyId: p.id, kind: "hydration" }} className="h-8 rounded-lg bg-sunken px-2 text-xs ring-1 ring-line hover:bg-primary-50" label="Add a glass of water">
                    +1 💧
                  </ActionButton>
                )}
              </dd>
            </div>
          </dl>
          {symptoms.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {symptoms.map((l) => (
                <li key={l.id} className="rounded-full bg-sunken px-2.5 py-1 text-xs">
                  {String(l.data.symptom)} · {SEVERITY.find((s) => s.value === Number(l.data.severity))?.label}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {activeMeds.length > 0 && (
          <Card>
            <CardHeader title="Medicines & supplements" href={`/pregnancy/${p.id}/care`} />
            <ul className="flex flex-col gap-2">
              {activeMeds.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[15px]">
                  <span>
                    {m.title}
                    <span className="block text-xs text-muted">{[m.data.dose, m.data.schedule].filter(Boolean).map(String).join(" · ")}</span>
                  </span>
                  {dosesToday.has(m.id) ? (
                    <span className="text-sm text-olive-700">✓ Taken today</span>
                  ) : can("medications") && !ended ? (
                    <ActionButton action={quickPregnancyLog} fields={{ pregnancyId: p.id, kind: "dose", itemId: m.id }} className="h-9 rounded-lg bg-sunken px-3 text-sm ring-1 ring-line hover:bg-primary-50">
                      Mark taken
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader title="Getting ready" href={`/pregnancy/${p.id}/prepare`} />
          <p className="text-sm text-muted">
            {counts.checklistAll ? `${counts.checklistAll - counts.checklistOpen} of ${counts.checklistAll} checklist items done.` : "Nursery, feeding, the hospital bag and more: add starter lists in Prepare."}
          </p>
          <p className="mt-2 text-sm text-muted">{counts.names ? `${counts.names} baby name${counts.names === 1 ? "" : "s"} on your list.` : ""}</p>
          {journal[0] && (
            <p className="mt-3 text-sm">
              📔 Last journal entry: <Link href={`/pregnancy/${p.id}/journal`} className="font-medium text-primary-600 hover:underline">{journal[0].title || formatShortDate(journal[0].date)}</Link>
            </p>
          )}
        </Card>
      </div>

      {ctx.canEdit && p.status === "active" && g && g.week >= 20 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <BirthModal pregnancyId={p.id} now={now} babyCount={p.babyCount} babyName={p.babyNickname} isParent={viewer.isParent} canBaby={viewer.can("baby", "use")} location={p.hospital ?? p.birthLocation} />
          <span className="text-sm text-muted">Record the birth and hand off to the Baby tracker.</span>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{URGENT_NOTE}</p>
    </>
  );
}
