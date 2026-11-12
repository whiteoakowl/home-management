import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Bell, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { AUTOMATIONS } from "@/lib/automation";
import { requireParent } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { AutomationsForm, CategoryManager, FamilyDetailsForm, FamilyPhotoForm, ModulesForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const DOMAINS: { key: string; label: string }[] = [
  { key: "calendar", label: "Calendar categories" },
  { key: "chore", label: "Chore categories" },
  { key: "household", label: "Household categories" },
  { key: "list", label: "List categories" },
  { key: "inventory", label: "Inventory categories" },
  { key: "recipe", label: "Recipe categories" },
  { key: "budget", label: "Budget categories" },
  { key: "garden", label: "Garden categories" },
  { key: "farm", label: "Farm categories" },
];

export default async function SettingsPage() {
  const viewer = await requireParent().catch(() => notFound());
  const f = viewer.family;
  const cats = await db.select().from(categories).where(and(eq(categories.familyId, f.id))).orderBy(asc(categories.sortOrder), asc(categories.name));
  const grouped = Map.groupBy(cats, (c) => c.domain);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Settings" description={`Customize the ${f.name} Family.`} />
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Family details" />
          <FamilyDetailsForm family={{ name: f.name, timezone: f.timezone, locationName: f.locationName, latitude: f.latitude, longitude: f.longitude }} />
        </Card>
        <Card>
          <CardHeader title="Family photo" />
          <FamilyPhotoForm currentUrl={fileUrl(f.imageFileId, true)} />
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/family" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
          <ShieldCheck className="size-5 text-primary-600" />
          <span>
            <span className="block font-semibold">Members & permissions</span>
            <span className="text-sm text-muted">Open a member, then “Profile & access”.</span>
          </span>
        </Link>
        <Link href="/notifications" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
          <Bell className="size-5 text-primary-600" />
          <span>
            <span className="block font-semibold">Notification preferences</span>
            <span className="text-sm text-muted">Choose what you get reminded about.</span>
          </span>
        </Link>
      </div>
      <Card>
        <CardHeader title="Areas" />
        <p className="mb-2 text-[15px] text-muted">Turn off anything your family doesn&apos;t use. It disappears from navigation, the dashboard, search and Quick Add.</p>
        <ModulesForm enabled={f.enabledModules} />
      </Card>
      <Card>
        <CardHeader title="Automations" />
        <p className="mb-3 text-[15px] text-muted">Repetitive work happens automatically once a day. Switch off anything you&apos;d rather do by hand.</p>
        <AutomationsForm automations={AUTOMATIONS.map((a) => ({ ...a }))} settings={f.settings ?? {}} />
      </Card>
      <Card>
        <CardHeader title="Categories" />
        <p className="mb-4 text-[15px] text-muted">Customize the categories each area uses. Rooms are managed on the House page.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {DOMAINS.map((d) => (
            <CategoryManager key={d.key} domain={d.key} label={d.label} items={(grouped.get(d.key as "chore") ?? []).map((c) => ({ id: c.id, name: c.name, color: c.color }))} />
          ))}
        </div>
      </Card>
    </div>
  );
}
