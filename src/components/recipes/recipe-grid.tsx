"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, Trash2, X } from "lucide-react";
import { deleteRecipes } from "@/app/actions/recipes";
import { Button } from "@/components/ui/button";
import { RecipeCard, type RecipeCardData } from "@/components/recipes/recipe-card";
import { cn } from "@/lib/utils";

/**
 * Recipe cards with an optional selection mode: "Select" → tick recipes (or
 * "Select all") → "Delete selected". Only recipes the viewer may delete can be ticked.
 */
export function RecipeGrid({ items, deletable }: { items: RecipeCardData[]; deletable: string[] }) {
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

  return (
    <div className="flex flex-col gap-4">
      {choosable.length > 0 && (
        <div className={cn("flex flex-wrap items-center gap-2", selecting && "sticky top-2 z-10 rounded-2xl border border-line bg-surface/95 p-2 shadow-[var(--shadow-pop)] backdrop-blur")}>
          {selecting ? (
            <>
              <Button variant="secondary" size="sm" icon={allPicked ? <Square className="size-4" /> : <CheckSquare className="size-4" />} onClick={() => setPicked(allPicked ? new Set() : new Set(choosable.map((r) => r.id)))}>
                {allPicked ? "Clear all" : `Select all (${choosable.length})`}
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
              {selecting && !can.has(r.id) && <span className="absolute inset-0 rounded-[var(--radius-card)] bg-surface/60" title="You can't delete this recipe" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
