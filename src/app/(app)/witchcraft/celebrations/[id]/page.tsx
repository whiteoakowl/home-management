import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { ArrowLeft, Receipt, ShoppingBasket } from "lucide-react";
import { celebrationShoppingList, deleteCelebration, recordCelebrationExpense } from "@/app/actions/craft";
import { FormModal } from "@/components/forms/action-form";
import { DateField, NumberField, TextField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { CraftCard } from "@/components/craft/craft-parts";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { DetailList, fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar } from "@/components/ui/display";
import { db } from "@/db";
import { celebrationLinks, celebrations, craftItems, recipes, transactions } from "@/db/schema";
import { craftVisible } from "@/lib/craft";
import { CELEBRATION_FIELDS } from "@/lib/craft-config";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { sabbatByKey } from "@/lib/sabbats";
import { craftViewer } from "../../shared";
import { CelebrationModal } from "../celebration-modal";

export const metadata: Metadata = { title: "Celebration" };

export default async function CelebrationPage({ params }: PageProps<"/witchcraft/celebrations/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await craftViewer();
  const [c] = await db.select().from(celebrations).where(and(eq(celebrations.id, id), eq(celebrations.familyId, viewer.family.id)));
  if (!c) notFound();
  const canEdit = viewer.can("witchcraft", "edit");
  const [links, recipeOpts, ritualOpts, spent] = await Promise.all([
    db.select().from(celebrationLinks).where(eq(celebrationLinks.celebrationId, c.id)),
    viewer.can("recipes") ? db.select({ id: recipes.id, name: recipes.name, imageFileId: recipes.imageFileId }).from(recipes).where(eq(recipes.familyId, viewer.family.id)).orderBy(asc(recipes.name)) : [],
    db.select().from(craftItems).where(and(craftVisible(viewer), or(eq(craftItems.kind, "ritual"), eq(craftItems.kind, "spell")), isNotNull(craftItems.familyId))).orderBy(asc(craftItems.name)),
    viewer.can("budget") ? db.select({ n: sql<number>`coalesce(sum(${transactions.amountCents}),0)::int` }).from(transactions).where(eq(transactions.celebrationId, c.id)) : [],
  ]);
  const linkedRecipes = recipeOpts.filter((r) => links.some((l) => l.recipeId === r.id));
  const linkedItems = links.filter((l) => l.craftItemId).length
    ? await db.select().from(craftItems).where(and(craftVisible(viewer), inArray(craftItems.id, links.map((l) => l.craftItemId!).filter(Boolean))))
    : [];
  const s = c.sabbat ? sabbatByKey(c.sabbat) : null;
  const img = fileUrl(c.imageFileId);
  const spentCents = spent[0]?.n ?? 0;
  const defaults = Object.fromEntries(CELEBRATION_FIELDS.map((f) => [f.name, (c as Record<string, unknown>)[f.name] as string | number | null]));
  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/witchcraft/celebrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Celebrations
      </Link>
      <CraftTabs active="celebrations" />
      <header className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {s && (
              <Link href={`/witchcraft/wheel/${s.key}`}>
                <Badge tone="olive">
                  {s.emoji} {s.name}
                </Badge>
              </Link>
            )}
            {c.date < todayIn(viewer.family.timezone) && <Badge>Past</Badge>}
          </div>
          <h1 className="text-[32px] leading-tight font-semibold">{c.name}</h1>
          <p className="text-ink-soft">{fmtDate(c.date)} · on the family calendar</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <CelebrationModal id={c.id} defaults={defaults} imageUrl={img} recipes={recipeOpts} rituals={ritualOpts} linked={links.map((l) => l.recipeId ?? l.craftItemId!).filter(Boolean)} />
            {viewer.can("shopping", "edit") && c.supplies && (
              <ActionButton action={celebrationShoppingList} fields={{ id: c.id }} className="h-11 rounded-[var(--radius-control)] bg-primary-50 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                <ShoppingBasket className="size-4" /> {c.shoppingListId ? "Update shopping list" : "Make shopping list"}
              </ActionButton>
            )}
            <DeleteButton action={deleteCelebration} fields={{ id: c.id }} what={`"${c.name}"`} />
          </div>
        )}
      </header>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={c.name} className="max-h-80 w-full rounded-[var(--radius-card)] object-cover" />
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <DetailList fields={CELEBRATION_FIELDS} values={c as never} skip={["name", "sabbat", "date", "budgetCents"]} />
        </Card>
        <div className="flex flex-col gap-6">
          {(c.budgetCents || viewer.can("budget")) && (
            <Card>
              <CardHeader
                title="Budget"
                icon={<Receipt className="size-4" />}
                action={
                  canEdit &&
                  viewer.can("budget", "edit") && (
                    <FormModal title="Record an expense" action={recordCelebrationExpense} triggerLabel="Expense" triggerVariant="soft" triggerSize="sm" size="sm" description="Recorded in the budget under Celebrations.">
                      <input type="hidden" name="id" value={c.id} />
                      <TextField name="what" label="For" placeholder="Candles & flowers" />
                      <NumberField name="amount" label="Amount ($)" step="0.01" min={0} required />
                      <DateField name="date" label="Date" defaultValue={todayIn(viewer.family.timezone)} />
                    </FormModal>
                  )
                }
              />
              <p className="text-sm">
                {fmtMoney(spentCents)} spent{c.budgetCents ? ` of ${fmtMoney(c.budgetCents)}` : ""}
              </p>
              {c.budgetCents ? <ProgressBar value={spentCents} max={c.budgetCents} tone={spentCents > c.budgetCents ? "wine" : "primary"} /> : null}
            </Card>
          )}
          {c.shoppingListId && (
            <Card>
              <Link href={`/shopping/${c.shoppingListId}`} className="flex items-center gap-2 font-medium text-primary-700">
                <ShoppingBasket className="size-4" /> Open the shopping list
              </Link>
            </Card>
          )}
          <Card>
            <CardHeader title="Feast recipes" />
            {linkedRecipes.length ? (
              <ul className="flex flex-col gap-1.5">
                {linkedRecipes.map((r) => (
                  <li key={r.id}>
                    <Link href={`/recipes/${r.id}`} className="text-sm font-medium text-primary-700 underline">
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Link recipes when you edit the celebration.</p>
            )}
          </Card>
        </div>
      </div>
      {linkedItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Rituals &amp; spells</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {linkedItems.map((i) => (
              <CraftCard key={i.id} it={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
