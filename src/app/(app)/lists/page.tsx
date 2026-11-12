import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckSquare, ClipboardList, List, ListOrdered, ListTodo, Lock, Users } from "lucide-react";
import { ListFormModal } from "@/components/lists/list-form";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { listIndex } from "@/lib/lists";
import { categoryOptions, memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Lists" };

const ICON = { checklist: CheckSquare, todo: ListTodo, bullet: List, numbered: ListOrdered, shopping: ClipboardList };

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const viewer = await getViewer();
  if (!viewer.can("lists")) notFound();
  const sp = await searchParams;
  const archived = sp.show === "archived";
  const category = typeof sp.category === "string" ? sp.category : "all";
  const [members, cats, rows] = await Promise.all([
    memberOptions(viewer),
    categoryOptions(viewer, "list"),
    listIndex(viewer, ["checklist", "bullet", "numbered", "todo"], { archived }),
  ]);
  const shown = category === "all" ? rows : rows.filter((r) => (r.categoryId ?? "none") === category);
  const canEdit = viewer.can("lists", "edit");
  const add = <ListFormModal members={members} categories={cats} defaultOpen={sp.new === "1"} />;

  return (
    <>
      <PageHeader title="Lists" description="Checklists, to-dos, packing lists, ideas: anything worth writing down." actions={canEdit ? add : undefined} />
      <div className="mb-5 flex flex-wrap gap-2">
        <SegmentLinks active={archived ? "archived" : "active"} items={[{ key: "active", href: "/lists", label: "Active" }, { key: "archived", href: "/lists?show=archived", label: "Archived" }]} />
        {cats.length > 0 && (
          <SegmentLinks
            active={category}
            items={[{ key: "all", href: `/lists?${archived ? "show=archived&" : ""}category=all`, label: "All" }, ...cats.map((c) => ({ key: c.id, href: `/lists?${archived ? "show=archived&" : ""}category=${c.id}`, label: c.name }))]}
          />
        )}
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title={archived ? "No archived lists" : "No lists yet"}
            description="Create a checklist, to-do list, bullet or numbered list. Keep it private or share it."
            example="“Camping packing list” · “Summer bucket list” · “Weekend to-dos”"
            action={canEdit && !archived ? add : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => {
            const Icon = ICON[l.kind];
            return (
              <li key={l.id}>
                <Link href={`/lists/${l.id}`} className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary-300">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{l.title}</p>
                      <p className="text-sm text-muted">
                        {l.open} open{l.total - l.open > 0 && ` · ${l.total - l.open} done`}
                      </p>
                    </div>
                    {l.visibility === "private" && <Lock className="size-4 text-muted" aria-label="Private" />}
                    {l.visibility === "selected" && <Users className="size-4 text-muted" aria-label="Shared with selected people" />}
                  </div>
                  {l.preview.length > 0 && (
                    <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                      {l.preview.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 truncate">
                          <span className="size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto flex items-center gap-3">
                    {l.kind !== "bullet" && l.kind !== "numbered" && l.total > 0 && <ProgressBar value={l.total - l.open} max={l.total} label={`${l.title} progress`} />}
                    {l.categoryName && <Badge>{l.categoryName}</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
