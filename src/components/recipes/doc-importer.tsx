"use client";

import { useActionState, useState, useTransition } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { importDocumentRecipes, readRecipeDocument } from "@/app/actions/recipe-docs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import type { DocRecipe } from "@/lib/recipe-doc";
import { cn } from "@/lib/utils";

type Row = DocRecipe & { key: number; include: boolean; categoryId: string; tags: string; image: File | null; open: boolean };
const input = "h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] focus:border-primary-500 focus:outline-none";
const area = "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px] focus:border-primary-500 focus:outline-none";
const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))) || null);

/** Upload a Word document → one recipe per page → review, edit → import into Family or My Private Recipes. */
export function RecipeDocImporter({ family, mine, categories }: { family: boolean; mine: boolean; categories: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const [space, setSpace] = useState<"family" | "mine">(family ? "family" : "mine");
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [state, action] = useActionState(importDocumentRecipes, undefined);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));

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
          categoryId: categories.find((c) => r.category && c.name.toLowerCase() === r.category.toLowerCase())?.id ?? "",
        })),
      );
    });
  }

  function submit() {
    const chosen = rows!.filter((r) => r.include);
    const fd = new FormData();
    fd.set(
      "recipes",
      JSON.stringify(
        chosen.map((r, i) => ({
          name: r.name,
          description: r.description,
          ingredients: r.ingredients.map((x) => x.trim()).filter(Boolean),
          instructions: r.instructions.map((x) => x.trim()).filter(Boolean),
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          totalMinutes: r.totalMinutes,
          servings: r.servings,
          notes: r.notes,
          source: r.source,
          categoryId: r.categoryId || null,
          tags: r.tags.split(",").map((t) => t.trim()).filter(Boolean),
          imageIndex: r.image ? i : null,
        })),
      ),
    );
    chosen.forEach((r, i) => r.image && fd.set(`image-${i}`, r.image));
    if (space === "mine") fd.set("space", "mine");
    startSaving(() => action(fd));
  }

  if (!rows) {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <FileText className="size-7" aria-hidden />
        </span>
        <p className="max-w-md text-[15px] text-ink-soft">Upload a Word document (.docx). Each page is read as a separate recipe. You&apos;ll review everything before it&apos;s saved.</p>
        <label className={cn("inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700", reading && "pointer-events-none opacity-60")}>
          <Upload className="size-4" aria-hidden /> {reading ? "Reading…" : "Choose Word document"}
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </label>
        {error && <p role="alert" className="max-w-md text-sm text-wine-700">{error}</p>}
      </Card>
    );
  }

  const chosen = rows.filter((r) => r.include).length;
  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <Card className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recipes Found ({rows.length})</h2>
        <p className="-mt-2 text-sm text-muted">
          From {pages} page{pages === 1 ? "" : "s"}. Untick any you don&apos;t want. Open a recipe to preview or edit it. Anything the document didn&apos;t say is left blank.
        </p>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-soft">Where should these recipes be saved?</legend>
          {family && (
            <label className={cn("relative flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 text-sm", space === "family" ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong")}>
              <input type="radio" name="dest" checked={space === "family"} onChange={() => setSpace("family")} className="sr-only" />
              <span className="font-medium">Family Recipes</span>
              <span className="text-xs text-muted">Visible to family members with recipe access.</span>
            </label>
          )}
          {mine && (
            <label className={cn("relative flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-2 text-sm", space === "mine" ? "border-olive-400 bg-olive-50 text-olive-700" : "border-line-strong")}>
              <input type="radio" name="dest" checked={space === "mine"} onChange={() => setSpace("mine")} className="sr-only" />
              <span className="font-medium">My Private Recipes</span>
              <span className="text-xs text-muted">Visible only to you.</span>
            </label>
          )}
        </fieldset>
      </Card>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.key}>
            <Card className={cn("flex flex-col gap-3 !p-4", !r.include && "opacity-60")}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} aria-label={`Import ${r.name}`} className="size-5 accent-[var(--color-primary-600)]" />
                <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Recipe name" className={cn(input, "flex-1 font-semibold")} />
                <button type="button" onClick={() => setRows((rs) => rs!.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name} from import`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wine-50 hover:text-wine-500">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted">
                {r.ingredients.length} ingredient{r.ingredients.length === 1 ? "" : "s"} · {r.instructions.length} step{r.instructions.length === 1 ? "" : "s"}
                {r.servings ? ` · serves ${r.servings}` : ""}
                {r.prepMinutes ? ` · prep ${r.prepMinutes} min` : ""}
                {r.cookMinutes ? ` · cook ${r.cookMinutes} min` : ""}
                {r.totalMinutes ? ` · total ${r.totalMinutes} min` : ""}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Category
                  <select value={r.categoryId} onChange={(e) => update(r.key, { categoryId: e.target.value })} className={input}>
                    <option value="">{r.category ? `None (document says “${r.category}”)` : "None"}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  Tags (comma separated)
                  <input value={r.tags} onChange={(e) => update(r.key, { tags: e.target.value })} placeholder="holiday, family favorite" className={input} />
                </label>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                Photo (optional)
                <input type="file" accept="image/*" onChange={(e) => update(r.key, { image: e.target.files?.[0] ?? null })} className="text-sm" />
              </label>
              <button type="button" onClick={() => update(r.key, { open: !r.open })} aria-expanded={r.open} className="self-start text-sm font-medium text-primary-700 underline">
                {r.open ? "Hide preview" : "Preview & edit"}
              </button>
              {r.open && (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["prepMinutes", "cookMinutes", "totalMinutes", "servings"] as const).map((k) => (
                      <label key={k} className="flex flex-col gap-1 text-xs font-medium text-muted">
                        {{ prepMinutes: "Prep (min)", cookMinutes: "Cook (min)", totalMinutes: "Total (min)", servings: "Servings" }[k]}
                        <input inputMode="numeric" value={r[k] ?? ""} onChange={(e) => update(r.key, { [k]: num(e.target.value) })} className={input} />
                      </label>
                    ))}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Ingredients (one per line)
                    <textarea rows={Math.min(12, r.ingredients.length + 2)} value={r.ingredients.join("\n")} onChange={(e) => update(r.key, { ingredients: e.target.value.split("\n") })} className={area} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Instructions (one step per line)
                    <textarea rows={Math.min(12, r.instructions.length + 2)} value={r.instructions.join("\n")} onChange={(e) => update(r.key, { instructions: e.target.value.split("\n") })} className={area} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Notes
                    <textarea rows={2} value={r.notes ?? ""} onChange={(e) => update(r.key, { notes: e.target.value || null })} className={area} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Source
                    <input value={r.source ?? ""} onChange={(e) => update(r.key, { source: e.target.value || null })} className={input} />
                  </label>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-24 z-10 flex flex-wrap justify-end gap-2 sm:bottom-4">
        <Button variant="secondary" onClick={() => setRows(null)}>
          Choose another document
        </Button>
        <Button onClick={submit} disabled={saving || !chosen} className="shadow-[var(--shadow-pop)]">
          {saving ? "Importing…" : `Import ${chosen} Selected Recipe${chosen === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
