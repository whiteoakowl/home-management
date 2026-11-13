import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import { BookOpen, CalendarHeart, Gem, Leaf, PackageOpen, Sparkles, Wand2 } from "lucide-react";
import { db } from "@/db";
import { celebrations, craftItems, inventoryItems } from "@/db/schema";
import { MoonCard } from "@/components/craft/moon-card";
import { CraftCard } from "@/components/craft/craft-parts";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { craftVisible, ensureCraftReference, familyUpcomingSabbats, moonFor, upcomingMoonPhases } from "@/lib/craft";
import { daysBetween, todayIn } from "@/lib/dates";
import { craftViewer } from "./shared";

export const metadata: Metadata = { title: "Witchcraft" };

export default async function WitchcraftDashboard() {
  const viewer = await craftViewer();
  await ensureCraftReference();
  const today = todayIn(viewer.family.timezone);
  const moon = moonFor(viewer, today);
  const phaseKey = moon.phase;
  const waxWane = moon.waxing ? "waxing" : "waning";
  const [sabbats, cels, forMoon, favs, supplies] = await Promise.all([
    familyUpcomingSabbats(viewer, today, 3),
    db.select().from(celebrations).where(and(eq(celebrations.familyId, viewer.family.id), gte(celebrations.date, today))).orderBy(asc(celebrations.date)).limit(4),
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.familyId, viewer.family.id))).orderBy(asc(craftItems.name)),
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.isFavorite, true))).orderBy(asc(craftItems.name)).limit(6),
    db.select().from(inventoryItems).where(and(eq(inventoryItems.familyId, viewer.family.id), eq(inventoryItems.location, "craft"))),
  ]);
  const suited = forMoon.filter((i) => (i.kind === "spell" || i.kind === "ritual" || i.kind === "wellness") && (i.moonPhase === phaseKey || i.moonPhase === waxWane || i.moonPhase === "any")).slice(0, 4);
  const low = supplies.filter((s) => s.lowStockThreshold !== null && Number(s.quantity) <= Number(s.lowStockThreshold));
  const links = [
    { href: "/witchcraft/library/spell", label: "Spells", icon: Sparkles },
    { href: "/witchcraft/library/ritual", label: "Rituals", icon: Wand2 },
    { href: "/witchcraft/grimoire", label: "Grimoire", icon: BookOpen },
    { href: "/witchcraft/library/crystal", label: "Crystals", icon: Gem },
    { href: "/witchcraft/library/herb", label: "Herbs", icon: Leaf },
    { href: "/witchcraft/supplies", label: "Supplies", icon: PackageOpen },
  ];
  return (
    <>
      <PageHeader eyebrow="Spirit" title="Witchcraft & Spirituality" description="Moon cycles, the Wheel of the Year, spells, rituals, your grimoire and a reference library of crystals, herbs and tools." />
      <CraftTabs active="dashboard" />
      <MoonCard moon={moon} upcoming={upcomingMoonPhases(viewer)} tz={viewer.family.timezone} className="mb-6" />
      <div className="mb-6 grid grid-cols-3 gap-3 md:grid-cols-6">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center text-sm font-medium transition-colors hover:border-primary-300">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <l.icon className="size-5" aria-hidden />
            </span>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Wheel of the Year" icon={<CalendarHeart className="size-4" />} href="/witchcraft/wheel" hrefLabel="Open wheel" />
          <ul className="divide-y divide-line">
            {sabbats.map((x) => (
              <li key={x.key + x.date}>
                <Link href={`/witchcraft/wheel/${x.key}`} className="flex items-center gap-3 py-2.5 hover:text-primary-700">
                  <span className="text-2xl" aria-hidden>
                    {x.s.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{x.s.name}</span>
                    <span className="text-sm text-muted">{x.s.theme}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {fmtDate(x.date)}
                    <span className="block text-xs text-muted">{daysBetween(today, x.date) === 0 ? "Today" : `in ${daysBetween(today, x.date)} days`}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Upcoming celebrations" icon={<CalendarHeart className="size-4" />} href="/witchcraft/celebrations" />
          {cels.length ? (
            <ul className="divide-y divide-line">
              {cels.map((c) => (
                <li key={c.id}>
                  <Link href={`/witchcraft/celebrations/${c.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary-700">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-sm text-muted">{fmtDate(c.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Plan a sabbat feast or a moon gathering from the Wheel of the Year.</p>
          )}
        </Card>
        <Card>
          <CardHeader title={`For the ${moon.label.toLowerCase()}`} icon={<Sparkles className="size-4" />} />
          {suited.length ? (
            <div className="grid gap-3">
              {suited.map((i) => (
                <CraftCard key={i.id} it={i} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Tag your spells, rituals and practices with a moon phase and they&apos;ll show up here at the right time.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Favorites" icon={<Sparkles className="size-4" />} />
          {favs.length ? (
            <div className="grid gap-3">
              {favs.map((i) => (
                <CraftCard key={i.id} it={i} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Mark spells, rituals and practices as favorites to keep them close.</p>
          )}
          {low.length > 0 && (
            <p className="mt-4 rounded-xl bg-olive-50 px-3 py-2 text-sm text-olive-700">
              Running low: {low.map((s) => s.name).join(", ")}.{" "}
              <Link href="/witchcraft/supplies" className="font-medium underline">
                Supplies
              </Link>
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
