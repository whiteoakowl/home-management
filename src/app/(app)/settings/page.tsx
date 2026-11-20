import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Bell, CreditCard, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { AUTOMATIONS } from "@/lib/automation";
import { listFamilyMembers, requireParent } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { AppThemeForm } from "../account/forms";
import { saveFamilyTheme } from "@/app/actions/account";
import { DataControls } from "@/components/settings/data-controls";
import { FAITHS, FAITH_META, familyFaiths, faithPathsOf } from "@/lib/faith-config";
import { AutomationsForm, CategoryManager, FamilyDetailsForm, FamilyPhotoForm, FamilyFaithsForm, KidNamesForm, ModulesForm } from "./forms";

export const metadata: Metadata = { title: "Account settings" };

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
  const everyone = await listFamilyMembers(f.id);
  const parents = everyone.filter((m) => m.role === "parent");
  const cats = await db.select().from(categories).where(and(eq(categories.familyId, f.id))).orderBy(asc(categories.sortOrder), asc(categories.name));
  const grouped = Map.groupBy(cats, (c) => c.domain);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Account settings" description={`Customize the ${f.name} Family.`} />
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/family" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
          <ShieldCheck className="size-5 text-primary-600" />
          <span>
            <span className="block font-semibold">Members & permissions</span>
            <span className="text-sm text-muted">Open a member, then “Profile & access”.</span>
          </span>
        </Link>
        <Link href="/settings/billing" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary-300">
          <CreditCard className="size-5 text-primary-600" />
          <span>
            <span className="block font-semibold">Subscription</span>
            <span className="text-sm text-muted">Your plan, card, receipts or cancel.</span>
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
        <CardHeader title="Sections" />
        <p className="mb-2 text-[15px] text-muted">
          {viewer.isOwner
            ? "Turn off anything your family doesn't use (pool, farm, pets, dance, sports…). It disappears from the menu, the dashboard, search and Quick Add for everyone. Turn it back on anytime; nothing is deleted."
            : "Only the account owner (the person who created the family) can turn sections on or off."}
        </p>
        <ModulesForm enabled={f.enabledModules} readOnly={!viewer.isOwner} />
      </Card>
      <Card>
        <CardHeader title="What the kids call parents" />
        <p className="mb-4 text-[15px] text-muted">
          Kids (and other family members who aren&apos;t parents) see these names everywhere in the app: chores, calendar, chat and more. For example, Joe can show up as &ldquo;Dad&rdquo;. Parents still see real names. Leave a box empty to use the real name.
        </p>
        <KidNamesForm
          parents={parents.map((p) => ({ id: p.id, name: p.displayName, kidName: p.kidName ?? "", color: p.color, editable: viewer.isOwner || p.id === viewer.member.id }))}
        />
      </Card>

      {f.enabledModules.includes("witchcraft") && (
        <Card id="faith" className="scroll-mt-24">
          <CardHeader title="Religions & spiritual paths" />
          <p className="mb-4 text-[15px] text-muted">
            Check each religion your family uses. Each one becomes a tab in the Spiritual section, with its holidays, reading, devotions, prayer list and journal. Then choose which family members get each tab. Anyone with no religions doesn&apos;t see the Spiritual section.
          </p>
          <FamilyFaithsForm
            options={FAITHS.map((k) => ({ key: k, label: FAITH_META[k].label, emoji: FAITH_META[k].emoji, blurb: FAITH_META[k].blurb }))}
            enabled={familyFaiths(f)}
            members={everyone.map((m) => ({ id: m.id, name: m.displayName, color: m.color, role: m.role }))}
            access={Object.fromEntries(everyone.map((m) => [m.id, faithPathsOf(m, f)]))}
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Family colors" />
        <AppThemeForm
          current={f.theme?.accent ?? null}
          formAction={saveFamilyTheme}
          defaultLabel="Standard"
          note="Recolors buttons, highlights and tabs for the whole family. Anyone who picked their own colors in My settings keeps theirs."
        />
      </Card>
      <Card>
        <CardHeader title="Automations" />
        <p className="mb-3 text-[15px] text-muted">Repetitive work happens automatically once a day. Switch off anything you&apos;d rather do by hand.</p>
        <AutomationsForm automations={AUTOMATIONS.map((a) => ({ ...a }))} settings={f.settings ?? {}} />
      </Card>
      {viewer.isOwner && (
        <Card>
          <CardHeader title="Your family's data" />
          <p className="mb-4 text-[15px] text-muted">Download a copy of everything your family has added (other people&apos;s private journals and health records aren&apos;t included), or delete the family account and all its information for good.</p>
          <DataControls familyName={f.name} />
        </Card>
      )}

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
