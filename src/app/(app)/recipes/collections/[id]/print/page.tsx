import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { recipeCollections } from "@/db/schema";
import { PrintButton } from "@/components/recipes/recipe-actions";
import { getViewer } from "@/lib/dal";
import { fileUrl } from "@/lib/files";
import { formatQty } from "@/lib/ingredients";
import { getRecipe, listRecipes } from "@/lib/recipes";

export const metadata: Metadata = { title: "Recipe book" };

/** Printable recipe book: cover page + one recipe per page. */
export default async function PrintBookPage({ params }: PageProps<"/recipes/collections/[id]/print">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("recipes")) notFound();
  const [c] = await db.select().from(recipeCollections).where(and(eq(recipeCollections.id, id), eq(recipeCollections.familyId, viewer.family.id)));
  if (!c) notFound();
  const list = await listRecipes(viewer, { collectionId: id });
  const full = (await Promise.all(list.map((r) => getRecipe(viewer, r.id)))).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/recipes/collections/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <PrintButton label="Print recipe book" />
      </div>
      <section className="print-page mb-10 flex min-h-[60vh] flex-col items-center justify-center rounded-[var(--radius-card)] border border-line bg-surface p-10 text-center print:min-h-[90vh] print:border-0">
        <p className="text-sm font-medium tracking-[0.2em] text-primary-600 uppercase">The {viewer.family.name} Family</p>
        <h1 className="mt-3 text-5xl font-semibold">{c.name}</h1>
        {c.description && <p className="mt-3 max-w-md text-lg text-ink-soft">{c.description}</p>}
        <ol className="mt-10 columns-2 text-left text-[15px]">
          {full.map(({ r }, i) => (
            <li key={r.id} className="mb-1">
              {i + 1}. {r.name}
            </li>
          ))}
        </ol>
      </section>
      {full.map(({ r, ingredients }) => (
        <section key={r.id} className="print-page mb-10 rounded-[var(--radius-card)] border border-line bg-surface p-8 print:border-0 print:p-0">
          <h2 className="text-3xl font-semibold">{r.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {[r.prepMinutes && `Prep ${r.prepMinutes} min`, r.cookMinutes && `Cook ${r.cookMinutes} min`, r.servings && `Serves ${r.servings}`].filter(Boolean).join(" · ")}
          </p>
          {r.imageFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(r.imageFileId)!} alt="" className="mt-4 max-h-64 w-full rounded-xl object-cover" />
          )}
          {r.description && <p className="mt-4 text-ink-soft">{r.description}</p>}
          <div className="mt-6 grid gap-8 sm:grid-cols-[1fr_1.6fr]">
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Ingredients</h3>
              <ul className="flex flex-col gap-1 text-[15px]">
                {ingredients.map((i) => (
                  <li key={i.id}>{i.original ?? `${formatQty(i.quantity !== null ? Number(i.quantity) : null)} ${i.unit ?? ""} ${i.name}`}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold tracking-wide text-muted uppercase">Instructions</h3>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
                {r.instructions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
          {r.notes && <p className="mt-6 text-sm text-ink-soft italic">{r.notes}</p>}
        </section>
      ))}
    </div>
  );
}
