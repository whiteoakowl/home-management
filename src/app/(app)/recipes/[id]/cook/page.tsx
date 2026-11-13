import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CookMode } from "@/components/recipes/cook-mode";
import { getViewer } from "@/lib/dal";
import { formatQty } from "@/lib/ingredients";
import { getRecipe } from "@/lib/recipes";

export const metadata: Metadata = { title: "Cook mode" };

export default async function CookPage({ params, searchParams }: PageProps<"/recipes/[id]/cook">) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer.can("recipes")) notFound();
  const data = await getRecipe(viewer, id);
  if (!data) notFound();
  const { r, ingredients } = data;
  const base = r.servings ?? null;
  const servings = Math.max(1, Math.min(50, Number(sp.servings) || base || 1));
  const scale = base ? servings / base : 1;
  const lines = ingredients.map((i) =>
    scale === 1 || i.quantity === null ? (i.original ?? `${i.quantity ?? ""} ${i.unit ?? ""} ${i.name}`.trim()) : `${formatQty(Number(i.quantity) * scale)} ${i.unit ?? ""} ${i.name}`.replace(/\s+/g, " ").trim(),
  );
  return <CookMode id={r.id} name={r.name} ingredients={lines} steps={r.instructions} servingsLabel={base ? `Serves ${servings}${scale !== 1 ? ` (scaled ×${formatQty(scale)})` : ""}` : null} />;
}
