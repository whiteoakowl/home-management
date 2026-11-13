import type { Metadata } from "next";
import Link from "next/link";
import { PawPrint, ShieldCheck, ShoppingBasket } from "lucide-react";
import { PetsTabs } from "@/components/pets/pet-tabs";
import { PreventativeRow } from "@/components/pets/pet-parts";
import { fmtDate } from "@/components/records/detail-list";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { listOccurrences } from "@/lib/chores";
import { addDays, todayIn } from "@/lib/dates";
import { listPets, petSuppliesFor, preventativesFor } from "@/lib/pets";
import { memberOptions } from "@/lib/queries";
import { PetCard, PetModal, petsViewer } from "./shared";

export const metadata: Metadata = { title: "Pets" };

export default async function PetsDashboard() {
  const viewer = await petsViewer();
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("pets", "edit");
  const [members, list] = await Promise.all([memberOptions(viewer), listPets(viewer)]);
  const ids = list.map((p) => p.id);
  const [prevs, supplies, care] = await Promise.all([
    preventativesFor(viewer, ids),
    petSuppliesFor(viewer),
    viewer.can("chores") ? listOccurrences(viewer, { kinds: ["chore", "task"], petIds: ids, to: addDays(today, 1), statuses: ["pending"] }) : Promise.resolve([]),
  ]);
  const name = (id: string) => list.find((p) => p.id === id)?.name;
  const due = prevs.filter((p) => p.nextDueOn && p.nextDueOn <= addDays(today, 14));
  const low = supplies.filter(({ item }) => item.lowStockThreshold !== null && Number(item.quantity) <= Number(item.lowStockThreshold));
  return (
    <>
      <PageHeader eyebrow="Care" title="Pets" description="Profiles, health, preventatives, food, care schedules and memories for every animal in the family." actions={canEdit && <PetModal members={members} />} />
      <PetsTabs active="dashboard" />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<PawPrint />} title="No pets yet" description="Add your dogs, cats, birds and other companions to track their care." action={canEdit && <PetModal members={members} />} />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => {
              const next = prevs.filter((x) => x.petId === p.id && x.nextDueOn).sort((a, b) => a.nextDueOn!.localeCompare(b.nextDueOn!))[0];
              return (
                <PetCard
                  key={p.id}
                  pet={p}
                  today={today}
                  extra={next && <p className={next.nextDueOn! < today ? "text-sm font-medium text-wine-600" : "text-sm text-ink-soft"}>Next: {next.productName} · {fmtDate(next.nextDueOn)}</p>}
                />
              );
            })}
          </div>
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader title="Preventatives due soon" icon={<ShieldCheck className="size-4" />} href="/pets/preventatives" />
              {due.length ? (
                <ul className="divide-y divide-line">
                  {due.map((p) => (
                    <PreventativeRow key={p.id} p={p} today={today} members={members} canEdit={canEdit} petName={name(p.petId)} />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted">Nothing due in the next two weeks.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Today's pet care" icon={<PawPrint className="size-4" />} href="/pets/care" />
              {care.length ? <OccurrenceList items={care} today={today} members={members} canManage={viewer.can("chores", "edit")} /> : <p className="py-2 text-sm text-muted">No pet chores due today.</p>}
            </Card>
            {low.length > 0 && (
              <Card>
                <CardHeader title="Running low" icon={<ShoppingBasket className="size-4" />} href="/pets/supplies" />
                <ul className="divide-y divide-line">
                  {low.map(({ s, item, petName }) => (
                    <li key={s.id} className="flex justify-between py-2.5 text-sm">
                      <Link href="/pets/supplies" className="font-medium hover:text-primary-700">
                        {item.name} <span className="font-normal text-muted">· {petName ?? "Shared"}</span>
                      </Link>
                      <span className="text-wine-600">
                        {Number(item.quantity)} {item.unit} left
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
