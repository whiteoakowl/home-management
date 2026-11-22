import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { BookOpen, CalendarHeart, CheckCircle2, HandHeart, NotebookPen, Sparkles, Sun } from "lucide-react";
import { db } from "@/db";
import { faithEntries, faithPracticeLogs, faithPrayers, faithReadingLogs } from "@/db/schema";
import { FaithSubTabs } from "@/components/faith/tabs";
import { PracticeCheck } from "@/components/faith/practice-check";
import { fmtDate } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, daysBetween, todayIn, tzOffset } from "@/lib/dates";
import { familyHolidays, practicesFor, streak, textsFor } from "@/lib/faith";
import { ekadashis, hebrewLabel, liturgicalSeason, omerDay, panchang, rosaryMysteries, saintsOn, uposathaDays } from "@/lib/faith-calendar";
import { BUDDHIST_PRECEPTS, FAITH_META, isFaith, sectionName, wordOfDay, type Faith } from "@/lib/faith-config";

export const metadata: Metadata = { title: "Spiritual" };

const SEASON_DOT: Record<string, string> = { purple: "#6b3fa0", white: "#e8e2d0", green: "#3f7d3a", red: "#b3261e" };
const PHASE = { new: "🌑 New moon", first_quarter: "🌓 First quarter", full: "🌕 Full moon", last_quarter: "🌗 Last quarter" } as const;

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export default async function FaithToday({ params }: PageProps<"/spiritual/faith/[faith]">) {
  const { faith: raw } = await params;
  if (!isFaith(raw)) redirect("/spiritual");
  const faith: Faith = raw;
  if (faith === "spiritual") redirect("/spiritual");
  const viewer = await getViewer();
  const meta = FAITH_META[faith];
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const me = viewer.member.id;
  const base = `/spiritual/faith/${faith}`;

  const [practices, logs, prayers, entries, reads, texts, holidays] = await Promise.all([
    practicesFor(viewer, faith),
    db.select().from(faithPracticeLogs).where(and(eq(faithPracticeLogs.memberId, me), gte(faithPracticeLogs.date, addDays(today, -400)))),
    db.select().from(faithPrayers).where(and(eq(faithPrayers.memberId, me), eq(faithPrayers.faith, faith), isNull(faithPrayers.answeredOn))).orderBy(desc(faithPrayers.createdAt)),
    db.select().from(faithEntries).where(and(eq(faithEntries.memberId, me), eq(faithEntries.faith, faith))).orderBy(desc(faithEntries.date), desc(faithEntries.createdAt)).limit(3),
    db.select().from(faithReadingLogs).where(eq(faithReadingLogs.memberId, me)).orderBy(desc(faithReadingLogs.createdAt)),
    textsFor(viewer, faith),
    familyHolidays(viewer.family.id, [faith], today, addDays(today, 400)),
  ]);
  const active = practices.filter((p) => p.active);
  const doneToday = new Set(logs.filter((l) => l.date === today).map((l) => l.practiceId));
  const anyDays = new Set(logs.filter((l) => active.some((p) => p.id === l.practiceId)).map((l) => l.date));
  const dayStreak = streak(anyDays, today);
  const word = wordOfDay(faith, today);

  // Reading: the text read most recently, and overall progress for the main book.
  const keys = new Set(texts.map((t) => t.key));
  const myReads = reads.filter((r) => keys.has(r.textKey));
  const last = myReads[0] ? texts.find((t) => t.key === myReads[0]!.textKey) : undefined;
  const readOf = (key: string) => new Set(myReads.filter((r) => r.textKey === key).map((r) => r.section));
  const lastRead = last ? readOf(last.key) : new Set<number>();
  const nextSection = last ? Array.from({ length: last.sections }, (_, i) => i + 1).find((n) => !lastRead.has(n)) : undefined;
  const bibleTotal = faith === "christian" ? texts.filter((t) => t.key.startsWith("bible:")).reduce((s, t) => s + t.sections, 0) : 0;
  const bibleRead = faith === "christian" ? myReads.filter((r) => r.textKey.startsWith("bible:")).length : 0;

  const upcoming = holidays.filter((h) => h.tradition !== "Saints" && (h.endDate ?? h.date) >= today).slice(0, 5);

  // The faith's own "today" card.
  let todayCard: ReactNode = null;
  if (faith === "catholic") {
    const s = liturgicalSeason(today);
    const saints = saintsOn(today);
    const nextSaints = holidays.filter((h) => h.tradition === "Saints" && h.date > today).slice(0, 3);
    const nextObligation = holidays.find((h) => h.tradition === "Holy Day of Obligation" && h.date >= today);
    const friday = new Date(`${today}T00:00:00Z`).getUTCDay() === 5;
    todayCard = (
      <Card>
        <CardHeader title="Today in the Church" icon={<Sun className="size-4" />} href={`${base}/holidays?tradition=Saints`} hrefLabel="Saints" />
        <p className="flex items-center gap-2 text-lg font-semibold">
          <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: SEASON_DOT[s.color] }} aria-hidden /> {s.name}
        </p>
        <p className="text-sm text-muted">{s.note}</p>
        {saints.length > 0 ? (
          saints.map((x) => (
            <p key={x.name} className="mt-3 rounded-xl bg-primary-50 px-3 py-2 text-sm">
              <span aria-hidden>{x.emoji}</span> <span className="font-semibold">{x.name}</span>
              <span className="block text-muted">{x.about}</span>
            </p>
          ))
        ) : nextSaints.length > 0 ? (
          <p className="mt-3 text-sm">
            Next feasts: {nextSaints.map((x) => `${x.name} (${fmtDate(x.date).replace(/, \d{4}$/, "")})`).join(" · ")}
          </p>
        ) : null}
        <p className="mt-3 text-sm">📿 Today&apos;s Rosary: the <span className="font-semibold">{rosaryMysteries(today)} Mysteries</span></p>
        {friday && <p className="mt-1 text-sm">🐟 {s.key === "lent" ? "A Friday of Lent: abstain from meat." : "Friday: a day of penance (abstaining from meat is a traditional way)."}</p>}
        {nextObligation && (
          <p className="mt-1 text-sm">
            ⛪ Next holy day of obligation: <span className="font-semibold">{nextObligation.name}</span>, {nextObligation.date === today ? "today" : fmtDate(nextObligation.date)}
          </p>
        )}
      </Card>
    );
  } else if (faith === "christian") {
    const s = liturgicalSeason(today);
    const y = Number(today.slice(0, 4));
    const easter = holidays.find((h) => h.key === "easter" && h.date >= today);
    const xmas = `${today > `${y}-12-25` ? y + 1 : y}-12-25`;
    todayCard = (
      <Card>
        <CardHeader title="The church year" icon={<Sun className="size-4" />} />
        <p className="flex items-center gap-2 text-xl font-semibold">
          <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: SEASON_DOT[s.color] }} aria-hidden /> {s.name}
        </p>
        <p className="mt-1 text-sm text-muted">{s.note}</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
          {easter && (
            <li className="rounded-xl bg-sunken p-2">
              <span className="block text-2xl font-semibold">{daysBetween(today, easter.date)}</span> days to Easter
            </li>
          )}
          <li className="rounded-xl bg-sunken p-2">
            <span className="block text-2xl font-semibold">{daysBetween(today, xmas)}</span> days to Christmas
          </li>
        </ul>
      </Card>
    );
  } else if (faith === "jewish") {
    const omer = omerDay(today);
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const friday = addDays(today, (5 - dow + 7) % 7);
    todayCard = (
      <Card>
        <CardHeader title="Today on the Hebrew calendar" icon={<Sun className="size-4" />} />
        <p className="text-2xl font-semibold">{hebrewLabel(today)}</p>
        <p className="mt-1 text-sm text-muted">The Hebrew date changes at sundown; after dark it&apos;s {hebrewLabel(addDays(today, 1))}.</p>
        {omer && <p className="mt-3 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary-700">Tonight we count day {omer + 1 <= 49 ? omer + 1 : 49} of the Omer. Today is day {omer}.</p>}
        <p className="mt-3 text-sm">
          🕯️ {dow === 5 ? "Shabbat begins tonight at sundown." : dow === 6 ? "Shabbat Shalom! Shabbat ends tonight after dark (Havdalah)." : `Shabbat begins ${fmtDate(friday)} at sundown.`}
        </p>
      </Card>
    );
  } else if (faith === "hindu") {
    const p = panchang(today);
    const eks = ekadashis(today, addDays(today, 40)).slice(0, 2);
    todayCard = (
      <Card>
        <CardHeader title="Today's panchang" icon={<Sun className="size-4" />} />
        <p className="text-xl font-semibold">{p.name}</p>
        <p className="mt-1 text-sm text-muted">
          {p.paksha} paksha{p.month && ` · ${p.month}`} (at sunrise, Indian time)
        </p>
        {eks.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {eks.map((e) => (
              <li key={e.date} className="flex justify-between rounded-xl bg-sunken px-3 py-2">
                <span>🍃 {e.paksha} Ekadashi</span>
                <span className="font-medium">{e.date === today ? "Today" : fmtDate(e.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  } else if (faith === "buddhist") {
    const off = tzOffset(new Date(), tz) / 60000;
    const days = uposathaDays(today, addDays(today, 30), off).slice(0, 4);
    todayCard = (
      <Card>
        <CardHeader title="Uposatha days" icon={<Sun className="size-4" />} />
        <ul className="flex flex-col gap-1 text-sm">
          {days.map((d) => (
            <li key={d.date} className="flex justify-between rounded-xl bg-sunken px-3 py-2">
              <span>{PHASE[d.phase]}</span>
              <span className="font-medium">{d.date === today ? "Today" : fmtDate(d.date)}</span>
            </li>
          ))}
        </ul>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">The Five Precepts</summary>
          <ol className="mt-2 list-decimal pl-5 text-muted">
            {BUDDHIST_PRECEPTS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </details>
      </Card>
    );
  }

  return (
    <>
      <header className="mb-5">
        <p className="text-sm font-medium text-primary-600">Spiritual</p>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">
          <span aria-hidden>{meta.emoji}</span> {meta.label}
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] text-muted">{meta.blurb}</p>
      </header>
      <FaithSubTabs faith={faith} active="today" />

      <figure className="mb-6 rounded-[var(--radius-card)] border border-line bg-gradient-to-br from-primary-50 to-surface px-5 py-5 sm:px-7">
        <blockquote className="font-display text-lg leading-snug sm:text-xl">&ldquo;{word.text}&rdquo;</blockquote>
        <figcaption className="mt-2 text-sm text-muted">{word.ref}</figcaption>
      </figure>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Today's practice" icon={<CheckCircle2 className="size-4" />} href={`${base}/devotions`} hrefLabel="All" />
          {active.length ? (
            <>
              <ul className="flex flex-col gap-2">
                {active.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <PracticeCheck id={p.id} date={today} done={doneToday.has(p.id)} name={p.name} emoji={p.emoji} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                {doneToday.size} of {active.length} today{dayStreak > 1 && ` · 🔥 ${dayStreak}-day streak`}
              </p>
            </>
          ) : (
            <Quiet>All your practices are hidden. Tap All to choose the ones you keep.</Quiet>
          )}
        </Card>

        {todayCard}

        <Card>
          <CardHeader title="Coming up" icon={<CalendarHeart className="size-4" />} href={`${base}/holidays`} hrefLabel="All holidays" />
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((h) => (
                <li key={h.key + h.date} className="flex items-center gap-3 py-2.5">
                  <span className="text-xl" aria-hidden>
                    {h.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.name}</span>
                    <span className="block truncate text-xs text-muted">{h.tradition ?? (h.eve ? "Begins at sundown the evening before" : h.about)}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {fmtDate(h.date)}
                    <span className="block text-xs text-muted">{h.date <= today ? "Today" : `in ${daysBetween(today, h.date)} days`}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>No holidays in the next year.</Quiet>
          )}
        </Card>

        <Card>
          <CardHeader title="Reading" icon={<BookOpen className="size-4" />} href={`${base}/reading`} hrefLabel="Open" />
          {last ? (
            <>
              <p className="font-semibold">{last.title}</p>
              <ProgressBar value={lastRead.size} max={last.sections} label={`${lastRead.size} of ${last.sections}`} />
              <p className="mt-2 text-sm text-muted">{nextSection ? `Next: ${sectionName(last, nextSection)}` : "Finished. Well done!"}</p>
              <Link href={`${base}/reading/${encodeURIComponent(last.key)}`} className="mt-2 inline-block text-sm font-medium text-primary-700 hover:underline">
                Continue reading →
              </Link>
            </>
          ) : (
            <Quiet>Track what you read, chapter by chapter. Open Reading to start.</Quiet>
          )}
          {bibleTotal > 0 && (
            <p className="mt-3 border-t border-line pt-3 text-sm">
              Whole Bible: <span className="font-semibold">{Math.round((bibleRead / bibleTotal) * 100)}%</span> <span className="text-muted">({bibleRead} of {bibleTotal} chapters)</span>
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title={meta.prayersTitle} icon={<HandHeart className="size-4" />} href={`${base}/devotions#prayers`} hrefLabel="Open" />
          {prayers.length ? (
            <ul className="divide-y divide-line">
              {prayers.slice(0, 4).map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-medium">{p.title}</p>
                  {p.forWhom && <p className="text-sm text-muted">For {p.forWhom}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>Nothing on your list yet. Tap Open to add {/^[aeiou]/i.test(meta.prayerNoun) ? "an" : "a"} {meta.prayerNoun}.</Quiet>
          )}
        </Card>

        <Card>
          <CardHeader title={meta.journalTitle} icon={<NotebookPen className="size-4" />} href={`${base}/journal`} hrefLabel="Open" />
          {entries.length ? (
            <ul className="divide-y divide-line">
              {entries.map((e) => (
                <li key={e.id} className="py-2">
                  <p className="font-medium">{e.title || e.reference || fmtDate(e.date)}</p>
                  <p className="line-clamp-2 text-sm text-muted">{e.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Quiet>
              <Sparkles className="mr-1 inline size-4" />
              {meta.journalPrompt}
            </Quiet>
          )}
        </Card>
      </div>
    </>
  );
}
