import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { DoorOpen, FileText, Hammer, KeyRound, ListChecks, Sparkles, Wrench } from "lucide-react";
import { db } from "@/db";
import { choreOccurrences, chores, homeDocuments, homeProjects, rooms } from "@/db/schema";
import { saveRoom, deleteRoom } from "@/app/actions/house";
import { FormModal } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { listOccurrences } from "@/lib/chores";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { HouseTabs } from "./house-tabs";

export const metadata: Metadata = { title: "House" };

export default async function HousePage() {
  const viewer = await getViewer();
  if (!viewer.can("house")) redirect("/house/chores");
  const today = todayIn(viewer.family.timezone);
  const fid = viewer.family.id;
  const canManage = viewer.can("house", "edit");

  const [members, todayWork, roomRows, projects, expiringDocs, counts] = await Promise.all([
    memberOptions(viewer),
    listOccurrences(viewer, { kinds: ["cleaning", "maintenance"], to: today, statuses: ["pending"] }),
    db
      .select({
        id: rooms.id,
        name: rooms.name,
        tasks: sql<number>`(select count(*)::int from ${chores} c where c.room_id = ${rooms.id} and c.archived_at is null)`,
      })
      .from(rooms)
      .where(eq(rooms.familyId, fid))
      .orderBy(asc(rooms.sortOrder), asc(rooms.name)),
    db.select().from(homeProjects).where(and(eq(homeProjects.familyId, fid), ne(homeProjects.status, "completed"))).orderBy(asc(homeProjects.targetDate)).limit(4),
    db
      .select()
      .from(homeDocuments)
      .where(and(eq(homeDocuments.familyId, fid), lte(homeDocuments.expiresOn, addDays(today, 60))))
      .orderBy(asc(homeDocuments.expiresOn))
      .limit(4),
    db
      .select({ kind: chores.kind, n: sql<number>`count(*)::int` })
      .from(chores)
      .where(and(eq(chores.familyId, fid), isNull(chores.archivedAt), inArray(chores.kind, ["cleaning", "maintenance"])))
      .groupBy(chores.kind),
  ]);
  const count = (k: string) => counts.find((c) => c.kind === k)?.n ?? 0;
  const weekDone = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(choreOccurrences)
    .where(and(eq(choreOccurrences.familyId, fid), eq(choreOccurrences.status, "done"), sql`${choreOccurrences.completedAt} >= now() - interval '7 days'`));

  const tiles = [
    { href: "/house/cleaning", label: "Cleaning", icon: Sparkles, stat: `${count("cleaning")} scheduled` },
    { href: "/maintenance/schedule", label: "Maintenance", icon: Wrench, stat: `${count("maintenance")} scheduled` },
    { href: "/house/chores", label: "Chores", icon: ListChecks, stat: `${weekDone[0]?.n ?? 0} done this week` },
    { href: "/maintenance/projects", label: "Projects", icon: Hammer, stat: `${projects.length} active` },
    { href: "/maintenance/documents", label: "Documents", icon: FileText, stat: "Warranties, manuals, policies" },
    { href: "/house/info", label: "Important info", icon: KeyRound, stat: "Wi-Fi, codes, contacts" },
  ];

  return (
    <>
      <PageHeader eyebrow="Household" title="House" description="Everything that keeps the home running, in one place." />
      <HouseTabs active="overview" viewer={viewer} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary-300">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <t.icon className="size-5" aria-hidden />
            </span>
            <span className="font-semibold">{t.label}</span>
            <span className="text-sm text-muted">{t.stat}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Today&apos;s housework</h2>
          {todayWork.length ? (
            <OccurrenceList items={todayWork} today={today} members={members} canManage={canManage} />
          ) : (
            <Card>
              <EmptyState compact icon={<Sparkles />} title="Nothing due today" description="Cleaning and maintenance due today will appear here." />
            </Card>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title="Rooms"
              icon={<DoorOpen className="size-4" />}
              action={
                canManage ? (
                  <FormModal title="Add a room" triggerLabel="Add" triggerVariant="ghost" triggerSize="sm" action={saveRoom} submitLabel="Add room" size="sm">
                    <TextField name="name" label="Room name" required placeholder="e.g. Mudroom" />
                  </FormModal>
                ) : undefined
              }
            />
            {roomRows.length === 0 ? (
              <p className="text-sm text-muted">Add rooms to organise cleaning and maintenance.</p>
            ) : (
              <ul className="flex flex-col">
                {roomRows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 border-b border-line/60 py-1.5 last:border-0">
                    <span className="text-[15px]">{r.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted">
                      {r.tasks > 0 && `${r.tasks} tasks`}
                      {canManage && <DeleteButton action={deleteRoom} fields={{ id: r.id }} what={`the ${r.name}`} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {projects.length > 0 && (
            <Card>
              <CardHeader title="Active projects" icon={<Hammer className="size-4" />} href="/maintenance/projects" />
              <ul className="flex flex-col gap-2">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-[15px]">
                    {p.title}
                    <Badge tone={p.status === "in_progress" ? "primary" : "neutral"}>{p.status.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {expiringDocs.length > 0 && (
            <Card>
              <CardHeader title="Documents expiring" icon={<FileText className="size-4" />} href="/maintenance/documents" />
              <ul className="flex flex-col gap-2">
                {expiringDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-[15px]">
                    {d.title}
                    <Badge tone={d.expiresOn! < today ? "wine" : "olive"}>{formatShortDate(d.expiresOn!)}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
