import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { faithHref, faithPathsOf } from "@/lib/faith-config";
import type { ReactNode } from "react";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { BookOpen, CalendarHeart, Clock, Gem, Leaf, MoonStar, PackageOpen, Plus, Sparkles, Wand2 } from "lucide-react";
import { db } from "@/db";
import { celebrations, craftItems, inventoryItems, sectionLayouts } from "@/db/schema";
import { MoonCard, MoonDisc } from "@/components/craft/moon-card";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { DashboardCustomizer } from "@/components/dashboard/customizer";
import { fmtDate } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/display";
import { nextPhase } from "@/lib/astro";
import { collectionFor, craftVisible, ensureCraftReference, familyUpcomingSabbats, moonFor, upcomingMoonPhases } from "@/lib/craft";
import { CRAFT_META, type CraftKind } from "@/lib/craft-config";
import { daysBetween, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { resolveSectionLayout, sectionTitles } from "@/lib/widgets";
import { grimoireEntries } from "./grimoire/grimoire-lib";
import { craftViewer } from "./shared";

export const metadata: Metadata = { title: "Spiritual" };

const SPAN = { sm: "col-span-1", md: "col-span-1 md:col-span-2", lg: "col-span-1 md:col-span-2 xl:col-span-3" } as const;

function Row({ href, emoji, title, sub, right }: { href: string; emoji?: ReactNode; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 py-2.5 hover:text-primary-700">
        {emoji && (
          <span className="text-xl" aria-hidden>
            {emoji}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
        </span>
        {right && <span className="shrink-0 text-right text-sm">{right}</span>}
      </Link>
    </li>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export default async function SpiritualDashboard() {
  const viewer = await craftViewer();
  // Spiritual isn't one of my paths: open my first religion's tab instead.
  const paths = faithPathsOf(viewer.member);
  if (paths.length && !paths.includes("spiritual")) redirect(faithHref(paths[0]!));
  await ensureCraftReference();
  const fid = viewer.family.id;
  const tz = viewer.family.timezone;
  const today = todayIn(tz);
  const now = new Date();
  const moon = moonFor(viewer, today);
  const waxWane = moon.waxing ? "waxing" : "waning";
  const canEdit = viewer.can("witchcraft", "edit");

  const [saved, sabbats, cels, own, favs, collection, herbCount, supplies, entries] = await Promise.all([
    db.select().from(sectionLayouts).where(and(eq(sectionLayouts.memberId, viewer.member.id), eq(sectionLayouts.section, "spiritual"))),
    familyUpcomingSabbats(viewer, today, 4),
    db.select().from(celebrations).where(eq(celebrations.familyId, fid)).orderBy(asc(celebrations.date)),
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.familyId, fid))).orderBy(desc(craftItems.createdAt)),
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.isFavorite, true), inArray(craftItems.kind, ["spell", "ritual"]))).orderBy(asc(craftItems.name)),
    collectionFor(viewer),
    db.select({ n: count() }).from(craftItems).where(and(craftVisible(viewer), eq(craftItems.kind, "herb"))),
    db.select().from(inventoryItems).where(and(eq(inventoryItems.familyId, fid), eq(inventoryItems.location, "craft"))).orderBy(asc(inventoryItems.name)),
    grimoireEntries(viewer),
  ]);
  const layout = resolveSectionLayout("spiritual", saved[0]?.widgets);
  const upcomingCels = cels.filter((c) => c.date >= today).slice(0, 4);
  const suited = own.filter((i) => (i.kind === "spell" || i.kind === "ritual" || i.kind === "wellness") && (i.moonPhase === moon.phase || i.moonPhase === waxWane || i.moonPhase === "any")).slice(0, 4);
  const crystals = collection.filter((c) => c.item.kind === "crystal");
  const tools = collection.filter((c) => c.item.kind === "tool");
  const low = supplies.filter((s) => s.lowStockThreshold !== null && Number(s.quantity) <= Number(s.lowStockThreshold));
  const recentJournal = [...entries].sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 4);
  const recent = [
    ...own.map((i) => ({ id: i.id, at: i.createdAt, title: i.name, sub: CRAFT_META[i.kind as CraftKind]?.label ?? i.kind, emoji: i.emoji ?? CRAFT_META[i.kind as CraftKind]?.emoji, href: `/spiritual/item/${i.id}` })),
    ...entries.map((e) => ({ id: e.id, at: e.createdAt, title: e.title || e.body.slice(0, 60), sub: "Journal", emoji: "📖", href: "/spiritual/grimoire" })),
  ]
    .sort((a, b) => +b.at - +a.at)
    .slice(0, 6);
  const isEmpty = own.length === 0 && entries.length === 0 && collection.length === 0 && supplies.length === 0 && cels.length === 0;
  const full = nextPhase("full", now).at;
  const newMoon = nextPhase("new", now).at;
  const fmtMoon = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  const inDays = (d: Date) => Math.max(0, Math.ceil((+d - +now) / 86400000));
  const favOf = (kind: "spell" | "ritual") => favs.filter((i) => i.kind === kind).slice(0, 5);

  const cards: Record<string, ReactNode> = {
    moon: <MoonCard moon={moon} upcoming={upcomingMoonPhases(viewer)} tz={tz} />,
    nextMoons: (
      <Card>
        <CardHeader title="Next full & new moon" icon={<MoonStar className="size-4" />} href="/spiritual/moon" hrefLabel="Moon phases" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Full moon", d: full, m: { illumination: 1, waxing: true } },
            { label: "New moon", d: newMoon, m: { illumination: 0, waxing: true } },
          ].map((x) => (
            <div key={x.label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-sunken/60 p-3 text-center">
              <MoonDisc moon={x.m} size={44} />
              <span className="font-celestial text-sm text-gold">{x.label}</span>
              <span className="text-sm font-medium">{fmtMoon(x.d)}</span>
              <span className="text-xs text-muted">{inDays(x.d) === 0 ? "Tonight" : `in ${inDays(x.d)} days`}</span>
            </div>
          ))}
        </div>
      </Card>
    ),
    wheel: (
      <Card>
        <CardHeader title="Wheel of the Year" icon={<CalendarHeart className="size-4" />} href="/spiritual/wheel" hrefLabel="Open wheel" />
        <ul className="divide-y divide-line">
          {sabbats.map((x) => (
            <Row key={x.key + x.date} href={`/spiritual/wheel/${x.key}`} emoji={x.s.emoji} title={x.s.name} sub={x.s.theme} right={<>{fmtDate(x.date)}<span className="block text-xs text-muted">{daysBetween(today, x.date) === 0 ? "Today" : `in ${daysBetween(today, x.date)} days`}</span></>} />
          ))}
        </ul>
      </Card>
    ),
    celebrations: (
      <Card>
        <CardHeader title="Upcoming celebrations" icon={<Sparkles className="size-4" />} href="/spiritual/celebrations" />
        {upcomingCels.length ? (
          <ul className="divide-y divide-line">
            {upcomingCels.map((c) => (
              <Row key={c.id} href={`/spiritual/celebrations/${c.id}`} emoji="🕯️" title={c.name} right={fmtDate(c.date)} />
            ))}
          </ul>
        ) : (
          <Quiet>No celebrations planned. Plan a sabbat feast or a moon gathering from the Wheel of the Year.</Quiet>
        )}
      </Card>
    ),
    journal: (
      <Card>
        <CardHeader title="Recent journal entries" icon={<BookOpen className="size-4" />} href="/spiritual/grimoire" hrefLabel="Grimoire" />
        {recentJournal.length ? (
          <ul className="divide-y divide-line">
            {recentJournal.map((e) => (
              <Row key={e.id} href="/spiritual/grimoire" emoji="📖" title={e.title || e.body.slice(0, 60)} sub={e.body.slice(0, 120)} right={fmtDate(e.date)} />
            ))}
          </ul>
        ) : (
          <Quiet>Your grimoire is empty. Record reflections, moon logs, dreams and readings; entries stay private unless you share them.</Quiet>
        )}
      </Card>
    ),
    forMoon: (
      <Card>
        <CardHeader title={`For the ${moon.label.toLowerCase()}`} icon={<MoonStar className="size-4" />} />
        {suited.length ? (
          <ul className="divide-y divide-line">
            {suited.map((i) => (
              <Row key={i.id} href={`/spiritual/item/${i.id}`} emoji={i.emoji ?? CRAFT_META[i.kind as CraftKind]?.emoji} title={i.name} sub={CRAFT_META[i.kind as CraftKind]?.label} />
            ))}
          </ul>
        ) : (
          <Quiet>Tag your spells, rituals and practices with a moon phase and they&apos;ll appear here at the right time.</Quiet>
        )}
      </Card>
    ),
    rituals: (
      <Card>
        <CardHeader title="Favorite rituals" icon={<Wand2 className="size-4" />} href="/spiritual/library/ritual" />
        {favOf("ritual").length ? (
          <ul className="divide-y divide-line">
            {favOf("ritual").map((i) => (
              <Row key={i.id} href={`/spiritual/item/${i.id}`} emoji={i.emoji ?? "🕯️"} title={i.name} sub={i.description ?? undefined} />
            ))}
          </ul>
        ) : (
          <Quiet>Mark rituals as favorites to keep them close.</Quiet>
        )}
      </Card>
    ),
    spells: (
      <Card>
        <CardHeader title="Favorite spells" icon={<Sparkles className="size-4" />} href="/spiritual/library/spell" />
        {favOf("spell").length ? (
          <ul className="divide-y divide-line">
            {favOf("spell").map((i) => (
              <Row key={i.id} href={`/spiritual/item/${i.id}`} emoji={i.emoji ?? "✨"} title={i.name} sub={i.description ?? undefined} />
            ))}
          </ul>
        ) : (
          <Quiet>Mark spells as favorites to keep them close.</Quiet>
        )}
      </Card>
    ),
    crystals: (
      <Card>
        <CardHeader title="Crystal collection" icon={<Gem className="size-4" />} href="/spiritual/collection" hrefLabel="Collection" />
        {crystals.length ? (
          <div className="flex flex-wrap gap-2">
            {crystals.slice(0, 10).map(({ c, item }) => (
              <Link key={c.id} href={`/spiritual/item/${item.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken/60 px-3 py-1 text-sm hover:border-primary-300">
                <span aria-hidden>{item.emoji ?? "🔮"}</span>
                {item.name}
              </Link>
            ))}
          </div>
        ) : (
          <Quiet>
            No crystals yet. Add pieces you own from the <Link href="/spiritual/library/crystal" className="text-primary-700 underline">crystal library</Link>.
          </Quiet>
        )}
      </Card>
    ),
    herbs: (
      <Card>
        <CardHeader title="Herbal database" icon={<Leaf className="size-4" />} href="/spiritual/library/herb" hrefLabel="Browse" />
        <p className="font-display text-3xl font-semibold">{herbCount[0]?.n ?? 0}</p>
        <Quiet>herbs with folklore, traditional use and safety notes kept clearly apart.</Quiet>
        {own.some((i) => i.kind === "herb") && <p className="mt-2 text-sm">{own.filter((i) => i.kind === "herb").length} added by your family</p>}
      </Card>
    ),
    tools: (
      <Card>
        <CardHeader title="Tools" icon={<Wand2 className="size-4" />} href="/spiritual/library/tool" />
        {tools.length ? (
          <ul className="divide-y divide-line">
            {tools.slice(0, 5).map(({ c, item }) => (
              <Row key={c.id} href={`/spiritual/item/${item.id}`} emoji={item.emoji ?? "🪄"} title={item.name} />
            ))}
          </ul>
        ) : (
          <Quiet>Add the tools you own (athame, chalice, wand…) from the tool library.</Quiet>
        )}
      </Card>
    ),
    supplies: (
      <Card>
        <CardHeader title="Supplies" icon={<PackageOpen className="size-4" />} href="/spiritual/supplies" />
        {supplies.length ? (
          <>
            <p className="text-sm">
              <span className="font-display text-2xl font-semibold">{supplies.length}</span> <span className="text-muted">items on hand</span>
            </p>
            {low.length > 0 && <p className="mt-2 rounded-xl bg-olive-50 px-3 py-2 text-sm text-olive-700">Running low: {low.map((s) => s.name).join(", ")}</p>}
          </>
        ) : (
          <Quiet>Track candles, oils, incense and herbs so you know what you have on hand.</Quiet>
        )}
      </Card>
    ),
    recent: (
      <Card>
        <CardHeader title="Recently added" icon={<Clock className="size-4" />} />
        {recent.length ? (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <Row key={r.id} href={r.href} emoji={r.emoji} title={r.title} sub={r.sub} right={<span className="text-xs text-muted">{fmtDate(r.at.toISOString().slice(0, 10))}</span>} />
            ))}
          </ul>
        ) : (
          <Quiet>Spells, rituals, practices and journal entries you add will appear here.</Quiet>
        )}
      </Card>
    ),
  };

  return (
    <>
      <header className="celestial-hero relative mb-6 overflow-hidden rounded-[var(--radius-card)] border border-gold px-5 py-6 sm:px-8 sm:py-8">
        <svg className="pointer-events-none absolute -top-6 right-4 h-40 w-40 text-[#e0c27e] opacity-25 sm:right-10" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.6" aria-hidden>
          <circle cx="50" cy="50" r="46" />
          <circle cx="50" cy="50" r="34" strokeDasharray="1 3" />
          <path d="M50 4v92M4 50h92M17 17l66 66M83 17 17 83" strokeOpacity="0.5" />
          <circle cx="22" cy="30" r="1.4" fill="currentColor" />
          <circle cx="70" cy="22" r="1.1" fill="currentColor" />
          <circle cx="78" cy="68" r="1.4" fill="currentColor" />
          <path d="M22 30 L70 22 L78 68" strokeOpacity="0.8" />
        </svg>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-celestial text-sm text-gold">The {viewer.family.name} Library of Moon &amp; Spirit</p>
            <h1 className="mt-1 text-[30px] leading-tight font-semibold sm:text-[38px]">Spiritual</h1>
            <p className="mt-1 max-w-2xl text-[15px] text-muted">Moon cycles, the Wheel of the Year, rituals, spells, your grimoire, and libraries of crystals, herbs and tools.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardCustomizer layout={layout} titles={sectionTitles("spiritual")} section="spiritual" label="Spiritual dashboard" />
            {canEdit && (
              <ButtonLink href="/spiritual/grimoire?new=1" icon={<Plus className="size-4" />}>
                Add Entry
              </ButtonLink>
            )}
          </div>
        </div>
      </header>
      <CraftTabs active="dashboard" />
      {isEmpty && (
        <Card className="mb-6 border-gold">
          <EmptyState
            icon={<MoonStar />}
            title="Begin building your personal spiritual library."
            description="Write a journal entry, record a ritual or spell, or add the crystals and tools you own. The moon, the Wheel of the Year and the reference libraries are ready now."
            action={
              canEdit && (
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/spiritual/grimoire?new=1" icon={<Plus className="size-4" />}>
                    Add Entry
                  </ButtonLink>
                  <ButtonLink href="/spiritual/library/ritual?new=1" variant="secondary">
                    Add a ritual
                  </ButtonLink>
                  <ButtonLink href="/spiritual/library/spell?new=1" variant="secondary">
                    Add a spell
                  </ButtonLink>
                </div>
              )
            }
          />
        </Card>
      )}
      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6 [&>*]:min-w-0">
        {layout
          .filter((w) => w.visible)
          .map((w) => (
            <div key={w.id} className={cn(SPAN[w.size])}>
              {cards[w.id]}
            </div>
          ))}
      </div>
    </>
  );
}
