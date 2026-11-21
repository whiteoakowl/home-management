import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, CreditCard, Receipt } from "lucide-react";
import { db } from "@/db";
import { billingInvoices, familyMembers } from "@/db/schema";
import { ManageSubscription } from "@/components/billing/panels";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { familyAccess, formatPrice } from "@/lib/billing";
import { longDate, planPrice } from "@/lib/billing-display";
import { requireParent } from "@/lib/dal";
import { billingCtx, stripeConfigured, stripePublishableKey } from "@/lib/stripe";
import { backfillInvoices } from "../../../../../supabase/functions/_shared/billing-core";

export const metadata: Metadata = { title: "Subscription & billing" };

const LABEL: Record<string, { text: string; tone: "primary" | "olive" | "wine" | "neutral" | "mist" }> = {
  none: { text: "No plan", tone: "neutral" },
  trialing: { text: "Free trial", tone: "primary" },
  active: { text: "Active", tone: "olive" },
  past_due: { text: "Payment failed: retrying", tone: "wine" },
  unpaid: { text: "Unpaid", tone: "wine" },
  incomplete: { text: "Payment needed", tone: "wine" },
  canceled: { text: "Cancelled", tone: "neutral" },
  expired: { text: "Expired", tone: "neutral" },
  paused: { text: "Paused", tone: "mist" },
  complimentary: { text: "Complimentary", tone: "olive" },
};
const INVOICE: Record<string, { text: string; tone: "olive" | "wine" | "neutral" }> = {
  paid: { text: "Paid", tone: "olive" },
  open: { text: "Due", tone: "wine" },
  uncollectible: { text: "Failed", tone: "wine" },
  void: { text: "Void", tone: "neutral" },
};
const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", discover: "Discover", diners: "Diners Club", jcb: "JCB", unionpay: "UnionPay", link: "Link" };

/**
 * Subscription & billing, all inside the app: plan, price, status, renewal
 * date, card on file, billing history; change plan, update card, pay a
 * failed renewal, cancel or resume (account holder only; other parents see
 * it read-only).
 */
export default async function SubscriptionPage() {
  const viewer = await requireParent().catch(() => notFound());
  const { status, row, settings, billingOn, tier, trialDaysLeft, trialEndsAt, paid } = await familyAccess(viewer.family.id);
  const canManage = viewer.isOwner;

  // Billing history: kept in sync by the webhook; filled from Stripe on first visit.
  let invoices = await db.select().from(billingInvoices).where(eq(billingInvoices.familyId, viewer.family.id)).orderBy(desc(billingInvoices.invoiceCreatedAt)).limit(36);
  if (!invoices.length && row?.stripeCustomerId && stripeConfigured()) {
    try {
      if (await backfillInvoices(billingCtx(), viewer.family.id, row.stripeCustomerId))
        invoices = await db.select().from(billingInvoices).where(eq(billingInvoices.familyId, viewer.family.id)).orderBy(desc(billingInvoices.invoiceCreatedAt)).limit(36);
    } catch (e) {
      console.error("Couldn't load billing history from Stripe:", e);
    }
  }
  const [holder] = viewer.family.ownerMemberId ? await db.select({ name: familyMembers.displayName }).from(familyMembers).where(eq(familyMembers.id, viewer.family.ownerMemberId)) : [];

  const plan = row?.plan === "yearly" ? "yearly" : row?.plan === "monthly" ? "monthly" : null;
  const priceText = row?.priceCents != null && plan ? `${formatPrice(row.priceCents, row.currency ?? settings.currency)}/${plan === "yearly" ? "year" : "month"}` : plan ? planPrice(settings, plan) : null;
  const other = plan === "yearly" ? "monthly" : "yearly";
  const saves = settings.monthlyPriceCents * 12 - settings.yearlyPriceCents;
  const renews = status === "trialing" ? row?.trialEndsAt : row?.currentPeriodEnd;
  // Without a paid plan the family is on its free trial, then the Free plan.
  const label = billingOn && !paid ? (tier === "trial" ? { text: `Premium free trial · ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left`, tone: "primary" as const } : { text: "Free plan", tone: "neutral" as const }) : (LABEL[status] ?? { text: status, tone: "neutral" as const });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Subscription & billing" description={`Your ${settings.brandName} plan for the ${viewer.family.name} family.`} />

      <Card>
        <CardHeader title="Your plan" icon={<CreditCard className="size-4" />} />
        <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Status</dt>
            <dd className="mt-0.5">
              <Badge tone={label.tone}>{label.text}</Badge>
              {row?.cancelAtPeriodEnd && <Badge tone="neutral" className="ml-1">Cancels {status === "trialing" ? "when the trial ends" : "at period end"}</Badge>}
            </dd>
          </div>
          {plan && (
            <div>
              <dt className="text-sm text-muted">Plan & price</dt>
              <dd className="mt-0.5 font-medium">
                {plan === "yearly" ? "Yearly" : "Monthly"} · {priceText}
              </dd>
            </div>
          )}
          {renews && status !== "complimentary" && ["trialing", "active", "past_due", "unpaid"].includes(status) && (
            <div>
              <dt className="text-sm text-muted">{status === "trialing" ? (row?.cancelAtPeriodEnd ? "Trial ends (no charge)" : "Trial ends · first charge") : row?.cancelAtPeriodEnd ? "Access until" : "Renews on"}</dt>
              <dd className="mt-0.5 font-medium">{longDate(renews)}</dd>
            </div>
          )}
          {row?.pmLast4 && (
            <div>
              <dt className="text-sm text-muted">Payment method</dt>
              <dd className="mt-0.5 font-medium">
                {BRAND[row.pmBrand ?? ""] ?? (row.pmBrand ? row.pmBrand[0]!.toUpperCase() + row.pmBrand.slice(1) : "Card")} ending in {row.pmLast4}
                {row.pmExpMonth && row.pmExpYear ? <span className="font-normal text-muted"> · expires {String(row.pmExpMonth).padStart(2, "0")}/{String(row.pmExpYear).slice(-2)}</span> : null}
              </dd>
            </div>
          )}
          {(status === "canceled" || status === "expired") && row?.endedAt && (
            <div>
              <dt className="text-sm text-muted">Ended</dt>
              <dd className="mt-0.5">{longDate(row.endedAt)}</dd>
            </div>
          )}
        </dl>
        {row?.lastPaymentError && (status === "past_due" || status === "unpaid" || status === "incomplete") && <p className="mt-4 rounded-xl bg-wine-50 px-4 py-2 text-sm text-wine-700">Last payment: {row.lastPaymentError}</p>}

        <div className="mt-5 border-t border-line pt-5">
          {status === "complimentary" ? (
            <p className="text-sm text-muted">Your family uses {settings.brandName} free of charge. There&apos;s nothing to pay.</p>
          ) : !billingOn ? (
            <p className="text-sm text-muted">Payments aren&apos;t switched on yet, so there&apos;s nothing to pay.</p>
          ) : ["trialing", "active", "past_due", "unpaid"].includes(status) ? (
            <ManageSubscription
              publishableKey={stripePublishableKey()}
              canManage={canManage}
              status={status}
              plan={plan}
              otherPlanPrice={planPrice(settings, other)}
              saving={saves > 0 ? `save ${formatPrice(saves, settings.currency)}/year` : null}
              pendingPlan={row?.pendingPlan === "monthly" || row?.pendingPlan === "yearly" ? row.pendingPlan : null}
              pendingAt={longDate(row?.pendingPlanAt)}
              cancelAtPeriodEnd={!!row?.cancelAtPeriodEnd}
              endsOn={longDate(renews)}
              hasCard={!!row?.pmLast4}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {tier === "trial"
                  ? `Your family has every Premium feature free until ${longDate(trialEndsAt)}. After that you keep the Free plan (calendar, shopping list, chores, lists, chat, Important Info and more), or choose Premium to keep everything. No card is needed for the trial.`
                  : "Your family is on the Free plan: calendar, shopping list, chores, lists, chat, contacts and Important Info. Premium sections are view-only, and everything you saved is kept."}
              </p>
              {canManage ? (
                <ButtonLink href="/billing" className="w-fit">
                  {tier === "trial" ? "Choose a Premium plan" : "Upgrade to Premium"}
                </ButtonLink>
              ) : (
                <p className="text-sm text-muted">{holder?.name ?? "The account holder"} manages the subscription.</p>
              )}
            </div>
          )}
          {!canManage && status !== "complimentary" && billingOn && <p className="mt-3 text-xs text-muted">{holder?.name ?? "The account holder"} is the family&apos;s account holder.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Billing history" icon={<Receipt className="size-4" />} />
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">{status === "trialing" ? "No charges yet. Your first payment is when the trial ends." : "No payments yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((i) => {
                  const st = INVOICE[i.status ?? ""] ?? { text: i.status ?? "—", tone: "neutral" as const };
                  return (
                    <tr key={i.id}>
                      <td className="py-2.5 whitespace-nowrap">{longDate(i.invoiceCreatedAt) ?? "—"}</td>
                      <td className="py-2.5">
                        {i.billingReason === "subscription_create" ? "First payment" : i.billingReason === "subscription_cycle" ? "Renewal" : i.billingReason === "subscription_update" ? "Plan change" : (i.description ?? "Payment")}
                        {i.periodStart && i.periodEnd && (
                          <span className="block text-xs text-muted">
                            {longDate(i.periodStart)} – {longDate(i.periodEnd)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{formatPrice(i.status === "paid" ? i.amountPaid : i.amountDue, i.currency)}</td>
                      <td className="py-2.5">
                        <Badge tone={st.tone}>{st.text}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        {i.invoicePdf ? (
                          <a href={i.invoicePdf} target="_blank" rel="noreferrer" className="font-medium text-primary-700 hover:underline">
                            PDF
                          </a>
                        ) : i.hostedInvoiceUrl ? (
                          <a href={i.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary-700 hover:underline">
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs leading-relaxed text-muted">
        Payments are processed securely by Stripe; card numbers never reach our servers. Subscriptions renew automatically until cancelled. See our{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy-policy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
