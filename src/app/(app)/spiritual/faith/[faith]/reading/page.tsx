import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte } from "drizzle-orm";
import { BookPlus } from "lucide-react";
import { db } from "@/db";
import { faithReadingLogs } from "@/db/schema";
import { saveText } from "@/app/actions/faith";
import { FormModal } from "@/components/forms/action-form";
import { FormRow, NumberField, TextField } from "@/components/forms/fields";
import { FaithSubTabs } from "@/components/faith/tabs";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/dal";
import { addDays, todayIn } from "@/lib/dates";
import { textsFor } from "@/lib/faith";
import { FAITH_META, isFaith, type Faith } from "@/lib/faith-config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reading" };

export default async function FaithReading({ params }: PageProps<"/spiritual/faith/[faith]/reading">) {
  const { faith: raw } = await params;
  if (!isFaith(raw)) redirect("/spiritual");
  const faith: Faith = raw;
  const viewer = await getViewer();
  const today = todayIn(viewer.family.timezone);
  const [texts, reads] = await Promise.all([textsFor(viewer, faith), db.select().from(faithReadingLogs).where(eq(faithReadingLogs.memberId, viewer.member.id))]);
  const recent = await db.select({ d: faithReadingLogs.readOn }).from(faithReadingLogs).where(and(eq(faithReadingLogs.memberId, viewer.member.id), gte(faithReadingLogs.readOn, addDays(today, -6))));
  const count = new Map<string, number>();
  for (const r of reads) count.set(r.textKey, (count.get(r.textKey) ?? 0) + 1);
  const groups = [...new Set(texts.map((t) => t.group))];
  const base = `/spiritual/faith/${faith}/reading`;
  const total = (g: string) => texts.filter((t) => t.group === g).reduce((s, t) => s + t.sections, 0);
  const done = (g: string) => texts.filter((t) => t.group === g).reduce((s, t) => s + Math.min(count.get(t.key) ?? 0, t.sections), 0);
  const all = texts.reduce((s, t) => s + t.sections, 0);
  const allDone = texts.reduce((s, t) => s + Math.min(count.get(t.key) ?? 0, t.sections), 0);

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            {FAITH_META[faith].emoji} {FAITH_META[faith].label}
          </p>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">Reading</h1>
          <p className="mt-1 text-[15px] text-muted">Tap a book, then tap each chapter as you read it. Your reading is private to you.</p>
        </div>
        <FormModal title="Add a book" description="Anything you're reading: a devotional, a commentary, a study guide." triggerLabel="Add a book" triggerIcon={<BookPlus className="size-4" />} triggerVariant="secondary" action={saveText} size="sm">
          <input type="hidden" name="faith" value={faith} />
          <TextField name="title" label="Title" required maxLength={120} />
          <FormRow>
            <NumberField name="sections" label="How many parts?" required min={1} max={2000} defaultValue={10} />
            <TextField name="sectionLabel" label="Each part is a…" maxLength={30} defaultValue="Chapter" placeholder="Chapter, Day, Lesson" />
          </FormRow>
        </FormModal>
      </header>
      <FaithSubTabs faith={faith} active="reading" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-3xl font-semibold">{recent.length}</p>
          <p className="text-sm text-muted">read this week</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-semibold">{all ? Math.round((allDone / all) * 100) : 0}%</p>
          <p className="text-sm text-muted">of everything here</p>
        </Card>
        <Card className="col-span-2 text-center sm:col-span-1">
          <p className="text-3xl font-semibold">{texts.filter((t) => (count.get(t.key) ?? 0) >= t.sections).length}</p>
          <p className="text-sm text-muted">finished</p>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">{g}</h2>
              <span className="text-sm text-muted tabular-nums">
                {done(g)} / {total(g)}
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {texts
                .filter((t) => t.group === g)
                .map((t) => {
                  const n = Math.min(count.get(t.key) ?? 0, t.sections);
                  const finished = n >= t.sections;
                  return (
                    <li key={t.key}>
                      <Link href={`${base}/${encodeURIComponent(t.key)}`} className={cn("block rounded-2xl border bg-surface px-4 py-3 hover:border-primary-300", finished ? "border-olive-300" : "border-line")}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{t.title}</span>
                          <span className="shrink-0 text-xs text-muted tabular-nums">{finished ? "✓ Done" : `${n}/${t.sections}`}</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunken">
                          <span className={cn("block h-full rounded-full", finished ? "bg-olive-500" : "bg-primary-500")} style={{ width: `${(n / t.sections) * 100}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
