import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, MessageSquareHeart } from "lucide-react";
import { requirePlatformAdmin, setFeedbackStatus } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { families, familyMembers, feedback } from "@/db/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };

const KIND: Record<string, string> = { feature: "✨ Feature request", idea: "💡 Idea", problem: "🐞 Problem", praise: "💜 Praise", question: "❓ Question", other: "💬 Other", contact: "✉️ Website contact" };

export default async function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : sp.show === "done" ? "done" : "open";
  const rows = await db
    .select({ f: feedback, family: families.name, member: familyMembers.displayName })
    .from(feedback)
    .leftJoin(families, eq(families.id, feedback.familyId))
    .leftJoin(familyMembers, eq(familyMembers.id, feedback.memberId))
    .orderBy(desc(feedback.createdAt))
    .limit(300);
  const shown = rows.filter((r) => (show === "all" ? true : show === "done" ? r.f.status === "done" : r.f.status !== "done"));
  const btn = "h-8 rounded-lg px-2.5 text-xs font-medium ring-1 ring-line hover:bg-sunken";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Admin
      </Link>
      <PageHeader title="Customer feedback" description="Messages from the Feedback page and the website's contact form." />
      <nav className="flex gap-1">
        {(["open", "done", "all"] as const).map((k) => (
          <Link key={k} href={`/admin/feedback?show=${k}`} className={cn("rounded-full px-3 py-1.5 text-sm font-medium", show === k ? "bg-ink text-white" : "text-muted hover:bg-sunken")}>
            {k === "open" ? "Open" : k === "done" ? "Done" : "All"}
          </Link>
        ))}
      </nav>
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<MessageSquareHeart />} title="Nothing here" description="New feedback from families will appear here." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map(({ f, family, member }) => (
            <li key={f.id}>
              <Card className={cn(f.status === "new" && "border-primary-300")}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={f.kind === "problem" ? "wine" : "primary"}>{KIND[f.kind] ?? f.kind}</Badge>
                  {f.rating ? <span aria-label={`${f.rating} of 5`}>{"★".repeat(f.rating)}</span> : null}
                  {f.status === "new" && <Badge tone="olive">New</Badge>}
                  <span className="text-muted">
                    {f.kind === "contact" ? `${f.meta.name ?? "Visitor"}${f.meta.topic ? ` (${f.meta.topic})` : ""}` : `${member ?? "Someone"} · ${family ?? "deleted family"}`} · {f.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {f.page ? ` · from ${f.page}` : ""}
                  </span>
                </div>
                <p className="mt-2 text-[15px] whitespace-pre-line">{f.message}</p>
                {f.contactEmail && (
                  <p className="mt-1 text-sm">
                    Reply to: <a className="text-primary-700 underline" href={`mailto:${f.contactEmail}`}>{f.contactEmail}</a>
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {f.status !== "read" && f.status !== "done" && (
                    <ActionButton action={setFeedbackStatus} fields={{ id: f.id, status: "read" }} className={btn}>
                      Mark read
                    </ActionButton>
                  )}
                  {f.status !== "done" ? (
                    <ActionButton action={setFeedbackStatus} fields={{ id: f.id, status: "done" }} className={btn}>
                      Done
                    </ActionButton>
                  ) : (
                    <ActionButton action={setFeedbackStatus} fields={{ id: f.id, status: "read" }} className={btn}>
                      Reopen
                    </ActionButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
