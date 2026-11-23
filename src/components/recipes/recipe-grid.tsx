"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, FolderPlus, Square, Trash2, X } from "lucide-react";
import { collectRecipes, deleteRecipes } from "@/app/actions/recipes";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { RecipeCard, type RecipeCardData } from "@/components/recipes/recipe-card";
import { cn } from "@/lib/utils";

/**
 * Recipe cards with an optional selection mode: "Select" → tick recipes (or
 * "Select all") → "Add to collection" or "Delete selected". Only recipes the
 * viewer may change can be ticked.
 */
export function RecipeGrid({ items, deletable, collections = [] }: { items: RecipeCardData[]; deletable: string[]; collections?: { id: string; name: string }[] }) {
  const [collecting, setCollecting] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [modalMsg, setModalMsg] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const can = new Set(deletable);
  const choosable = items.filter((r) => can.has(r.id));
  const allPicked = choosable.length > 0 && choosable.every((r) => picked.has(r.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const stop = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const remove = () => {
    const ids = [...picked];
    if (!ids.length || !window.confirm(`Delete ${ids.length} recipe${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    start(async () => {
      try {
        const res = await deleteRecipes(ids);
        setMessage(`Deleted ${res.deleted} recipe${res.deleted === 1 ? "" : "s"}.${res.skipped ? ` ${res.skipped} couldn't be deleted.` : ""}`);
        stop();
        router.refresh();
      } catch {
        setMessage("That didn't work. Check your connection and try again.");
      }
    });
  };

  const collect = (remove: boolean) => {
    const ids = [...picked];
    if (!ids.length) return;
    setModalMsg(null);
    start(async () => {
      const res = await collectRecipes({ ids, collectionIds: [...chosen], newName: remove ? "" : newName, remove });
      if (!res.ok) {
        setModalMsg(res.message);
        return;
      }
      setMessage(res.message);
      setCollecting(false);
      setChosen(new Set());
      setNewName("");
      stop();
      router.refresh();
    });
  };
  const toggleCol = (id: string) =>
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-4">
      <Modal
        open={collecting}
        onClose={() => setCollecting(false)}
        title={`Add ${picked.size} recipe${picked.size === 1 ? "" : "s"} to collections`}
        description="Tick one or more collections, or start a new one."
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {chosen.size > 0 && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => collect(true)}>
                Remove from these
              </Button>
            )}
            <Button size="sm" disabled={pending || (!chosen.size && !newName.trim())} onClick={() => collect(false)}>
              {pending ? "Saving…" : "Add to collection"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {modalMsg && (
            <p role="alert" className="rounded-xl bg-wine-50 px-3 py-2 text-sm text-wine-700">
              {modalMsg}
            </p>
          )}
          {collections.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {collections.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken">
                    <input type="checkbox" className="size-5 accent-primary-600" checked={chosen.has(c.id)} onChange={() => toggleCol(c.id)} />
                    <span className="text-[15px]">{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
            New collection
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder="Weeknight dinners, Holiday baking…" className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] font-normal text-ink" />
          </label>
        </div>
      </Modal>
      {choosable.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-2", selecting && "sticky top-2 z-10 rounded-2xl border border-line bg-surface/95 p-2 shadow-[var(--shadow-pop)] backdrop-blur")}>
          {selecting ? (
            <>
              <Button variant="secondary" size="sm" icon={allPicked ? <Square className="size-4" /> : <CheckSquare className="size-4" />} onClick={() => setPicked(allPicked ? new Set() : new Set(choosable.map((r) => r.id)))}>
                {allPicked ? "Clear all" : `Select all (${choosable.length})`}
              </Button>
              <Button variant="secondary" size="sm" icon={<FolderPlus className="size-4" />} disabled={!picked.size || pending} onClick={() => { setModalMsg(null); setCollecting(true); }}>
                Add to collection ({picked.size})
              </Button>
              <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} disabled={!picked.size || pending} onClick={remove}>
                {pending ? "Deleting…" : `Delete selected (${picked.size})`}
              </Button>
              <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={stop}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" icon={<CheckSquare className="size-4" />} onClick={() => { setSelecting(true); setMessage(null); }}>
              Select
            </Button>
          )}
          {message && !selecting && <p role="status" className="text-sm text-muted">{message}</p>}
        </div>
      )}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((r) => {
          const on = picked.has(r.id);
          const pickable = selecting && can.has(r.id);
          return (
            <li key={r.id} className="relative">
              <RecipeCard r={r} />
              {pickable && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Select ${r.name}`}
                  onClick={() => toggle(r.id)}
                  className={cn("absolute inset-0 rounded-[var(--radius-card)] transition-colors", on ? "bg-primary-600/15 ring-4 ring-primary-500" : "bg-transparent hover:bg-black/5")}
                >
                  <span className={cn("absolute top-3 left-3 flex size-8 items-center justify-center rounded-full border-2 bg-surface shadow", on ? "border-primary-600 bg-primary-600 text-white" : "border-line-strong")}>
                    {on && "✓"}
                  </span>
                </button>
              )}
              {selecting && !can.has(r.id) && <span className="absolute inset-0 rounded-[var(--radius-card)] bg-surface/60" title="You can't change this recipe" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
