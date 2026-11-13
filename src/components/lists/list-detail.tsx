import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { archiveList, clearChecked, deleteList, quickAddItem } from "@/app/actions/lists";
import { ActionButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { type Viewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { frequentItems, listModule, loadList, loadListItems } from "@/lib/lists";
import { categoryOptions, memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import type { ReactNode } from "react";
import { ListFormModal } from "./list-form";
import { ListView } from "./list-view";

const KIND_LABEL = { checklist: "Checklist", bullet: "Bullet list", numbered: "Numbered list", todo: "To-do list", shopping: "Shopping list" };

/** Shared detail page for /lists/[id] and /shopping/[id]. */
export async function ListDetail({ viewer, id, backHref, extraActions }: { viewer: Viewer; id: string; backHref: string; extraActions?: ReactNode }) {
  const list = await loadList(viewer, id).catch(() => null);
  if (!list) notFound();
  const mod = listModule(list.kind);
  const canEdit = viewer.can(mod, "edit") || list.createdByMemberId === viewer.member.id;
  const [items, members, cats, access] = await Promise.all([
    loadListItems(list.id),
    memberOptions(viewer),
    categoryOptions(viewer, "list"),
    getRecordAccess("list", [list.id]),
  ]);
  const frequent = list.kind === "shopping" && canEdit ? await frequentItems(viewer.family.id, list.id) : [];
  const shared = access.get(list.id) ?? [];
  const checked = items.filter((i) => i.checked).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All lists
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            {KIND_LABEL[list.kind]}
            {list.store && <span className="text-muted">· {list.store}</span>}
            {list.visibility === "private" && (
              <Badge tone="mist">
                <Lock className="size-3" /> Private
              </Badge>
            )}
            {list.visibility === "selected" && (
              <Badge tone="mist">
                <Users className="size-3" /> {shared.length} people
              </Badge>
            )}
            {list.archivedAt && <Badge>Archived</Badge>}
          </span>
        }
        title={list.title}
        description={`${items.length - checked} open · ${checked} done`}
        actions={
          canEdit ? (
            <>
              {extraActions}
              <ListFormModal
                members={members}
                categories={cats}
                list={{ id: list.id, title: list.title, kind: list.kind, categoryId: list.categoryId, store: list.store, visibility: list.visibility, sharedWith: shared }}
                triggerContent={
                  <>
                    <Pencil className="size-4" /> Edit
                  </>
                }
              />
              {checked > 0 && (
                <ActionButton action={clearChecked} fields={{ id: list.id }} confirm="Remove all checked items?" className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                  Clear checked
                </ActionButton>
              )}
              <ActionButton action={archiveList} fields={{ id: list.id }} className="h-9 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken">
                {list.archivedAt ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                {list.archivedAt ? "Restore" : "Archive"}
              </ActionButton>
              <ActionButton action={deleteList} fields={{ id: list.id }} confirm="Delete this list and all its items?" label="Delete list" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          ) : undefined
        }
      />
      {frequent.length > 0 && (
        <section aria-label="Buy again" className="-mt-1">
          <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">Buy again</p>
          <div className="flex flex-wrap gap-2">
            {frequent.map((f) => (
              <ActionButton key={f.text} action={quickAddItem} fields={{ listId: list.id, text: f.text }} label={`Add ${f.text}`} className="h-9 rounded-full border border-line-strong bg-surface px-3 text-sm hover:border-primary-300 hover:bg-primary-50">
                <Plus className="size-3.5" aria-hidden /> {f.text}
              </ActionButton>
            ))}
          </div>
        </section>
      )}
      <Card className="p-3 sm:p-4">
        <ListView
          listId={list.id}
          kind={list.kind}
          items={items}
          members={members}
          canEdit={canEdit}
          canAdd={canEdit}
          today={todayIn(viewer.family.timezone)}
        />
        {items.length === 0 && <p className="px-2 pt-3 text-[15px] text-muted">This list is empty. Add your first item above.</p>}
      </Card>
    </div>
  );
}
