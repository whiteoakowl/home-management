import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Section, SectionTitle } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth/session";
import { formatPrice, getPlatformSettings } from "@/lib/billing";
import { FAQ } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing", description: "One simple price for your whole family, monthly or yearly, with a free trial." };

const INCLUDED = ["Every feature and section", "Unlimited family members and logins",
  "Faith tabs: Christian, Catholic, Jewish, Hindu, Buddhist & spiritual",
  "Google, Outlook & Apple calendar sync",
  "Push notifications on phones and computers", "Your family's name and colors on the app", "Phones, tablets and computers", "Free updates and new features", "Cancel anytime"];

export default async function PricingPage() {
  const [s, user] = await Promise.all([getPlatformSettings(), readSessionUser()]);
  const trial = s.billingEnabled && s.trialDays > 0 ? s.trialDays : 0;
  const saves = s.monthlyPriceCents * 12 - s.yearlyPriceCents;
  const plans = [
    { key: "monthly", name: "Monthly", price: formatPrice(s.monthlyPriceCents, s.currency), per: "/ month", note: "Flexible. Cancel anytime.", best: false },
    { key: "yearly", name: "Yearly", price: formatPrice(s.yearlyPriceCents, s.currency), per: "/ year", note: saves > 0 ? `Save ${formatPrice(saves, s.currency)} a year (about ${formatPrice(Math.round(s.yearlyPriceCents / 12), s.currency)}/month)` : "Billed once a year.", best: saves > 0 },
  ];
  return (
    <>
      <div className="bg-hearth">
        <Section className="pb-10">
          <SectionTitle as="h1" eyebrow="Pricing" title="One price. The whole family." intro={trial ? `Every feature included. Try it free for ${trial} days; your card isn't charged until the trial ends.` : "Every feature included, for everyone in your family."} />
          <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
            {plans.map((p) => (
              <div key={p.key} className={cn("relative flex flex-col gap-4 rounded-[var(--radius-card)] border bg-surface p-7 shadow-[var(--shadow-card)]", p.best ? "border-primary-400 ring-2 ring-primary-200" : "border-line")}>
                {p.best && <span className="absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">Best value</span>}
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p>
                  <span className="font-display text-[44px] leading-none font-semibold">{p.price}</span> <span className="text-muted">{p.per}</span>
                </p>
                <p className="text-sm text-muted">{p.note}</p>
                <ButtonLink href={user ? "/settings/billing" : "/signup"} variant={p.best ? "primary" : "secondary"} size="lg" className="mt-2">
                  {user ? "Manage subscription" : trial ? "Start free trial" : "Get started"}
                </ButtonLink>
              </div>
            ))}
          </div>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-x-8 gap-y-2 sm:grid-cols-2">
            {INCLUDED.map((i) => (
              <li key={i} className="flex items-center gap-2 text-[15px]">
                <Check className="size-4 shrink-0 text-olive-600" aria-hidden /> {i}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-muted">Payments are handled securely by Stripe. Prices in {s.currency.toUpperCase()}; taxes may apply.</p>
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
