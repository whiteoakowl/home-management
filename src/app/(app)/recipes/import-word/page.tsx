import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecipeDocImporter } from "@/components/recipes/doc-importer";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { hasPrivateFood } from "@/lib/food-space";
import { collectionOptions } from "@/lib/recipes";

export const metadata: Metadata = { title: "Import recipes from Word" };

export default async function ImportWordRecipesPage() {
  const viewer = await getViewer();
  const family = viewer.can("recipes", "add");
  const mine = hasPrivateFood(viewer);
  if (!family && !mine) notFound();
  const [familyCols, myCols] = await Promise.all([family ? collectionOptions(viewer) : [], mine ? collectionOptions(viewer, viewer.member.id) : []]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Recipes
      </Link>
      <PageHeader title="Import recipes from a Word document" description="One recipe per page. Works with .docx files from Word, Google Docs (Download → .docx) and Pages (Export → Word)." />
      <RecipeDocImporter family={family} mine={mine} collections={{ family: familyCols.map((c) => ({ id: c.id, name: c.name })), mine: myCols.map((c) => ({ id: c.id, name: c.name })) }} />
    </div>
  );
}
