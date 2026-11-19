import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { openBillingPortal } from "@/app/actions/billing";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Button, ButtonLink } from "@/components/ui/button";
import { familyAccess, formatPrice } from "@/lib/billing";
import { requireParent } from "@/lib/dal";

export const metadata: Metadata = { title: "Subscription" };

const LABEL: Record<string, string> = { none: "No plan", trialing: "Free trial", active: "Active", past_due: "Payment problem", canceled: "Cancelled", complimentary: "Complimentary" };
const fmt = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—");

export default async function SubscriptionPage({ searchParams }: PageProps<"/settings/billing">) {
  const viewer = await requireParent().catch(() => notFound());
  const sp = await searchParams;
  const { status, row, settings, billingOn } = await familyAccess(viewer.family.id);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Subscription" description={`Your ${settings.brandName} plan for the ${viewer.family.name} family.`} />
      {typeof sp.error === "string" && <p className="rounded-xl bg-wine-50 px-4 py-2 text-sm text-wine-700">{sp.error}</p>}
      <Card>
        <CardHeader title="Plan" icon={<CreditCard className="size-4" />} />
        <dl className="grid gap-3 text-[15px] sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Status</dt>
            <dd>
              <Badge tone={status === "past_due" || status === "canceled" ? "wine" : status === "none" ? "neutral" : "primary"}>{LABEL[status] ?? status}</Badge>
            </dd>
          </div>
          {row?.plan && (
            <div>
              <dt className="text-sm text-muted">Plan</dt>
              <dd>
                {row.plan === "yearly" ? "Yearly" : "Monthly"} · {formatPrice(row.plan === "yearly" ? settings.yearlyPriceCents : settings.monthlyPriceCents, settings.currency)}
              </dd>
            </div>
          )}
          {status === "trialing" && (
            <div>
              <dt className="text-sm text-muted">Trial ends</dt>
              <dd>{fmt(row?.trialEndsAt)} (first charge then)</dd>
            </div>
          )}
          {(status === "active" || status === "past_due") && (
            <div>
              <dt className="text-sm text-muted">{row?.cancelAtPeriodEnd ? "Ends on" : "Renews on"}</dt>
              <dd>{fmt(row?.currentPeriodEnd)}</dd>
            </div>
          )}
        </dl>
        {status === "complimentary" ? (
          <p className="mt-4 text-sm text-muted">Your family uses {settings.brandName} free of charge.</p>
        ) : !billingOn ? (
          <p className="mt-4 text-sm text-muted">Payments aren&apos;t switched on yet, so there&apos;s nothing to pay.</p>
        ) : row?.stripeCustomerId && status !== "none" ? (
          <form action={openBillingPortal} className="mt-5">
            <Button type="submit">Manage payment, plan or cancel</Button>
            <p className="mt-2 text-xs text-muted">Opens Stripe&apos;s secure billing page: update your card, switch monthly/yearly, see receipts, or cancel.</p>
          </form>
        ) : (
          <ButtonLink href="/billing" className="mt-5">
            Choose a plan
          </ButtonLink>
        )}
      </Card>
    </div>
  );
}
