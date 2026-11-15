import { cloneElement } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { AlarmClock, Refrigerator, ChefHat, Receipt, ScanBarcode, ShoppingBasket } from "lucide-react";
import { db } from "@/db";
import { categories, inventoryItems } from "@/db/schema";
import { restockLowItems } from "@/app/actions/kitchen";
import { ActionButton } from "@/components/forms/inline";
import { InventoryFormModal } from "@/components/kitchen/inventory-form";
import { InventoryRow, type InventoryRowData } from "@/components/kitchen/inventory-row";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/display";
import { LinkTabs } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { FoodSpaceNav, PrivateSpaceNote } from "@/components/food/food-space-nav";
import { canAddIn, canChange, canOpenFood, inSpace, privateSpaceMembers, resolveSpace, withSpace } from "@/lib/food-space";
import { redirect } from "next/navigation";
import { daysBetween, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { categoryOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Family Pantry" };

const VIEWS = [
  { key: "all", label: "Everything" },
  { key: "pantry", label: "Pantry" },
  { key: "fridge", label: "Refrigerator" },
  { key: "freezer", label: "Freezer" },
  { key: "supplies", label: "Supplies" },
  { key: "pets", label: "Pet supplies", optional: true },
  { key: "craft", label: "Craft supplies", optional: true },
  { key: "home", label: "Home supplies", optional: true },
  { key: "expiring", label: "Expiring" },
];
const LOCATION_VIEWS = ["pantry", "fridge", "freezer", "supplies", "pets", "craft", "home"];

const EMPTY_COPY: Record<string, { title: string; desc: string; example: string }> = {
  all: { title: "No food has been added yet.", desc: "Add what's in your pantry, fridge and freezer and we'll keep an eye on expiry dates.", example: "Scan a barcode, or add “Eggs: 12, fridge”" },
  pantry: { title: "Nothing in the pantry yet", desc: "Track canned goods, baking supplies, grains and snacks.", example: "Flour · 5 lb · Expires Mar 2027" },
  fridge: { title: "Nothing in the fridge yet", desc: "Track milk, eggs, produce and leftovers.", example: "Milk · 1 gal · Expires Friday" },
  freezer: { title: "Nothing in the freezer yet", desc: "Track meat, frozen veggies and batch-cooked meals.", example: "Ground beef · 2 lb" },
  supplies: { title: "No kitchen supplies tracked", desc: "Cleaning supplies, paper products, storage bags and more.", example: "Paper towels · 6 rolls · alert at 2" },
  expiring: { title: "Nothing expiring soon", desc: "Items expiring in the next 30 days will show up here.", example: "" },
};

export default async function KitchenPage({ searchParams }: PageProps<"/kitchen">) {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "kitchen")) notFound();
  const sp = await searchParams;
  const space = await resolveSpace(viewer, sp.space);
  if (space.kind === "family" && !viewer.can("kitchen")) redirect("/kitchen?space=mine");
  const isPrivate = space.kind === "private";
  const view = VIEWS.some((v) => v.key === sp.view && !(isPrivate && "optional" in v)) ? String(sp.view) : "all";
  const today = todayIn(viewer.family.timezone);
  const canEdit = canAddIn(viewer, "kitchen", space);
  const owner = inSpace(inventoryItems.ownerMemberId, space);

  const [cats, rows, counts] = await Promise.all([
    categoryOptions(viewer, "inventory"),
    db
      .select({ i: inventoryItems, categoryName: categories.name })
      .from(inventoryItems)
      .leftJoin(categories, eq(categories.id, inventoryItems.categoryId))
      .where(
        and(
          eq(inventoryItems.familyId, viewer.family.id),
          owner,
          isNull(inventoryItems.archivedAt),
          LOCATION_VIEWS.includes(view) ? eq(inventoryItems.location, view as "pantry") : undefined,
          view === "expiring" ? sql`${inventoryItems.expiresOn} <= ${today}::date + 30` : undefined,
        ),
      )
      .orderBy(sql`${inventoryItems.expiresOn} asc nulls last`, asc(inventoryItems.name)),
    db
      .select({ location: inventoryItems.location, n: sql<number>`count(*)::int`, expiring: sql<number>`count(*) filter (where ${inventoryItems.expiresOn} <= ${today}::date + 7)::int` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.familyId, viewer.family.id), owner, isNull(inventoryItems.archivedAt)))
      .groupBy(inventoryItems.location),
  ]);

  const items: (InventoryRowData & { ownerMemberId: string | null; createdByMemberId: string | null })[] = rows.map(({ i, categoryName }) => ({
    ...i,
    quantity: i.quantity,
    lowStockThreshold: i.lowStockThreshold,
    daysLeft: i.expiresOn ? daysBetween(today, i.expiresOn) : null,
    categoryName,
    thumbUrl: fileUrl(i.imageFileId, true),
    imageUrl: fileUrl(i.imageFileId),
  }));
  const countFor = (k: string) => (k === "all" ? counts.reduce((s, c) => s + c.n, 0) : k === "expiring" ? counts.reduce((s, c) => s + c.expiring, 0) : (counts.find((c) => c.location === k)?.n ?? 0));
  const lowCount = items.filter((i) => i.lowStockThreshold != null && Number(i.quantity) <= Number(i.lowStockThreshold)).length;

  const groups =
    view === "expiring"
      ? [
          { key: "expired", label: "Expired", items: items.filter((i) => i.daysLeft !== null && i.daysLeft < 0) },
          { key: "today", label: "Expiring today", items: items.filter((i) => i.daysLeft === 0) },
          { key: "week", label: "This week", items: items.filter((i) => i.daysLeft !== null && i.daysLeft > 0 && i.daysLeft <= 7) },
          { key: "soon", label: "Expiring soon", items: items.filter((i) => i.daysLeft !== null && i.daysLeft > 7) },
        ]
      : [{ key: "all", label: "", items }];

  const copy = EMPTY_COPY[view]!;
  const add = <InventoryFormModal categories={cats} defaults={{ location: LOCATION_VIEWS.includes(view) ? view : "pantry" }} defaultOpen={sp.new === "1"} privateSpace={isPrivate} />;
  const others = await privateSpaceMembers(viewer);
  const title = isPrivate ? (space.own ? "My Pantry" : `${space.memberName}'s Pantry`) : "Family Pantry";

  return (
    <>
      <PageHeader
        eyebrow={isPrivate ? "My private food" : "Family Pantry"}
        title={title}
        description={isPrivate ? "Your own food: pantry, fridge and freezer, private to you." : "What's in the family's pantry, fridge and freezer, and what needs using up."}
        actions={
          canEdit ? (
            <>
              {(isPrivate || viewer.can("recipes")) && (
                <ButtonLink href={withSpace("/kitchen/cook", space)} variant="secondary" icon={<ChefHat className="size-4" />}>
                  What can I cook?
                </ButtonLink>
              )}
              <ButtonLink href={withSpace("/kitchen/scan", space)} variant="secondary" icon={<ScanBarcode className="size-4" />}>
                Scan
              </ButtonLink>
              <ButtonLink href="/kitchen/receipt" variant="secondary" icon={<Receipt className="size-4" />}>
                Scan receipt
              </ButtonLink>
              {add}
            </>
          ) : undefined
        }
      />
      <FoodSpaceNav viewer={viewer} active="kitchen" space={space} others={others} />
      <PrivateSpaceNote space={space} viewer={viewer} />
      <LinkTabs active={view} tabs={VIEWS.filter((v) => !(isPrivate && "optional" in v) && (!("optional" in v) || countFor(v.key) > 0 || v.key === view)).map((v) => ({ key: v.key, href: withSpace(`/kitchen?view=${v.key}`, space), label: v.label, count: countFor(v.key) }))} />

      {lowCount > 0 && !isPrivate && viewer.can("shopping", "add") && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive-100 bg-olive-50 px-4 py-3">
          <p className="flex items-center gap-2 text-[15px] text-olive-700">
            <AlarmClock className="size-4" /> {lowCount} item{lowCount === 1 ? " is" : "s are"} running low.
          </p>
          <ActionButton action={restockLowItems} fields={{}} className="h-9 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-sunken">
            <ShoppingBasket className="size-4" /> Add to shopping list
          </ActionButton>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={view === "expiring" ? <AlarmClock /> : <Refrigerator />}
            title={copy.title}
            description={copy.desc}
            example={copy.example || undefined}
            action={canEdit && view !== "expiring" ? cloneElement(add, { defaultOpen: false }) : undefined}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key}>
                {g.label && <h2 className="mb-2 text-lg font-semibold">{g.label}</h2>}
                <ul className="grid gap-2 lg:grid-cols-2">
                  {g.items.map((i) => (
                    <InventoryRow key={i.id} item={i} categories={cats} canEdit={canChange(viewer, "kitchen", i)} showLocation={view === "all" || view === "expiring"} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      {view !== "expiring" && countFor("expiring") > 0 && (
        <p className="mt-6 text-sm text-muted">
          {countFor("expiring")} item{countFor("expiring") === 1 ? "" : "s"} expire within a week.{" "}
          <Link href={withSpace("/kitchen?view=expiring", space)} className="font-medium text-primary-600 hover:underline">
            See what to use first →
          </Link>
        </p>
      )}
    </>
  );
}
