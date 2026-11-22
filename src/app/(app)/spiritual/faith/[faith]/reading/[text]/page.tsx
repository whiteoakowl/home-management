import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Check, CheckCheck, RotateCcw, Trash2 } from "lucide-react";
import { db } from "@/db";
import { faithReadingLogs } from "@/db/schema";
import { deleteText, markText, toggleReading } from "@/app/actions/faith";
import { ActionButton } from "@/components/forms/inline";
import { fmtDate } from "@/components/records/detail-list";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { findText } from "@/lib/faith";
import { isFaith, sectionName } from "@/lib/faith-config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reading" };

export default async function TextPage({ params }: PageProps<"/spiritual/faith/[faith]/reading/[text]">) {
  const { faith, text } = await params;
  if (!isFaith(faith)) redirect("/spiritual");
  const viewer = await getViewer();
  const t = await findText(viewer, decodeURIComponent(text));
  if (!t) notFound();
  const logs = await db.select().from(faithReadingLogs).where(and(eq(faithReadingLogs.memberId, viewer.member.id), eq(faithReadingLogs.textKey, t.key)));
  const read = new Map(logs.map((l) => [l.section, l.readOn]));
  const n = Math.min(read.size, t.sections);
  const next = Array.from({ length: t.sections }, (_, i) => i + 1).find((s) => !read.has(s));
  const named = !!t.names;
  const actionCls = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium hover:bg-sunken";

  return (
    <>
      <Link href={`/spiritual/faith/${faith}/reading`} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
        <ArrowLeft className="size-4" /> All reading
      </Link>
      <header className="mb-5">
        <p className="text-sm font-medium text-primary-600">{t.group}</p>
        <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">{t.title}</h1>
        {t.about && <p className="mt-1 max-w-2xl text-[15px] text-muted">{t.about}</p>}
      </header>
      <Card className="mb-5">
        <ProgressBar value={n} max={t.sections} label={`${n} of ${t.sections} ${t.sectionLabel.toLowerCase()}${t.sections === 1 ? "" : "s"} read`} />
        <p className="mt-2 text-sm text-muted">{next ? `Up next: ${sectionName(t, next)}` : "You've finished this one. Start over anytime."}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {n < t.sections && (
            <ActionButton action={markText} fields={{ text: t.key, op: "all" }} confirm={`Mark all of ${t.title} as read?`} className={actionCls}>
              <CheckCheck className="size-4" /> Mark all read
            </ActionButton>
          )}
          {n > 0 && (
            <ActionButton action={markText} fields={{ text: t.key, op: "reset" }} confirm={`Clear your progress in ${t.title} and start over?`} className={actionCls}>
              <RotateCcw className="size-4" /> Start over
            </ActionButton>
          )}
          {t.custom && (
            <ActionButton action={deleteText} fields={{ id: t.id }} confirm={`Remove ${t.title} and its progress?`} className={cn(actionCls, "text-wine-700")}>
              <Trash2 className="size-4" /> Remove book
            </ActionButton>
          )}
        </div>
      </Card>
      <ul className={cn("grid gap-2", named ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-5 sm:grid-cols-8 lg:grid-cols-12")}>
        {Array.from({ length: t.sections }, (_, i) => i + 1).map((s) => {
          const on = read.has(s);
          return (
            <li key={s}>
              <ActionButton
                action={toggleReading}
                fields={{ text: t.key, section: s }}
                label={`${sectionName(t, s)}: ${on ? "read, tap to undo" : "tap when read"}`}
                title={on ? `Read ${fmtDate(read.get(s))}` : undefined}
                className={cn(
                  "w-full rounded-xl border font-medium transition-colors",
                  named ? "justify-start px-3 py-2.5 text-left" : "h-11 text-sm tabular-nums",
                  on ? "border-olive-400 bg-olive-500 text-white" : s === next ? "border-primary-400 bg-primary-50" : "border-line bg-surface hover:border-primary-300",
                )}
              >
                {named ? (
                  <>
                    {on ? <Check className="size-4 shrink-0" /> : <span className="w-6 shrink-0 text-xs text-muted">{s}</span>}
                    <span className="truncate">{sectionName(t, s)}</span>
                  </>
                ) : (
                  s
                )}
              </ActionButton>
            </li>
          );
        })}
      </ul>
    </>
  );
}
