import { cloneElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { PawPrint } from "lucide-react";
import { db } from "@/db";
import { animals } from "@/db/schema";
import { AnimalAvatar } from "@/components/farm/animal-avatar";
import { AnimalFormModal } from "@/components/farm/farm-forms";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { FarmTabs } from "../farm-tabs";

export const metadata: Metadata = { title: "Animals" };

export default async function AnimalsPage({ searchParams }: PageProps<"/farm/animals">) {
  const viewer = await getViewer();
  if (!viewer.can("farm")) notFound();
  const sp = await searchParams;
  const species = typeof sp.species === "string" ? sp.species : "all";
  const rows = await db.select().from(animals).where(eq(animals.familyId, viewer.family.id)).orderBy(asc(animals.species), asc(animals.name));
  const kinds = [...new Set(rows.map((r) => r.species))];
  const shown = rows.filter((r) => species === "all" || r.species === species);
  const canEdit = viewer.can("farm", "edit");
  const add = <AnimalFormModal defaultOpen={sp.new === "1"} />;
  return (
    <>
      <PageHeader eyebrow="Farm" title="Animals" description="Every animal, flock and hive, with health and production records." actions={canEdit ? add : undefined} />
      <FarmTabs active="animals" />
      {kinds.length > 1 && (
        <div className="mb-5">
          <SegmentLinks active={species} items={[{ key: "all", href: "/farm/animals", label: "All" }, ...kinds.map((k) => ({ key: k, href: `/farm/animals?species=${k}`, label: k }))]} />
        </div>
      )}
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<PawPrint />} title="No animals yet" description="Add individual animals or whole groups (a flock of 12 hens is one record)." action={canEdit ? cloneElement(add, { defaultOpen: false }) : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/farm/animals/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-primary-300">
                <AnimalAvatar species={a.species} photoUrl={fileUrl(a.imageFileId, true)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="truncate text-sm text-muted">{[a.headCount > 1 ? `${a.headCount} ${a.species.toLowerCase()}s` : a.species, a.breed, a.groupName].filter(Boolean).join(" · ")}</p>
                </div>
                {a.status !== "active" && <Badge>{a.status}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
