import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Section, SectionTitle } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth/session";
import { formatPrice, getPlatformSettings } from "@/lib/billing";
import { FAQ } from "@/lib/site-content";
import { FREE_FEATURES, PREMIUM_FEATURES } from "@/lib/plan-tiers";

export const metadata: Metadata = { title: "Pricing", description: "Free forever for the everyday family hub. Premium unlocks everything, monthly or yearly, with a free trial." };

export default async function PricingPage() {
  const [s, user] = await Promise.all([getPlatformSettings(), readSessionUser()]);
  const trial = s.billingEnabled && s.trialDays > 0 ? s.trialDays : 0;
  const saves = s.monthlyPriceCents * 12 - s.yearlyPriceCents;
  const cta = user ? { href: "/settings/billing", label: "Manage your plan" } : { href: "/signup", label: trial ? `Start free, with ${trial} days of Premium` : "Get started free" };
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
          <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-7 shadow-[var(--shadow-card)]">
              <h2 className="text-xl font-semibold">Free</h2>
              <p>
                <span className="font-display text-[44px] leading-none font-semibold">{formatPrice(0, s.currency)}</span> <span className="text-muted">forever</span>
              </p>
              <p className="text-sm text-muted">The everyday family hub. No card needed.</p>
              <ButtonLink href={cta.href} variant="secondary" size="lg" className="mt-2">
                {user ? cta.label : "Get started free"}
              </ButtonLink>
              <ul className="mt-2 flex flex-col gap-2 text-[15px]">
                {FREE_FEATURES.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-olive-600" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative flex flex-col gap-4 rounded-[var(--radius-card)] border border-primary-400 bg-surface p-7 shadow-[var(--shadow-card)] ring-2 ring-primary-200 lg:col-span-2">
              <span className="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">Premium</span>
              <h2 className="text-xl font-semibold">Premium: everything, for the whole family</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line p-4">
                  <p className="text-sm font-medium text-muted">Monthly</p>
                  <p>
                    <span className="font-display text-[40px] leading-none font-semibold">{formatPrice(s.monthlyPriceCents, s.currency)}</span> <span className="text-muted">/ month</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">Flexible. Cancel anytime.</p>
                </div>
                <div className="rounded-2xl border border-primary-300 bg-primary-50/40 p-4">
                  <p className="text-sm font-medium text-muted">Yearly {saves > 0 && <span className="ml-1 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">Best value</span>}</p>
                  <p>
                    <span className="font-display text-[40px] leading-none font-semibold">{formatPrice(s.yearlyPriceCents, s.currency)}</span> <span className="text-muted">/ year</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{saves > 0 ? `Save ${formatPrice(saves, s.currency)} a year (about ${formatPrice(Math.round(s.yearlyPriceCents / 12), s.currency)}/month)` : "Billed once a year."}</p>
                </div>
              </div>
              <ButtonLink href={cta.href} size="lg">
                {cta.label}
              </ButtonLink>
              <p className="text-sm font-medium">Everything in Free, plus:</p>
              <ul className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
                {PREMIUM_FEATURES.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-primary-600" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
            One price covers your whole family. If you don&apos;t upgrade, nothing is deleted: Premium sections stay view-only on the Free plan and come back the moment you upgrade. Payments are handled securely by Stripe. Prices in {s.currency.toUpperCase()}; taxes may apply.
          </p>
        </Section>
      </div>
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
