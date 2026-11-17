import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tags, X } from "lucide-react";
import { addSynonymGroup, removeSynonymGroup } from "@/app/actions/kitchen";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { canOpenFood } from "@/lib/food-space";
import { BUILT_IN_SYNONYMS } from "@/lib/synonyms";

export const metadata: Metadata = { title: "Keyword bank" };

const Chips = ({ words }: { words: string[] }) => (
  <span className="flex flex-wrap gap-1.5">
    {words.map((w, i) => (
      <span key={i} className="rounded-full bg-sunken px-2.5 py-0.5 text-sm">
        {w}
      </span>
    ))}
  </span>
);

/** Words that mean the same grocery, so recipes find what's in the pantry under any name. */
export default async function KeywordBankPage() {
  const viewer = await getViewer();
  if (!canOpenFood(viewer, "kitchen")) notFound();
  const mine = viewer.family.settings?.ingredientSynonyms ?? [];
  const canAdd = viewer.can("kitchen", "use") || viewer.member.privateFood;
  const canRemove = viewer.isParent || viewer.can("kitchen", "edit");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/kitchen" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Pantry
      </Link>
      <PageHeader
        eyebrow="Family Pantry"
        title="Keyword bank"
        description="Groups of words that mean the same grocery. When a recipe says one, anything in the pantry called another counts as in stock. You can also give a single pantry item other names with “Also called”."
      />
      {canAdd && (
        <Card>
          <CardHeader title="Add words that go together" icon={<Tags className="size-4" />} />
          <ActionForm action={addSynonymGroup} submitLabel="Add group" resetOnSuccess>
            <TextField name="words" label="Words (comma separated)" required placeholder="pop, soda, soft drink" hint="At least two. Be specific: “black pepper”, not just “pepper”." />
          </ActionForm>
        </Card>
      )}
      <Card>
        <CardHeader title="Our family's words" />
        {mine.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {mine.map((g, i) => (
              <li key={i} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <Chips words={g} />
                </span>
                {canRemove && (
                  <ActionButton action={removeSynonymGroup} fields={{ index: i }} confirm={`Remove "${g.join(", ")}"?`} label="Remove" className="size-9 rounded-full text-muted hover:bg-wine-50 hover:text-wine-500">
                    <X className="size-4" />
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None yet. Add the names your family uses for things.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Built in" />
        <ul className="flex flex-col divide-y divide-line">
          {BUILT_IN_SYNONYMS.map((g, i) => (
            <li key={i} className="py-2.5">
              <Chips words={g} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
