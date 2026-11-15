import type { Metadata } from "next";
import { Lock, Pencil, Share2, Sparkles } from "lucide-react";
import { deleteWellnessEntry, setEntryShared } from "@/app/actions/wellness";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PersonalSwitcher } from "@/components/health/personal-switcher";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { WellnessEntryModal } from "@/components/wellness/forms";
import { SupportPanel, WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { getViewer } from "@/lib/dal";
import { formatLongDate, todayIn } from "@/lib/dates";
import { healthProfile } from "@/lib/personal-health";
import { audienceNames, personalSubject, privacyFor } from "@/lib/privacy";
import { wellnessEntriesFor } from "@/lib/wellness-data";
import { INTENSITIES, moodInfo, promptFor, selfCareLabel } from "@/lib/wellness";

export const metadata: Metadata = { title: "Wellness journal" };

export default async function WellnessJournalPage({ searchParams }: PageProps<"/wellness/journal">) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const { subject, subjects, own } = await personalSubject(viewer, "wellness", sp.member);
  const gratitudeView = sp.view === "gratitude";
  const today = todayIn(viewer.family.timezone);
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [all, profile, privacy] = await Promise.all([wellnessEntriesFor(viewer, subject.id, { limit: 500 }), healthProfile(viewer.family.id, viewer.member.id), privacyFor(viewer.member.id, "wellness")]);
  const names = own ? await audienceNames(viewer, privacy) : [];
  const shareWith = names.length ? names.join(", ") : null;
  const entries = q ? all.filter((e) => [e.title, e.body, e.details?.accomplishments, e.details?.challenges, ...(e.details?.gratitude ?? []), ...e.tags].some((x) => x?.toLowerCase().includes(q))) : all;
  const grateful = all.filter((e) => e.details?.gratitude?.length);
  const first = subject.displayName.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        eyebrow="My private · Mental Wellness"
        title={gratitudeView ? "Gratitude" : own ? "Wellness journal" : `${first}'s shared entries`}
        description={gratitudeView ? "The good things you've noticed, over time." : "Private by default. Every box is optional."}
        actions={own ? <WellnessEntryModal today={today} prompt={gratitudeView ? "What are you grateful for today?" : promptFor(today)} shareWith={shareWith} triggerLabel={gratitudeView ? "Add gratitude" : "New entry"} customFeelings={profile.customFeelings} customSelfCare={profile.customSelfCare} defaultOpen={sp.new === "1"} /> : undefined}
      />
      <PersonalSwitcher subjects={subjects} current={subject.id} base={gratitudeView ? "/wellness/journal?view=gratitude" : "/wellness/journal"} />
      <WellnessTabs active={gratitudeView ? "gratitude" : "journal"} member={own ? undefined : subject.id} />
      {own && sp.support === "1" && <SupportPanel back="/wellness/journal?support=1" asked={sp.asked === "1"} />}

      {gratitudeView ? (
        grateful.length ? (
          <ol className="relative flex flex-col gap-4 border-l-2 border-primary-100 pl-5">
            {grateful.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] size-3 rounded-full bg-primary-400" aria-hidden />
                <p className="text-sm font-semibold">{formatLongDate(e.date)}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {e.details!.gratitude!.map((g, i) => (
                    <li key={i} className="text-[15px]">
                      🌱 {g}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <Card>
            <EmptyState icon={<Sparkles />} title="Nothing here yet" description="Add one, three, or as many good things as you like. They'll build into a timeline you can look back on." />
          </Card>
        )
      ) : (
        <>
          <form action="/wellness/journal" className="flex gap-2">
            {!own && <input type="hidden" name="member" value={subject.id} />}
            <label htmlFor="wq" className="sr-only">Search your journal</label>
            <input id="wq" name="q" defaultValue={q} placeholder="Search entries and tags" className="h-11 flex-1 rounded-full border border-line-strong bg-surface px-4 text-[15px]" />
          </form>
          {entries.length ? (
            <ul className="flex flex-col gap-3">
              {entries.map((e) => {
                const d = e.details ?? {};
                const m = moodInfo(e.mood);
                return (
                  <li key={e.id}>
                    <Card className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {m && (
                          <span className="text-2xl" aria-label={m.label}>
                            {m.emoji}
                          </span>
                        )}
                        <span className="font-semibold">{formatLongDate(e.date)}</span>
                        {e.title && <span className="text-ink-soft">· {e.title}</span>}
                        {own && (e.visibility === "private" ? <Lock className="size-4 text-muted" aria-label="Private" /> : <Badge tone="mist">Shared</Badge>)}
                        {own && (
                          <span className="ml-auto flex items-center">
                            {shareWith && (
                              <ActionButton action={setEntryShared} fields={{ id: e.id, shared: String(e.visibility === "private") }} label={e.visibility === "private" ? "Share this entry" : "Stop sharing"} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken">
                                <Share2 className="size-4" />
                              </ActionButton>
                            )}
                            <WellnessEntryModal
                              today={today}
                              shareWith={shareWith}
                              customFeelings={profile.customFeelings}
                              customSelfCare={profile.customSelfCare}
                              triggerContent={<Pencil className="size-4" aria-label="Edit entry" />}
                              defaults={{ id: e.id, date: e.date, title: e.title, body: e.body, mood: e.mood, tags: e.tags, feelings: d.feelings ?? [], intensity: d.intensity ?? null, gratitude: d.gratitude ?? [], accomplishments: d.accomplishments ?? null, challenges: d.challenges ?? null, selfCare: d.selfCare ?? [], prompt: d.prompt ?? null, shared: e.visibility !== "private" }}
                            />
                            <DeleteButton action={deleteWellnessEntry} fields={{ id: e.id }} what="this entry" />
                          </span>
                        )}
                      </div>
                      {(d.feelings?.length ?? 0) > 0 && (
                        <p className="text-sm text-muted">
                          Feeling {d.feelings!.join(", ").toLowerCase()}
                          {d.intensity ? ` (${INTENSITIES.find((i) => i.key === d.intensity)?.label.toLowerCase()})` : ""}
                        </p>
                      )}
                      {d.prompt && <p className="text-sm font-medium text-primary-700">{d.prompt}</p>}
                      {e.body && <p className="text-[15px] whitespace-pre-line">{e.body}</p>}
                      {(d.gratitude?.length ?? 0) > 0 && <p className="text-sm">🌱 Grateful for: {d.gratitude!.join(" · ")}</p>}
                      {d.accomplishments && <p className="text-sm">⭐ {d.accomplishments}</p>}
                      {d.challenges && <p className="text-sm text-ink-soft">Hard: {d.challenges}</p>}
                      {(d.selfCare?.length ?? 0) > 0 && <p className="text-xs text-muted">Self-care: {d.selfCare!.map(selfCareLabel).join(", ")}</p>}
                      {e.photos.length > 0 && (
                        <div className="flex gap-2">
                          {e.photos.map((p) => (
                            <a key={p.id} href={p.full} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.thumb} alt="" className="size-20 rounded-lg object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {e.tags.length > 0 && <p className="text-xs text-muted">{e.tags.map((t) => `#${t}`).join(" ")}</p>}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card>
              <EmptyState icon={<Sparkles />} title={q ? "No matching entries" : own ? "Your journal is waiting" : "Nothing shared yet"} description={own ? "Try today's prompt, or just write what's on your mind." : "Entries appear here when they're shared with you."} />
            </Card>
          )}
        </>
      )}
      <WellnessFooter />
    </div>
  );
}
