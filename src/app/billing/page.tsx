import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { startCheckout } from "@/app/actions/billing";
import { Brand } from "@/components/brand";
import { getBrand } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { familyAccess, formatPrice, syncFromStripe } from "@/lib/billing";
import { getMembership } from "@/lib/dal";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Choose your plan" };

const PERKS = ["Shared calendar, chores, lists and meal planning", "Every family member gets their own login", "Private spaces for each person", "Works on phones, tablets and computers"];

/**
 * Where a family lands until it has a subscription: pick monthly or yearly,
 * then pay on Stripe Checkout (free trial first). Also handles the return
 * from Checkout.
 */
export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { member, family } = await getMembership();
  if (!member || !family) redirect("/onboarding");
  if (!family.onboardingCompletedAt) redirect("/onboarding");
  const sp = await searchParams;

  // Back from Stripe: confirm the checkout belongs to this family, then sync.
  if (typeof sp.session_id === "string") {
    try {
      const s = await stripe<{ client_reference_id: string | null; subscription: string | null }>("GET", `/checkout/sessions/${encodeURIComponent(sp.session_id)}`);
      if (s.client_reference_id === family.id && s.subscription) await syncFromStripe(family.id, s.subscription);
    } catch {
      // The webhook will catch up.
    }
    redirect("/?welcome=1");
  }

  const access = await familyAccess(family.id);
  if (access.hasAccess) redirect("/");
  const { settings, trialUsed } = access;
  const trial = !trialUsed && settings.trialDays > 0;
  const isParent = member.role === "parent";
  const yearlySaves = settings.monthlyPriceCents * 12 - settings.yearlyPriceCents;

  return (
    <main className="bg-hearth flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Brand title={await getBrand()} />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-center text-[28px] font-semibold">{trial ? `Start your ${settings.trialDays}-day free trial` : access.status === "canceled" ? "Welcome back" : "Choose your plan"}</h1>
          <p className="mx-auto mt-2 max-w-md text-center text-muted">
            {trial
              ? `Everything is included. Your card is only charged after ${settings.trialDays} days, and you can cancel anytime before then.`
              : access.status === "canceled"
                ? `The ${family.name} family's subscription has ended. Pick a plan to pick up right where you left off; everything is still here.`
                : "Pick a plan to keep using the app. Cancel anytime."}
          </p>
          {sp.canceled === "1" && <p className="mt-4 rounded-xl bg-olive-50 px-4 py-2 text-center text-sm text-olive-700">Checkout was cancelled. Nothing was charged.</p>}
          {typeof sp.error === "string" && (
            <p role="alert" className="mt-4 rounded-xl bg-wine-50 px-4 py-2 text-center text-sm text-wine-700">
              {sp.error.slice(0, 200)}
            </p>
          )}

          {isParent ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {(["monthly", "yearly"] as const).map((plan) => (
                <form key={plan} action={startCheckout} className="flex flex-col gap-3 rounded-2xl border border-line p-5 has-[button:focus-visible]:border-primary-400">
                  <input type="hidden" name="plan" value={plan} />
                  <p className="text-sm font-semibold tracking-wide text-muted uppercase">{plan === "monthly" ? "Monthly" : "Yearly"}</p>
                  <p>
                    <span className="font-display text-4xl font-semibold">{formatPrice(plan === "monthly" ? settings.monthlyPriceCents : settings.yearlyPriceCents, settings.currency)}</span>
                    <span className="text-muted"> / {plan === "monthly" ? "month" : "year"}</span>
                  </p>
                  <p className="min-h-5 text-sm text-olive-700">{plan === "yearly" && yearlySaves > 0 ? `Save ${formatPrice(yearlySaves, settings.currency)} a year` : ""}</p>
                  <Button type="submit" className="mt-auto">{trial ? "Start free trial" : "Subscribe"}</Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-sunken px-4 py-3 text-center text-[15px]">The {family.name} family&apos;s subscription needs a parent. Ask a parent to sign in and choose a plan.</p>
          )}

          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-[15px]">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-600" /> {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
            <ShieldCheck className="size-4" /> Payments are handled securely by Stripe. We never see your card number.
          </p>
        </div>
        <form action={logout} className="mt-4 text-center">
          <button type="submit" className="text-sm text-muted underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
