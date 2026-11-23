import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { addDays, formatShortDate, zonedToUtc } from "@/lib/dates";
import { weekOn } from "@/lib/pregnancy/dates";
import { appointmentsOf, entriesOf, logsOf, searchPregnancy } from "@/lib/pregnancy/queries";
import { logSummary } from "../../logs";
import { clockOf, dateOf, PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Pregnancy timeline" };

type Row = { key: string; at: Date | null; date: string; type: string; emoji: string; text: string; sub?: string | null; href?: string };
const TYPES = [
  ["all", "Everything"],
  ["appointment", "Appointments"],
  ["health", "Health"],
  ["kicks", "Kicks & contractions"],
  ["journal", "Journal"],
  ["photo", "Photos & docs"],
] as const;

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; type?: string; until?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, tz, today, has } = ctx;
  const type = TYPES.some(([k]) => k === sp.type) ? sp.type! : "all";
  const q = sp.q?.trim().slice(0, 80) || null;
  const until = sp.until && /^\d{4}-\d{2}-\d{2}$/.test(sp.until) && sp.until <= today ? sp.until : today;
  const from = addDays(until, -29);
  const since = zonedToUtc(from, "00:00", tz);
  const before = zonedToUtc(addDays(until, 1), "00:00", tz);
  const base = `/pregnancy/${p.id}`;
  const rows: Row[] = [];
  const allowed = has("timeline");

  if (allowed && q) {
    const r = await searchPregnancy(p.id, q);
    for (const e of r.entries) rows.push({ key: e.id, at: null, date: e.date, type: e.kind, emoji: e.kind === "journal" ? "📔" : e.kind === "photo" ? "📷" : "📄", text: e.title || e.body?.slice(0, 80) || e.kind, sub: e.body?.slice(0, 140), href: `${base}/${e.kind === "journal" ? "journal" : `photos${e.kind === "document" ? "?tab=docs" : ""}`}` });
    for (const i of r.items) rows.push({ key: i.id, at: i.createdAt, date: dateOf(i.createdAt, tz), type: i.kind, emoji: { question: "❓", medication: "💊", name: "💕", checklist: "☑️" }[i.kind], text: i.title, sub: i.notes, href: `${base}/${{ question: "appointments#questions", medication: "care", name: "names", checklist: "prepare" }[i.kind]}` });
    for (const l of r.logs) rows.push({ key: l.id, at: l.startedAt, date: dateOf(l.startedAt, tz), type: l.kind, emoji: "📝", text: logSummary(l) ?? l.kind, sub: l.notes });
    for (const a of r.appts) rows.push({ key: a.id, at: a.startsAt, date: dateOf(a.startsAt, tz), type: "appointment", emoji: "🩺", text: a.title.replace(/^🤰\s*/, ""), sub: a.results ?? a.notes, href: `${base}/appointments` });
  } else if (allowed) {
    const want = (t: string) => type === "all" || type === t;
    const [logs, entries, appts] = await Promise.all([
      want("health") || want("kicks") ? logsOf(p.id, type === "kicks" ? ["kicks", "contractions"] : type === "health" ? ["symptom", "mood", "weight", "measure", "sleep"] : ["symptom", "mood", "weight", "measure", "sleep", "kicks", "contractions"], { since, before, limit: 300 }) : [],
      want("journal") || want("photo") ? entriesOf(p.id, type === "journal" ? ["journal"] : type === "photo" ? ["photo", "document"] : ["journal", "photo", "document"], { limit: 200 }).then((xs) => xs.filter((e) => e.date >= from && e.date <= until)) : [],
      want("appointment") ? appointmentsOf(p.id, { from: since, to: before, order: "desc" }) : [],
    ]);
    for (const l of logs) rows.push({ key: l.id, at: l.startedAt, date: dateOf(l.startedAt, tz), type: l.kind, emoji: { kicks: "👣", contractions: "⏱️", symptom: "🤒", mood: "😊", weight: "⚖️", measure: "🩺", sleep: "😴" }[l.kind as string] ?? "📝", text: logSummary(l) ?? "", sub: l.notes });
    for (const e of entries) rows.push({ key: e.id, at: null, date: e.date, type: e.kind, emoji: e.kind === "journal" ? "📔" : e.kind === "photo" ? "📷" : "📄", text: e.title || (e.kind === "journal" ? e.body?.slice(0, 80) : e.category) || e.kind, sub: e.kind === "journal" ? e.body?.slice(0, 140) : null, href: `${base}/${e.kind === "journal" ? "journal" : `photos${e.kind === "document" ? "?tab=docs" : ""}`}` });
    for (const a of appts) rows.push({ key: a.id, at: a.startsAt, date: dateOf(a.startsAt, tz), type: "appointment", emoji: "🩺", text: a.title.replace(/^🤰\s*/, ""), sub: [a.provider, a.results].filter(Boolean).join(" · "), href: `${base}/appointments` });
  }
  rows.sort((a, b) => (a.date === b.date ? (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0) : a.date < b.date ? 1 : -1));
  const byDay = new Map<string, Row[]>();
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);

  return (
    <>
      <PregnancyHeader ctx={ctx} active="timeline" />
      {!allowed && <PremiumLocked f="timeline" />}
      <form role="search" className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search everything in this pregnancy" maxLength={80} className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-sm sm:max-w-sm" aria-label="Search" />
        <button className="h-10 rounded-xl bg-sunken px-3 text-sm font-medium ring-1 ring-line">Search</button>
      </form>
      {!q && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TYPES.map(([k, l]) => (
            <Link key={k} href={`?type=${k}`} className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-line ${type === k ? "bg-ink text-white" : "bg-surface"}`}>
              {l}
            </Link>
          ))}
        </div>
      )}
      {q && (
        <p className="mb-3 text-sm text-muted">
          {rows.length} result{rows.length === 1 ? "" : "s"} for “{q}”. <Link href="?" className="text-primary-600">Clear</Link>
        </p>
      )}
      {byDay.size ? (
        <ol className="flex flex-col gap-4">
          {[...byDay.entries()].map(([d, rs]) => {
            const w = weekOn(p.dueDate, d);
            return (
              <li key={d}>
                <h2 className="mb-1.5 text-sm font-semibold text-muted">
                  {formatShortDate(d)}
                  {w ? ` · Week ${w}` : ""}
                </h2>
                <Card className="p-3 sm:p-4">
                  <ul className="divide-y divide-line">
                    {rs.map((r) => {
                      const body = (
                        <>
                          <span className="text-lg" aria-hidden>
                            {r.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{r.text}</span>
                            {r.sub && <span className="block truncate text-sm text-muted">{r.sub}</span>}
                          </span>
                          {r.at && <span className="shrink-0 text-xs text-muted">{clockOf(r.at, tz)}</span>}
                        </>
                      );
                      return (
                        <li key={r.key}>
                          {r.href ? (
                            <Link href={r.href} className="flex items-center gap-3 py-2 hover:bg-sunken">
                              {body}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 py-2">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <Card>
          <p className="text-sm text-muted">{q ? "Nothing found." : `Nothing between ${formatShortDate(from)} and ${formatShortDate(until)}.`}</p>
        </Card>
      )}
      {!q && allowed && (
        <div className="mt-4 flex justify-between text-sm">
          <Link href={`?type=${type}&until=${addDays(from, -1)}`} className="font-medium text-primary-600">
            ← Earlier
          </Link>
          {until < today && (
            <Link href={`?type=${type}&until=${addDays(until, 30) > today ? today : addDays(until, 30)}`} className="font-medium text-primary-600">
              Later →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
