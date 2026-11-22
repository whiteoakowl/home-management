import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { SubscribePanel } from "@/components/billing/panels";
import { familyAccess, getBrand } from "@/lib/billing";
import { planOptions, renewalDisclosure } from "@/lib/billing-display";
import { getMembership } from "@/lib/dal";
import { FREE_FEATURES, PREMIUM_FEATURES } from "@/lib/plan-tiers";
import { stripePublishableKey } from "@/lib/stripe";

export const metadata: Metadata = { title: "Upgrade to Premium" };

/**
 * Upgrade to Premium: Free vs Premium, then pick monthly or yearly and pay
 * right here with the Payment Element. Subscribing during the free trial
 * keeps the rest of the trial: the card is only charged when it ends.
 * Families without a paid plan keep using the app on Free.
 */
export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { member, family } = await getMembership();
  if (!member || !family) redirect("/onboarding");
  if (!family.onboardingCompletedAt) redirect("/onboarding");
  const sp = await searchParams;

  const access = await familyAccess(family.id);
  // Already paying (or nothing to pay): manage it in Account settings.
  if (access.paid) redirect(access.billingOn ? "/settings/billing" : "/");
  const { settings, tier, trialDaysLeft, stripeTrialDays, status } = access;
  const isHolder = family.ownerMemberId === member.id;

  const title = tier === "trial" ? "Keep Premium after your trial" : status === "canceled" || status === "expired" ? "Welcome back to Premium" : status === "unpaid" || status === "incomplete" ? "Let's get Premium going again" : "Upgrade to Premium";
  const lead =
    tier === "trial"
      ? `You have ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} of Premium left. Choose a plan now and your card is only charged when the trial ends. Or do nothing and move to the Free plan.`
      : `The ${family.name} family is on the Free plan. Everything you've saved is still here; Premium sections are view-only until you upgrade.`;

  return (
    <main className="bg-hearth flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex justify-center">
          <Brand title={await getBrand()} />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-center text-[28px] font-semibold">{title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted">{lead}</p>
          {typeof sp.error === "string" && (
            <p role="alert" className="mt-4 rounded-xl bg-wine-50 px-4 py-2 text-center text-sm text-wine-700">
              {sp.error.slice(0, 200)}
            </p>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-line p-4">
              <h2 className="font-semibold">Free, forever</h2>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border-2 border-primary-300 bg-primary-50/40 p-4">
              <h2 className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="size-4 text-primary-600" aria-hidden /> Premium: everything in Free, plus
              </h2>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {!access.billingOn ? null : isHolder ? (
            <div className="mt-6">
              <SubscribePanel publishableKey={stripePublishableKey()} options={planOptions(settings)} trialDays={stripeTrialDays} disclosure={renewalDisclosure(settings, stripeTrialDays)} />
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-sunken px-4 py-3 text-center text-[15px]">The {family.name} family&apos;s plan is managed by the person who created the account. Ask them to upgrade.</p>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
            <ShieldCheck className="size-4" /> Payments are processed securely by Stripe. We never see or store your card number.
          </p>
        </div>
        <p className="mt-4 text-center">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
            <ArrowLeft className="size-4" /> {tier === "trial" ? "Back to the app" : "Continue with Free"}
          </Link>
        </p>
      </div>
    </main>
  );
}
