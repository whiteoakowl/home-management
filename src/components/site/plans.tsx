import Link from "next/link";
import { Check, Gift, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/billing";
import { FREE_FEATURES, PREMIUM_FEATURES } from "@/lib/plan-tiers";
import { cn } from "@/lib/utils";

type Prices = { monthlyPriceCents: number; yearlyPriceCents: number; currency: string; trialDays: number; billingEnabled: boolean };

/** Free-trial length to advertise (0 when there's no trial). */
export const trialOf = (s: Prices) => (s.billingEnabled && s.trialDays > 0 ? s.trialDays : 0);

/**
 * The two plans side by side, for the public website (home, pricing, features).
 * Free: the everyday family hub, forever. Premium: everything, monthly or yearly,
 * with the no-card free trial up front.
 */
export function PlanCards({ s, signedIn, className }: { s: Prices; signedIn: boolean; className?: string }) {
  const trial = trialOf(s);
  const saves = s.monthlyPriceCents * 12 - s.yearlyPriceCents;
  const start = signedIn ? "/settings/billing" : "/signup";
  return (
    <div className={cn("mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_1.6fr]", className)}>
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-7">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-olive-50 px-2.5 py-0.5 text-xs font-semibold text-olive-700">Free forever</span>
          <h3 className="mt-2 text-xl font-semibold">Free</h3>
        </div>
        <p>
          <span className="font-display text-[44px] leading-none font-semibold">{formatPrice(0, s.currency)}</span> <span className="text-muted">forever</span>
        </p>
        <p className="text-sm text-muted">The everyday family hub. No card, no time limit.</p>
        <ButtonLink href={signedIn ? "/" : "/signup"} variant="secondary" size="lg">
          {signedIn ? "Open the app" : "Get started free"}
        </ButtonLink>
        <ul className="flex flex-col gap-2 text-[15px]">
          {FREE_FEATURES.map((i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="mt-1 size-4 shrink-0 text-olive-600" aria-hidden /> {i}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex flex-col gap-4 rounded-[var(--radius-card)] border border-primary-400 bg-surface p-6 shadow-[var(--shadow-card)] ring-2 ring-primary-200 sm:p-7">
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-semibold text-white">
          <Sparkles className="size-3" aria-hidden /> Premium
        </span>
        <h3 className="text-xl font-semibold">Premium: everything, for the whole family</h3>
        {trial > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2.5 text-[15px] text-primary-800">
            <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">Try Premium free for {trial} days.</strong> Every new family starts with it. No card needed, and you keep the Free plan afterwards if you don&apos;t upgrade.
            </span>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm font-medium text-muted">Monthly</p>
            <p>
              <span className="font-display text-[36px] leading-none font-semibold">{formatPrice(s.monthlyPriceCents, s.currency)}</span> <span className="text-muted">/ month</span>
            </p>
            <p className="mt-1 text-sm text-muted">Flexible. Cancel anytime.</p>
          </div>
          <div className="rounded-2xl border border-primary-300 bg-primary-50/40 p-4">
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-muted">
              Yearly {saves > 0 && <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">Best value</span>}
            </p>
            <p>
              <span className="font-display text-[36px] leading-none font-semibold">{formatPrice(s.yearlyPriceCents, s.currency)}</span> <span className="text-muted">/ year</span>
            </p>
            <p className="mt-1 text-sm text-muted">{saves > 0 ? `Save ${formatPrice(saves, s.currency)} a year (about ${formatPrice(Math.round(s.yearlyPriceCents / 12), s.currency)}/month)` : "Billed once a year."}</p>
          </div>
        </div>
        <ButtonLink href={start} size="lg">
          {signedIn ? "Manage your plan" : trial ? `Start your ${trial}-day free trial` : "Get started"}
        </ButtonLink>
        <p className="text-sm font-medium">Everything in Free, plus:</p>
        <ul className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
          {PREMIUM_FEATURES.map((i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="mt-1 size-4 shrink-0 text-primary-600" aria-hidden /> {i}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          One price covers the whole family.{" "}
          <Link href="/features" className="font-medium text-primary-700 hover:underline">
            See what&apos;s in every section
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Thin bar across the top of every website page. */
export function OfferBar({ trial }: { trial: number }) {
  return (
    <Link href="/pricing" className="block bg-primary-700 px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-800">
      <Gift className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />
      Free forever for the everyday family hub{trial > 0 ? ` · Try every Premium feature free for ${trial} days, no card needed` : ""} <span className="underline underline-offset-2">See plans →</span>
    </Link>
  );
}
