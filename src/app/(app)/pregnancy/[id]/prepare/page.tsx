import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { addChecklist, deletePregnancyItem } from "@/app/actions/pregnancy";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PregnancyItemModal, StatusSelect } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { CHECKLISTS, type ChecklistGroup } from "@/lib/pregnancy/catalog";
import { itemsOf, type PItem } from "@/lib/pregnancy/queries";
import { PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Prepare for baby" };

export default async function PreparePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ area?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, g, can, has } = ctx;
  const week = g?.week ?? 0;
  // Third-trimester tools come forward automatically from week 28.
  const area = (["prepare", "third", "postpartum"] as const).find((a) => a === sp.area) ?? (week >= 28 ? "third" : "prepare");
  const items = await itemsOf(p.id, "checklist");
  const feat = area === "postpartum" ? "postpartum" : "checklists";
  const edit = can(feat);
  const groups = CHECKLISTS.filter((c) => c.area === area);
  const known = new Set(CHECKLISTS.map((c) => c.key));
  const custom = area === "prepare" ? items.filter((i) => !known.has(i.list ?? "")) : [];

  const group = (c: Pick<ChecklistGroup, "key" | "title" | "emoji" | "fromWeek">, rows: PItem[]) => {
    const done = rows.filter((r) => r.done).length;
    return (
      <Card key={c.key}>
        <CardHeader title={`${c.emoji} ${c.title}`} action={edit && rows.length > 0 ? <PregnancyItemModal pregnancyId={p.id} kind="checklist" list={c.key} triggerLabel="Add" /> : undefined} />
        {c.fromWeek && week < c.fromWeek && <p className="mb-2 text-xs text-muted">Most people start this around week {c.fromWeek}.</p>}
        {rows.length ? (
          <>
            <ProgressBar value={done} max={rows.length} label={`${done} of ${rows.length} done`} tone="olive" />
            <p className="mt-1 mb-2 text-xs text-muted">
              {done} of {rows.length} done
            </p>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className={`min-w-0 flex-1 text-[15px] ${r.done ? "text-muted line-through" : ""}`}>
                    {r.title}
                    {r.notes && <span className="block text-xs text-muted no-underline">{r.notes}</span>}
                  </span>
                  <StatusSelect id={r.id} value={r.status ?? "needed"} disabled={!edit} />
                  {edit && (
                    <>
                      <PregnancyItemModal pregnancyId={p.id} kind="checklist" item={{ id: r.id, title: r.title, list: r.list, status: r.status, notes: r.notes, rating: null, appointmentId: null, data: r.data }} triggerContent={<Pencil className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken" />
                      <DeleteButton action={deletePregnancyItem} fields={{ id: r.id }} what={r.title} className="size-8" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : edit ? (
          <div className="flex flex-wrap gap-2">
            {known.has(c.key) && (
              <ActionButton action={addChecklist} fields={{ pregnancyId: p.id, list: c.key }} className="h-10 rounded-xl bg-primary-50 px-3 text-sm font-medium text-primary-700 ring-1 ring-primary-200">
                Add starter list
              </ActionButton>
            )}
            <PregnancyItemModal pregnancyId={p.id} kind="checklist" list={c.key} triggerLabel="Add my own" />
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing here yet.</p>
        )}
      </Card>
    );
  };

  return (
    <>
      <PregnancyHeader ctx={ctx} active="prepare" />
      {!has(feat) && <PremiumLocked f={feat} />}
      <div className="mb-4">
        <SegmentLinks
          active={area}
          items={[
            { key: "prepare", label: "For baby", href: "?area=prepare" },
            { key: "third", label: "Third trimester", href: "?area=third" },
            { key: "postpartum", label: "After the birth", href: "?area=postpartum" },
          ]}
        />
      </div>
      {area === "third" && (
        <p className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
          🎒 Hospital bag, pre-registration, childcare and pet plans, the route to the hospital and important contacts. Your birth preferences live in the <a href={`/pregnancy/${p.id}/birth-plan`} className="font-medium underline">Birth plan</a> tab, and the <a href={`/pregnancy/${p.id}/contractions`} className="font-medium underline">contraction timer</a> is ready when you need it.
        </p>
      )}
      {area === "postpartum" && (
        <p className="mb-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm">
          🤝 Plan for rest, meals, help at home and check-ups. Recovery looks different for everyone. Lean on your support people and your provider.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((c) => group(c, items.filter((i) => i.list === c.key)))}
        {area === "prepare" && group({ key: "custom", title: "My own list", emoji: "📝" }, custom)}
      </div>
    </>
  );
}
