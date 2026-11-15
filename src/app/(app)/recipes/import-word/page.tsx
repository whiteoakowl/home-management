import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecipeDocImporter } from "@/components/recipes/doc-importer";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { hasPrivateFood } from "@/lib/food-space";
import { categoryOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Import recipes from Word" };

export default async function ImportWordRecipesPage() {
  const viewer = await getViewer();
  const family = viewer.can("recipes", "add");
  const mine = hasPrivateFood(viewer);
  if (!family && !mine) notFound();
  const cats = await categoryOptions(viewer, "recipe");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Recipes
      </Link>
      <PageHeader title="Import recipes from a Word document" description="One recipe per page. Works with .docx files from Word, Google Docs (Download → .docx) and Pages (Export → Word)." />
      <RecipeDocImporter family={family} mine={mine} categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
