import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, rooms } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { requireParent } from "@/lib/dal";
import { ModulesForm, FamilyDetailsForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const DOMAIN_LABEL: Record<string, string> = {
  chore: "Chore categories",
  budget: "Budget categories",
  farm: "Farm categories",
  inventory: "Inventory categories",
  garden: "Garden categories",
  calendar: "Calendar categories",
  household: "Household categories",
  list: "List categories",
  recipe: "Recipe categories",
};

export default async function SettingsPage() {
  const viewer = await requireParent().catch(() => notFound());
  const f = viewer.family;
  const [roomRows, cats] = await Promise.all([
    db.select().from(rooms).where(eq(rooms.familyId, f.id)).orderBy(asc(rooms.sortOrder)),
    db.select().from(categories).where(and(eq(categories.familyId, f.id))).orderBy(asc(categories.domain), asc(categories.sortOrder)),
  ]);
  const grouped = Object.groupBy(cats, (c) => c.domain);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" description={`Customize the ${f.name} Family.`} />
      <Card>
        <CardHeader title="Family details" />
        <FamilyDetailsForm
          family={{ name: f.name, timezone: f.timezone, locationName: f.locationName, latitude: f.latitude, longitude: f.longitude }}
        />
      </Card>
      <Card>
        <CardHeader title="Areas" />
        <p className="mb-2 text-[15px] text-muted">Turn off anything your family doesn&apos;t use. It disappears from navigation, the dashboard and Quick Add.</p>
        <ModulesForm enabled={f.enabledModules} />
      </Card>
      <Card>
        <CardHeader title="Rooms & categories" />
        <p className="mb-4 text-[15px] text-muted">Set during setup. Full editing arrives with each area in upcoming phases.</p>
        <div className="flex flex-col gap-4">
          <TagGroup label="Rooms" items={roomRows.map((r) => r.name)} />
          {Object.entries(grouped).map(([domain, rows]) => (
            <TagGroup key={domain} label={DOMAIN_LABEL[domain] ?? domain} items={(rows ?? []).map((r) => r.name)} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function TagGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink-soft">{label}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) => (
            <Badge key={i}>{i}</Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">None yet</p>
      )}
    </div>
  );
}
