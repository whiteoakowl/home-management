"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Upload } from "lucide-react";
import {
  importDocumentRecipes,
  readRecipeDocument,
} from "@/app/actions/recipe-docs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import type { DocRecipe } from "@/lib/recipe-doc";
import {
  MAX_REQUEST_BYTES,
  networkFailureMessage,
  shrinkImage,
} from "@/lib/shrink-image";
import { cn } from "@/lib/utils";

type Row = DocRecipe & {
  key: number;
  include: boolean;
  tags: string;
  image: File | null;
  open: boolean;
};
const input =
  "h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] focus:border-primary-500 focus:outline-none";
const area =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px] focus:border-primary-500 focus:outline-none";
const num = (v: string) =>
  v.trim() === "" ? null : Math.max(0, Math.round(Number(v))) || null;

/** Upload a Word document → one recipe per page → review, edit → import into Family or My Private Recipes. */
type Opt = { id: string; name: string };
const NEW = "__new__";
/** Recipes per request: keeps each request short and small on the host. */
const BATCH = 5;

export function RecipeDocImporter({
  family,
  mine,
  collections,
}: {
  family: boolean;
  mine: boolean;
  collections: { family: Opt[]; mine: Opt[] };
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [space, setSpace] = useState<"family" | "mine">(
    family ? "family" : "mine",
  );
  const [reading, startReading] = useTransition();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const router = useRouter();
  const cols = space === "mine" ? collections.mine : collections.family;
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function read(file: File) {
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startReading(async () => {
      const res = await readRecipeDocument(fd);
      if (!res.ok) return setError(res.message);
      setPages(res.pages);
      setRows(
        res.recipes.map((r, key) => ({
          ...r,
          key,
          include: true,
          open: false,
          image: null,
          tags: "",
        })),
      );
    });
  }

  async function submit() {
    const chosen = rows!.filter((r) => r.include);
    if (!chosen.length) return;
    if (collection === NEW && !newCollection.trim())
      return setSaveError(
        "Name the new collection, or choose “No collection”.",
      );
    setSaving(true);
    setSaveError(null);
    let collectionId = collection && collection !== NEW ? collection : "";
    let done = 0;
    try {
      for (let start = 0; start < chosen.length; start += BATCH) {
        const batch = chosen.slice(start, start + BATCH);
        setProgress(
          `Saving ${Math.min(start + batch.length, chosen.length)} of ${chosen.length}…`,
        );
        const fd = new FormData();
        fd.set(
          "recipes",
          JSON.stringify(
            batch.map((r, i) => ({
              name: r.name.trim() || "Untitled recipe",
              description: r.description?.slice(0, 2000) ?? null,
              ingredients: r.ingredients
                .map((x) => x.trim().slice(0, 300))
                .filter(Boolean),
              instructions: r.instructions
                .map((x) => x.trim().slice(0, 4000))
                .filter(Boolean),
              prepMinutes: r.prepMinutes,
              cookMinutes: r.cookMinutes,
              totalMinutes: r.totalMinutes,
              servings: r.servings,
              notes: r.notes?.slice(0, 4000) ?? null,
              source: r.source?.slice(0, 200) ?? null,
              categoryId: null,
              prepTime: r.prepTime?.slice(0, 60) ?? null,
              cookTime: r.cookTime?.slice(0, 60) ?? null,
              temperature: r.temperature?.slice(0, 80) ?? null,
              recipeBy: r.recipeBy?.slice(0, 120) ?? null,
              tags: r.tags
                .split(",")
                .map((t) => t.trim().slice(0, 40))
                .filter(Boolean)
                .slice(0, 20),
              imageIndex: r.image ? i : null,
            })),
          ),
        );
        let bytes = 0;
        for (let i = 0; i < batch.length; i++) {
          const img = batch[i]!.image;
          if (img) {
            const small = await shrinkImage(img);
            bytes += small.size;
            fd.set(`image-${i}`, small, small.name);
          }
        }
        if (bytes > MAX_REQUEST_BYTES)
          throw new Error(
            "Some recipe photos are too large. Remove a few photos (you can add them to each recipe later).",
          );
        if (space === "mine") fd.set("space", "mine");
        if (collectionId) fd.set("collectionId", collectionId);
        else if (collection === NEW)
          fd.set("newCollection", newCollection.trim());
        if (start + BATCH >= chosen.length) fd.set("last", "1");
        fd.set("total", String(chosen.length));
        let res;
        try {
          res = await importDocumentRecipes(fd);
        } catch {
          throw new Error(networkFailureMessage());
        }
        if (!res.ok) throw new Error(res.message);
        done += res.created;
        if (res.collectionId) collectionId = res.collectionId;
        // Saved ones leave the list, so trying again never makes duplicates.
        const savedKeys = new Set(batch.map((r) => r.key));
        setRows((rs) => rs!.filter((r) => !savedKeys.has(r.key)));
      }
      const q = new URLSearchParams({ imported: String(done) });
      if (space === "mine") q.set("space", "mine");
      router.push(
        collectionId
          ? `/recipes/collections/${collectionId}${space === "mine" ? "?space=mine" : ""}`
          : `/recipes?${q}`,
      );
      router.refresh();
    } catch (e) {
      setSaveError(
        `${done ? `${done} recipe${done === 1 ? " was" : "s were"} saved. ` : ""}${(e as Error).message} The rest are still here: press Import to try again.`,
      );
      setSaving(false);
      setProgress(null);
    }
  }

  if (!rows) {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <FileText className="size-7" aria-hidden />
        </span>
        <p className="max-w-md text-[15px] text-ink-soft">
          Upload a Word document (.docx). Each page is read as a separate
          recipe. You&apos;ll review everything before it&apos;s saved.
        </p>
        <label
          className={cn(
            "inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700",
            reading && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="size-4" aria-hidden />{" "}
          {reading ? "Reading…" : "Choose Word document"}
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
          />
        </label>
        {error && (
          <p role="alert" className="max-w-md text-sm text-wine-700">
            {error}
          </p>
        )}
      </Card>
    );
  }

  const chosen = rows.filter((r) => r.include).length;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recipes Found ({rows.length})</h2>
        <p className="-mt-2 text-sm text-muted">
          From {pages} page{pages === 1 ? "" : "s"}. Untick any you don&apos;t
          want. Open a recipe to preview or edit it. Anything the document
          didn&apos;t say is left blank.
        </p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">
            Where should these recipes be saved?
          </legend>
          {family && (
            <label
              className={cn(
                "relative flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 text-sm",
                space === "family"
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-line-strong",
              )}
            >
              <input
                type="radio"
                name="dest"
                checked={space === "family"}
                onChange={() => {
                  setSpace("family");
                  setCollection("");
                }}
                className="sr-only"
              />
              <span className="font-medium">Family Recipes</span>
              <span className="text-xs text-muted">
                Visible to family members with recipe access.
              </span>
            </label>
          )}
          {mine && (
            <label
              className={cn(
                "relative flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 text-sm",
                space === "mine"
                  ? "border-olive-400 bg-olive-50 text-olive-700"
                  : "border-line-strong",
              )}
            >
              <input
                type="radio"
                name="dest"
                checked={space === "mine"}
                onChange={() => {
                  setSpace("mine");
                  setCollection("");
                }}
                className="sr-only"
              />
              <span className="font-medium">My Private Recipes</span>
              <span className="text-xs text-muted">Visible only to you.</span>
            </label>
          )}
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            Add to a collection (optional)
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className={input}
            >
              <option value="">No collection</option>
              {cols.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW}>+ New collection…</option>
            </select>
          </label>
          {collection === NEW && (
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
              New collection name
              <input
                value={newCollection}
                onChange={(e) => setNewCollection(e.target.value)}
                placeholder="Grandma's recipes"
                className={input}
                autoFocus
              />
            </label>
          )}
        </div>
      </Card>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <Card
              className={cn(
                "flex flex-col gap-3 !p-4",
                !r.include && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => update(r.key, { include: e.target.checked })}
                  aria-label={`Import ${r.name}`}
                  className="size-5 accent-[var(--color-primary-600)]"
                />
                <input
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  aria-label="Recipe name"
                  className={cn(input, "flex-1 font-semibold")}
                />
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => rs!.filter((x) => x.key !== r.key))
                  }
                  aria-label={`Remove ${r.name} from import`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wine-50 hover:text-wine-500"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted">
                {r.ingredients.length} ingredient
                {r.ingredients.length === 1 ? "" : "s"} ·{" "}
                {r.instructions.length} step
                {r.instructions.length === 1 ? "" : "s"}
                {r.servings ? ` · serves ${r.servings}` : ""}
                {r.prepTime || r.prepMinutes
                  ? ` · prep ${r.prepTime ?? `${r.prepMinutes} min`}`
                  : ""}
                {r.cookTime || r.cookMinutes
                  ? ` · cook ${r.cookTime ?? `${r.cookMinutes} min`}`
                  : ""}
                {r.temperature ? ` · ${r.temperature}` : ""}
                {r.totalMinutes ? ` · total ${r.totalMinutes} min` : ""}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Recipe by
                  <input
                    value={r.recipeBy ?? ""}
                    onChange={(e) =>
                      update(r.key, { recipeBy: e.target.value || null })
                    }
                    placeholder="Grandma Rose"
                    className={input}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Tags (comma separated)
                  <input
                    value={r.tags}
                    onChange={(e) => update(r.key, { tags: e.target.value })}
                    placeholder="holiday, family favorite"
                    className={input}
                  />
                </label>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                Photo (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    update(r.key, { image: e.target.files?.[0] ?? null })
                  }
                  className="text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => update(r.key, { open: !r.open })}
                aria-expanded={r.open}
                className="self-start text-sm font-medium text-primary-700 underline"
              >
                {r.open ? "Hide preview" : "Preview & edit"}
              </button>
              {r.open && (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        "prepMinutes",
                        "cookMinutes",
                        "totalMinutes",
                        "servings",
                      ] as const
                    ).map((k) => (
                      <label
                        key={k}
                        className="flex flex-col gap-1 text-xs font-medium text-muted"
                      >
                        {
                          {
                            prepMinutes: "Prep (min)",
                            cookMinutes: "Cook (min)",
                            totalMinutes: "Total (min)",
                            servings: "Servings",
                          }[k]
                        }
                        <input
                          inputMode="numeric"
                          value={r[k] ?? ""}
                          onChange={(e) =>
                            update(r.key, { [k]: num(e.target.value) })
                          }
                          className={input}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Ingredients (one per line)
                    <textarea
                      rows={Math.min(12, r.ingredients.length + 2)}
                      value={r.ingredients.join("\n")}
                      onChange={(e) =>
                        update(r.key, {
                          ingredients: e.target.value.split("\n"),
                        })
                      }
                      className={area}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Instructions (one step per line)
                    <textarea
                      rows={Math.min(12, r.instructions.length + 2)}
                      value={r.instructions.join("\n")}
                      onChange={(e) =>
                        update(r.key, {
                          instructions: e.target.value.split("\n"),
                        })
                      }
                      className={area}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Notes
                    <textarea
                      rows={2}
                      value={r.notes ?? ""}
                      onChange={(e) =>
                        update(r.key, { notes: e.target.value || null })
                      }
                      className={area}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Source
                    <input
                      value={r.source ?? ""}
                      onChange={(e) =>
                        update(r.key, { source: e.target.value || null })
                      }
                      className={input}
                    />
                  </label>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-24 z-10 flex flex-col items-end gap-2 sm:bottom-4">
        {saveError && <FormMessage message={saveError} tone="error" />}
        {progress && (
          <p
            role="status"
            className="rounded-full bg-surface px-3 py-1 text-sm text-muted shadow-[var(--shadow-pop)]"
          >
            {progress}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setRows(null)}>
            Choose another document
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !chosen}
            className="shadow-[var(--shadow-pop)]"
          >
            {saving
              ? "Importing…"
              : `Import ${chosen} Selected Recipe${chosen === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
