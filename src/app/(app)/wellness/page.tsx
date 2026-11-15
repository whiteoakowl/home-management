import type { Metadata } from "next";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Archive, Flame, Heart, Lock, NotebookPen, Pencil, Quote, Share2, Sparkles, Target } from "lucide-react";
import { db } from "@/db";
import { quoteFavorites } from "@/db/schema";
import { archiveWellnessGoal, setCheckInShared, setGoalShared, toggleGoalMark, toggleQuoteFavorite } from "@/app/actions/wellness";
import { ActionButton } from "@/components/forms/inline";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/display";
import { CheckInForm, WellnessEntryModal, WellnessGoalModal } from "@/components/wellness/forms";
import { SupportPanel, WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { healthProfile } from "@/lib/personal-health";
import { audienceNames, personalSubject, privacyFor } from "@/lib/privacy";
import { quoteFor } from "@/lib/quotes";
import { checkInsFor, goalsWithProgress, wellnessEntriesFor, type WellnessAccess } from "@/lib/wellness-data";
import { currentStreak, moodInfo, promptFor, selfCareLabel, thisWeekCount } from "@/lib/wellness";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mental Wellness" };

export default async function WellnessPage({ searchParams }: PageProps<"/wellness">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, own, canManage } = await personalSubject(viewer, "wellness", sp.member);
  const access = (subject.access ?? "self") as WellnessAccess;
  const today = todayIn(viewer.family.timezone);
  const [profile, checkIns, entries, goals, privacy, favs] = await Promise.all([
    healthProfile(viewer.family.id, subject.id),
    checkInsFor(subject.id, access, addDays(today, -60), today),
    wellnessEntriesFor(viewer, subject.id, { limit: 60 }),
    goalsWithProgress(viewer, subject.id, access, today),
    privacyFor(subject.id, "wellness"),
    own ? db.select().from(quoteFavorites).where(and(eq(quoteFavorites.memberId, viewer.member.id))) : Promise.resolve([]),
  ]);
  const names = own ? await audienceNames(viewer, privacy) : [];
  const shareWith = names.length ? names.join(", ") : null;
  const todays = checkIns.find((c) => c.date === today);
  const quote = quoteFor(today, profile.quoteCategories);
  const fav = favs.find((f) => f.quoteId === quote.id);
  const prompt = promptFor(today);
  const journalDays = entries.map((e) => e.date);
  const checkInDays = checkIns.map((c) => c.date);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDay = new Map(checkIns.map((c) => [c.date, c]));
  const first = subject.displayName.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader eyebrow="My private" title={own ? "Mental Wellness" : `${first}'s Mental Wellness`} description={own ? "A calm space to check in with yourself, reflect and build small, kind habits." : `What ${first} has chosen to share with you.`} />
      <PersonalSwitcher subjects={subjects} current={subject.id} base="/wellness" />
      <WellnessTabs active="today" member={own ? undefined : subject.id} />
      {own && sp.support === "1" && <SupportPanel back="/wellness?support=1" asked={sp.asked === "1"} />}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="flex flex-col gap-4">
          <CardHeader title={canManage ? (todays ? "Today's check-in" : "Daily check-in") : "Recent moods"} icon={<Heart className="size-4" />} />
          {canManage ? (
            <CheckInForm
              memberId={subject.id}
              customFeelings={profile.customFeelings}
              customSelfCare={profile.customSelfCare}
              shareWith={own ? shareWith : null}
              defaults={todays ? { mood: todays.mood, feelings: todays.feelings, intensity: todays.intensity, selfCare: todays.selfCare, note: todays.note, shared: todays.shared } : undefined}
            />
          ) : checkIns.length ? (
            <ul className="flex flex-col gap-2">
              {checkIns.slice(0, 7).map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="text-2xl" aria-hidden>
                    {moodInfo(c.mood)?.emoji ?? "•"}
                  </span>
                  <span>
                    <span className="font-medium">{formatShortDate(c.date)}</span> · {moodInfo(c.mood)?.label ?? "Checked in"}
                    {c.feelings.length > 0 && <span className="block text-muted">{c.feelings.join(", ")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing shared yet.</p>
          )}
          {own && todays && shareWith && (
            <ActionButton action={setCheckInShared} fields={{ id: todays.id, shared: String(!todays.shared) }} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
              <Share2 className="size-4" /> {todays.shared ? "Stop sharing today's mood" : "Share today's mood"}
            </ActionButton>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {own && (
            <Card className="flex flex-col gap-3 bg-gradient-to-br from-primary-50 to-surface">
              <CardHeader title="Today's quote" icon={<Quote className="size-4" />} href="/wellness/quotes" hrefLabel="More" />
              <blockquote className="font-display text-xl leading-snug">“{quote.text}”</blockquote>
              <p className="text-sm text-muted">
                {quote.author ? `${quote.author} · ` : ""}
                {quote.category}
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton action={toggleQuoteFavorite} fields={{ quoteId: quote.id }} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium", fav ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
                  <Heart className={cn("size-4", fav && "fill-current")} /> {fav ? "Saved" : "Save"}
                </ActionButton>
                <Link href={`/wellness/quotes?quote=${quote.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-sunken">
                  <Pencil className="size-4" /> Add a note
                </Link>
              </div>
            </Card>
          )}
          {own && (
            <Card className="flex flex-col gap-3">
              <CardHeader title="Today's reflection" icon={<Sparkles className="size-4" />} />
              <p className="text-[17px]">{prompt}</p>
              <div className="flex flex-wrap gap-2">
                <WellnessEntryModal today={today} prompt={prompt} shareWith={shareWith} triggerLabel="Write about it" customFeelings={profile.customFeelings} customSelfCare={profile.customSelfCare} />
                <WellnessEntryModal today={today} shareWith={shareWith} triggerContent={<span className="inline-flex items-center gap-1.5"><NotebookPen className="size-4" /> Free write</span>} customFeelings={profile.customFeelings} customSelfCare={profile.customSelfCare} />
              </div>
              <p className="text-xs text-muted">Prompts are optional. Write as much or as little as you like.</p>
            </Card>
          )}
          <Card>
            <CardHeader title="Your rhythm" icon={<Flame className="size-4" />} />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-sunken p-3">
                <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Check-ins this week</dt>
                <dd className="mt-1 text-xl font-semibold">{thisWeekCount(checkInDays, today)}</dd>
              </div>
              <div className="rounded-xl bg-sunken p-3">
                <dt className="text-xs font-semibold tracking-wider text-muted uppercase">Journal days in a row</dt>
                <dd className="mt-1 text-xl font-semibold">{currentStreak(journalDays, today)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">Every check-in counts. Days off are part of the rhythm too.</p>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Last two weeks" href={`/wellness/history${own ? "" : `?member=${subject.id}`}`} hrefLabel="Mood history" />
        <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
          {last14.map((d) => {
            const c = byDay.get(d);
            const m = moodInfo(c?.mood);
            return (
              <li key={d} className="flex flex-col items-center gap-1 text-xs text-muted">
                <span className={cn("flex size-10 items-center justify-center rounded-full text-xl", c ? "bg-primary-50" : "bg-sunken")} title={c ? `${formatShortDate(d)}: ${m?.label ?? "checked in"}` : formatShortDate(d)} aria-label={`${formatShortDate(d)}: ${c ? (m?.label ?? "checked in") : "no check-in"}`}>
                  {m?.emoji ?? ""}
                </span>
                {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Wellness goals" icon={<Target className="size-4" />} action={canManage ? <WellnessGoalModal memberId={subject.id} /> : undefined} />
          {goals.length ? (
            <ul className="flex flex-col gap-3">
              {goals.map((g) => (
                <li key={g.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-sm text-muted">
                      {Math.min(g.done, g.timesPerWeek)} of {g.timesPerWeek} this week
                    </span>
                  </div>
                  <ProgressBar value={Math.min(g.done, g.timesPerWeek)} max={g.timesPerWeek} label={g.title} />
                  {canManage && (
                    <div className="flex flex-wrap gap-1.5">
                      {g.kind === "custom" && (
                        <ActionButton action={toggleGoalMark} fields={{ id: g.id }} className="h-9 rounded-full border border-line-strong px-3 text-sm hover:bg-sunken">
                          {g.doneToday ? "Done today ✓" : "Did it today"}
                        </ActionButton>
                      )}
                      {own && shareWith && (
                        <ActionButton action={setGoalShared} fields={{ id: g.id, shared: String(!g.shared) }} className="h-9 rounded-full border border-line-strong px-3 text-sm hover:bg-sunken">
                          {g.shared ? "Stop sharing" : "Share goal"}
                        </ActionButton>
                      )}
                      <WellnessGoalModal memberId={subject.id} defaults={{ id: g.id, title: g.title, kind: g.kind, timesPerWeek: g.timesPerWeek, selfCareKey: g.selfCareKey }} triggerContent={<Pencil className="size-4" aria-label="Edit goal" />} />
                      <ActionButton action={archiveWellnessGoal} fields={{ id: g.id }} label="Put away goal" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken">
                        <Archive className="size-4" />
                      </ActionButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{canManage ? "Small, kind habits: journal a few times a week, spend time outdoors, read before bed." : "No shared goals."}</p>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Recent journal" icon={<NotebookPen className="size-4" />} href={`/wellness/journal${own ? "" : `?member=${subject.id}`}`} hrefLabel="All entries" />
          {entries.length ? (
            <ul className="flex flex-col gap-2">
              {entries.slice(0, 4).map((e) => (
                <li key={e.id} className="rounded-xl bg-sunken/60 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    {moodInfo(e.mood)?.emoji} {formatShortDate(e.date)}
                    {e.title ? ` · ${e.title}` : ""}
                    {own && (e.visibility === "private" ? <Lock className="size-3.5 text-muted" aria-label="Private" /> : <Badge tone="mist">Shared</Badge>)}
                  </p>
                  {e.body && <p className="line-clamp-2 text-ink-soft">{e.body}</p>}
                  {(e.details?.selfCare?.length ?? 0) > 0 && <p className="text-xs text-muted">Self-care: {e.details!.selfCare!.map(selfCareLabel).join(", ")}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{own ? "Your entries will appear here. They're private unless you share one." : "Nothing shared yet."}</p>
          )}
        </Card>
      </div>
      {own && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Lock className="size-4" aria-hidden /> {shareWith ? `You can share moods, entries and goals with ${shareWith}, one at a time.` : "Everything here is private to you."}{" "}
          <Link href="/privacy" className="font-medium text-primary-700 underline">
            Privacy Center
          </Link>
        </p>
      )}
      <WellnessFooter />
    </div>
  );
}
