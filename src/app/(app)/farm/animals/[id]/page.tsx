import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { animalHealthRecords, animals, feedLogs, productionLogs } from "@/db/schema";
import { deleteAnimal, deleteHealthRecord } from "@/app/actions/farm";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { AnimalAvatar } from "@/components/farm/animal-avatar";
import { AnimalFormModal, HealthRecordModal, ProductionModal } from "@/components/farm/farm-forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { daysBetween, formatShortDate, todayIn } from "@/lib/dates";
import { animalOptions } from "@/lib/farm";
import { fileUrl } from "@/lib/files";

export const metadata: Metadata = { title: "Animal" };

function age(birth: string, today: string) {
  const d = daysBetween(birth, today);
  if (d < 60) return `${d} days`;
  if (d < 730) return `${Math.round(d / 30)} months`;
  return `${Math.floor(d / 365)} years`;
}

export default async function AnimalPage({ params }: PageProps<"/farm/animals/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const [a] = await db.select().from(animals).where(and(eq(animals.id, id), eq(animals.familyId, viewer.family.id)));
  if (!a) notFound();
  const today = todayIn(viewer.family.timezone);
  const [health, production, feed, opts] = await Promise.all([
    db.select().from(animalHealthRecords).where(eq(animalHealthRecords.animalId, id)).orderBy(desc(animalHealthRecords.date)),
    db.select().from(productionLogs).where(eq(productionLogs.animalId, id)).orderBy(desc(productionLogs.date)).limit(30),
    db.select().from(feedLogs).where(eq(feedLogs.animalId, id)).orderBy(desc(feedLogs.date)).limit(20),
    animalOptions(viewer),
  ]);
  const canEdit = viewer.can("farm", "edit");
  const photo = fileUrl(a.imageFileId);
  const facts: [string, string | null][] = [
    ["Type", a.headCount > 1 ? `${a.headCount} × ${a.species}` : a.species],
    ["Breed", a.breed],
    ["Sex", a.sex === "unknown" ? null : a.sex],
    ["Group", a.groupName],
    ["Age", a.birthDate ? age(a.birthDate, today) : null],
    ["Acquired", a.acquiredOn ? formatShortDate(a.acquiredOn) : null],
    ["Feed", a.feed],
  ];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link href="/farm/animals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Animals
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <AnimalAvatar species={a.species} photoUrl={photo} size="xl" />
        <div className="flex-1">
          <PageHeader
            eyebrow={a.species}
            title={a.name}
            description={a.status !== "active" ? `Status: ${a.status}` : undefined}
            actions={
              canEdit ? (
                <>
                  <AnimalFormModal defaults={{ ...a, imageUrl: photo }} triggerContent={<><Pencil className="size-4" /> Edit</>} />
                  <ActionButton action={deleteAnimal} fields={{ id }} confirm={`Delete ${a.name} and all records?`} label="Delete" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                    <Trash2 className="size-4" />
                  </ActionButton>
                </>
              ) : undefined
            }
          />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="Details" />
          <dl className="grid grid-cols-2 gap-3">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium tracking-wide text-muted uppercase">{k}</dt>
                  <dd className="text-[15px] capitalize">{v}</dd>
                </div>
              ))}
          </dl>
          {a.notes && <p className="mt-4 text-[15px] text-ink-soft">{a.notes}</p>}
        </Card>
        <Card>
          <CardHeader title="Health records" action={canEdit ? <HealthRecordModal animalId={id} /> : undefined} />
          {health.length === 0 ? (
            <p className="text-sm text-muted">No health records yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {health.map((h) => (
                <li key={h.id} className="flex items-start gap-3 border-b border-line/60 pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">
                      {h.kind} <span className="font-normal text-muted">· {formatShortDate(h.date)}</span>
                    </p>
                    {h.description && <p className="text-sm text-ink-soft">{h.description}</p>}
                  </div>
                  {h.nextDueOn && <Badge tone={h.nextDueOn < today ? "wine" : "olive"}>Next {formatShortDate(h.nextDueOn)}</Badge>}
                  {canEdit && <DeleteButton action={deleteHealthRecord} fields={{ id: h.id }} what="this record" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Production" action={canEdit ? <ProductionModal animals={opts} canKitchen={viewer.can("kitchen", "edit")} defaultAnimal={id} triggerLabel="Record" /> : undefined} />
          {production.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded for {a.name} yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {production.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="capitalize">
                    {p.kind} <span className="text-muted">· {formatShortDate(p.date)}</span>
                  </span>
                  <span className="tabular-nums">
                    {Number(p.quantity)} {p.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Feed" />
          {feed.length === 0 ? (
            <p className="text-sm text-muted">No feed logged for {a.name}.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {feed.map((fl) => (
                <li key={fl.id} className="flex justify-between">
                  <span>
                    {fl.feed} <span className="text-muted">· {formatShortDate(fl.date)}</span>
                  </span>
                  <span className="tabular-nums">
                    {Number(fl.quantity)} {fl.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
