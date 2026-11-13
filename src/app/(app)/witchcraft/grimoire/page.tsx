import type { Metadata } from "next";
import { and, asc, eq, inArray } from "drizzle-orm";
import { BookOpen, Heart, Printer } from "lucide-react";
import { deleteGrimoireEntry, saveGrimoireEntry, toggleGrimoireFavorite } from "@/app/actions/craft";
import { FormModal } from "@/components/forms/action-form";
import { DateField, SelectField, TextAreaField, TextField, VisibilityField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { fmtDate } from "@/components/records/detail-list";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { craftItems } from "@/db/schema";
import { PHASE_LABEL, type PhaseName } from "@/lib/astro";
import { craftVisible, moonFor } from "@/lib/craft";
import { GRIMOIRE_CATEGORIES } from "@/lib/craft-config";
import { todayIn } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { craftViewer } from "../shared";
import { grimoireEntries } from "./grimoire-lib";

export const metadata: Metadata = { title: "Grimoire" };

type Entry = Awaited<ReturnType<typeof grimoireEntries>>[number];

function EntryModal({ e, members, spells, today, moon }: { e?: Entry; members: { id: string; displayName: string; color: string }[]; spells: { id: string; name: string }[]; today: string; moon: string }) {
  return (
    <FormModal
      title={e ? "Edit entry" : "New grimoire entry"}
      action={saveGrimoireEntry}
      triggerLabel="New entry"
      triggerContent={e ? <span className="text-sm font-medium">Edit</span> : undefined}
      triggerClassName={e ? "h-9 rounded-full px-3 text-ink-soft hover:bg-sunken" : undefined}
      size="lg"
    >
      {e && <input type="hidden" name="id" value={e.id} />}
      <TextField name="title" label="Title" defaultValue={e?.title ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <DateField name="date" label="Date" defaultValue={e?.date ?? today} />
        <SelectField name="category" label="Type" defaultValue={e?.category ?? "reflection"} options={GRIMOIRE_CATEGORIES} />
        <SelectField name="moonPhase" label="Moon" defaultValue={e?.moonPhase ?? moon} options={Object.entries(PHASE_LABEL).map(([value, label]) => ({ value, label }))} placeholder="—" />
      </div>
      <TextAreaField name="body" label="Entry" rows={8} defaultValue={e?.body ?? ""} required />
      {spells.length > 0 && <SelectField name="linkedId" label="About a spell or ritual" defaultValue={e?.linkedId ?? ""} placeholder="—" options={spells.map((s) => ({ value: s.id, label: s.name }))} />}
      <TextField name="tags" label="Tags" defaultValue={e?.tags.join(", ") ?? ""} hint="Comma separated" />
      <VisibilityField members={members} defaultValue={e?.visibility ?? "private"} privateLabel="Only me" />
    </FormModal>
  );
}

export default async function GrimoirePage({ searchParams }: PageProps<"/witchcraft/grimoire">) {
  const viewer = await craftViewer();
  const sp = (await searchParams) as { q?: string; category?: string };
  const today = todayIn(viewer.family.timezone);
  const [members, entries, spells] = await Promise.all([
    memberOptions(viewer),
    grimoireEntries(viewer),
    db.select({ id: craftItems.id, name: craftItems.name }).from(craftItems).where(and(craftVisible(viewer), inArray(craftItems.kind, ["spell", "ritual"]), eq(craftItems.familyId, viewer.family.id))).orderBy(asc(craftItems.name)),
  ]);
  const q = sp.q?.toLowerCase().trim();
  const shown = entries.filter((e) => (!sp.category || e.category === sp.category) && (!q || `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase().includes(q)));
  const canEdit = viewer.can("witchcraft", "edit");
  const moon = moonFor(viewer, today).phase;
  const cat = (v: string | null) => GRIMOIRE_CATEGORIES.find((c) => c.value === v)?.label;
  return (
    <>
      <PageHeader
        eyebrow="Witchcraft"
        title="Grimoire"
        description="Your Book of Shadows: reflections, moon logs, dreams, readings and spell results. Entries are private unless you share them."
        actions={
          <>
            <ButtonLink href="/witchcraft/grimoire/print" variant="secondary" icon={<Printer className="size-4" />}>
              Printable grimoire
            </ButtonLink>
            {canEdit && <EntryModal members={members} spells={spells} today={today} moon={moon} />}
          </>
        }
      />
      <CraftTabs active="grimoire" />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search your grimoire…" aria-label="Search grimoire" className="h-10 min-w-56 flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm" />
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Type" className="h-10 rounded-full border border-line-strong bg-surface px-3 text-sm">
          <option value="">All entries</option>
          {GRIMOIRE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {shown.length ? (
        <ul className="flex flex-col gap-4">
          {shown.map((e) => {
            const author = members.find((m) => m.id === e.authorMemberId);
            const mine = e.authorMemberId === viewer.member.id;
            return (
              <li key={e.id}>
                <Card className="bg-gradient-to-br from-surface to-primary-50/40">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        {author && <Avatar name={author.displayName} color={author.color} size="xs" />}
                        {fmtDate(e.date)}
                        {e.moonPhase && <span>· {PHASE_LABEL[e.moonPhase as PhaseName] ?? e.moonPhase}</span>}
                        {cat(e.category) && <Badge tone="primary">{cat(e.category)}</Badge>}
                        {e.visibility === "private" && <Badge>Private</Badge>}
                      </p>
                      {e.title && <h2 className="mt-1 font-display text-xl font-semibold">{e.title}</h2>}
                      <p className="mt-2 text-[15px] whitespace-pre-line">{e.body}</p>
                      {e.tags.length > 0 && <p className="mt-2 text-sm text-primary-700">{e.tags.map((t) => `#${t}`).join(" ")}</p>}
                    </div>
                    {mine && canEdit && (
                      <div className="flex items-center">
                        <ActionButton action={toggleGrimoireFavorite} fields={{ id: e.id }} label={e.isFavorite ? "Unfavorite" : "Favorite"} className="size-9 rounded-full hover:bg-sunken">
                          <Heart className={cn("size-4", e.isFavorite ? "fill-wine-500 text-wine-500" : "text-muted")} />
                        </ActionButton>
                        <EntryModal e={e} members={members} spells={spells} today={today} moon={moon} />
                        <DeleteButton action={deleteGrimoireEntry} fields={{ id: e.id }} what="this entry" />
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<BookOpen />} title={entries.length ? "No entries match" : "Your grimoire is empty"} description="Record moon reflections, dreams, tarot readings and how your spells turned out." />
        </Card>
      )}
    </>
  );
}
