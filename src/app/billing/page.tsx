import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { SubscribePanel } from "@/components/billing/panels";
import { familyAccess, getBrand } from "@/lib/billing";
import { planOptions, renewalDisclosure } from "@/lib/billing-display";
import { getMembership } from "@/lib/dal";
import { stripePublishableKey } from "@/lib/stripe";

export const metadata: Metadata = { title: "Choose your plan" };

const PERKS = ["Shared calendar, chores, lists and meal planning", "Every family member gets their own login", "Private spaces for each person", "Works on phones, tablets and computers"];

/**
 * Where a family lands until it has a subscription (or after it ended):
 * pick monthly or yearly and pay right here with the Payment Element.
 * New families get the free trial; the card is only charged when it ends.
 */
export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { member, family } = await getMembership();
  if (!member || !family) redirect("/onboarding");
  if (!family.onboardingCompletedAt) redirect("/onboarding");
  const sp = await searchParams;

  const access = await familyAccess(family.id);
  if (access.hasAccess) redirect("/");
  const { settings, trialUsed } = access;
  const trial = !trialUsed && settings.trialDays > 0;
  const isHolder = family.ownerMemberId === member.id;
  const trialDays = trial ? settings.trialDays : 0;

  return (
    <main className="bg-hearth flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Brand title={await getBrand()} />
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-center text-[28px] font-semibold">{trial ? `Start your ${settings.trialDays}-day free trial` : access.status === "canceled" || access.status === "expired" ? "Welcome back" : access.status === "unpaid" || access.status === "incomplete" ? "Let's get your plan going" : "Choose your plan"}</h1>
          <p className="mx-auto mt-2 max-w-md text-center text-muted">
            {trial
              ? `Everything is included. Your card is only charged after ${settings.trialDays} days, and you can cancel anytime before then.`
              : access.status === "canceled" || access.status === "expired"
                ? `The ${family.name} family's subscription has ended. Pick a plan to pick up right where you left off; everything is still here.`
                : "Pick a plan to keep using the app. Cancel anytime."}
          </p>
          {typeof sp.error === "string" && (
            <p role="alert" className="mt-4 rounded-xl bg-wine-50 px-4 py-2 text-center text-sm text-wine-700">
              {sp.error.slice(0, 200)}
            </p>
          )}

          {isHolder ? (
            <div className="mt-6">
              <SubscribePanel publishableKey={stripePublishableKey()} options={planOptions(settings)} trialDays={trialDays} disclosure={renewalDisclosure(settings, trialDays)} />
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-sunken px-4 py-3 text-center text-[15px]">The {family.name} family&apos;s subscription is managed by the person who created the account. Ask them to sign in and choose a plan.</p>
          )}

          <ul className="mx-auto mt-6 grid max-w-md gap-2 text-[15px]">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-600" /> {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
            <ShieldCheck className="size-4" /> Payments are processed securely by Stripe. We never see or store your card number.
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
