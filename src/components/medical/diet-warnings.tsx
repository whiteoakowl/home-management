import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { DietWarning } from "@/lib/medical";
import { SEVERITIES } from "@/lib/medical-config";

/**
 * Allergy / food-restriction conflicts for a recipe. Never claims a recipe is
 * safe: with no matches it only says nothing recorded was found.
 */
export function DietWarnings({ warnings, hasRules }: { warnings: DietWarning[]; hasRules: boolean }) {
  if (!warnings.length) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-sunken px-4 py-3 text-sm text-muted print:hidden">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {hasRules ? "No conflicts found with the allergies and food restrictions on file." : "No allergies or food restrictions are on file to check against."} Always read
          ingredient labels: products can contain allergens that aren&apos;t listed here.
        </span>
      </p>
    );
  }
  const byPerson = Map.groupBy(warnings, (w) => `${w.member}|${w.label}`);
  return (
    <section role="alert" className="rounded-2xl border border-wine-200 bg-wine-50 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-wine-700">
        <ShieldAlert className="size-5" aria-hidden /> Allergy &amp; diet warnings
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
        {[...byPerson.values()].map((ws) => {
          const w = ws[0]!;
          const sev = w.severity ? SEVERITIES.find((s) => s.value === w.severity)?.label : null;
          return (
            <li key={`${w.member}|${w.label}`}>
              <strong>{w.member}</strong>: {w.source === "allergy" ? "allergy" : "restriction"} <em>{w.label}</em>
              {sev && <span className="text-wine-700"> ({sev})</span>} — found in {[...new Set(ws.map((x) => x.ingredient))].join(", ")}
            </li>
          );
        })}
      </ul>
      <Link href="/medical/allergies" className="mt-2 inline-block text-sm font-medium text-wine-700 underline print:hidden">
        Review allergies
      </Link>
    </section>
  );
}
