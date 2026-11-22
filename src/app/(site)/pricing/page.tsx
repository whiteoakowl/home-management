import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Section, SectionTitle } from "@/components/site/parts";
import { readSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/billing";
import { FEATURE_CATALOG } from "@/lib/feature-catalog";
import { FREE_LIMITS, FREE_SECTION_NAMES, PREMIUM_TABS } from "@/lib/plan-tiers";
import { FAQ } from "@/lib/site-content";
import { PlanCards } from "@/components/site/plans";

export const metadata: Metadata = { title: "Pricing", description: "Free forever for the everyday family hub. Premium unlocks everything, monthly or yearly, with a free trial." };

/** Every section, Free vs Premium, for the comparison table. */
function compareRows() {
  const rows: { name: string; free: string | boolean; premium: string | boolean }[] = [
    { name: "Family members (each with their own login)", free: `Up to ${FREE_LIMITS.members}`, premium: "Unlimited" },
    { name: "Lists", free: `Up to ${FREE_LIMITS.lists}`, premium: "Unlimited" },
  ];
  for (const g of FEATURE_CATALOG)
    for (const sec of g.sections) {
      const free = FREE_SECTION_NAMES.includes(sec.name);
      const extras = PREMIUM_TABS[sec.name];
      rows.push({ name: sec.name, free: free ? (extras ? `Yes (not ${extras.join(", ").toLowerCase()})` : true) : false, premium: true });
    }
  return rows;
}

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto size-5 text-olive-600" aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto size-5 text-muted" aria-label="Not included" />;
  return <span className="text-sm">{v}</span>;
}

export default async function PricingPage() {
  const [s, user] = await Promise.all([getPlatformSettings(), readSessionUser()]);
  const trial = s.billingEnabled && s.trialDays > 0 ? s.trialDays : 0;
  return (
    <>
      <div className="bg-hearth">
        <Section className="pb-10">
          <SectionTitle
            as="h1"
            eyebrow="Pricing"
            title="Free for every family. Premium for everything."
            intro={
              trial
                ? `Every new family gets ${trial} days of Premium free, with no card needed. After that, keep the Free plan forever or choose Premium.`
                : "The everyday family hub is free forever. Premium unlocks every section, for the whole family."
            }
          />
          <PlanCards s={s} signedIn={!!user} />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
            One price covers your whole family. If you don&apos;t upgrade, nothing is deleted: Premium sections stay view-only on the Free plan and come back the moment you upgrade. Payments are handled securely by Stripe. Prices in {s.currency.toUpperCase()}; taxes may apply.
          </p>
        </Section>
      </div>
      <Section id="compare" className="scroll-mt-20">
        <SectionTitle eyebrow="Compare plans" title="Free vs Premium, section by section" intro={trial ? `Try everything in Premium free for ${trial} days. No card needed.` : undefined} />
        <div className="mx-auto max-w-4xl overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full text-left text-[15px]">
            <thead className="bg-sunken text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Section</th>
                <th scope="col" className="w-28 px-2 py-3 text-center font-semibold sm:w-40">Free</th>
                <th scope="col" className="w-28 px-2 py-3 text-center font-semibold text-primary-700 sm:w-40">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {compareRows().map((r) => (
                <tr key={r.name}>
                  <th scope="row" className="px-4 py-2.5 font-medium">{r.name}</th>
                  <td className="px-2 py-2.5 text-center"><Cell v={r.free} /></td>
                  <td className="px-2 py-2.5 text-center"><Cell v={r.premium} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section>
        <SectionTitle eyebrow="Questions" title="Frequently asked" />
        <div className="mx-auto flex max-w-3xl flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-[15px] text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
