import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { CreditCard, MessageSquareHeart, Users } from "lucide-react";
import { requirePlatformAdmin, savePlatformSettings, setComplimentary } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms/action-form";
import { CheckboxField, FormRow, NumberField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { families, familyBilling, familyMembers, feedback, users } from "@/db/schema";
import { formatPrice, getPlatformSettings } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Admin" };

const TONE: Record<string, "primary" | "olive" | "wine" | "neutral" | "mist"> = { active: "primary", trialing: "mist", complimentary: "olive", past_due: "wine", canceled: "wine", none: "neutral" };

export default async function AdminPage() {
  await requirePlatformAdmin();
  const settings = await getPlatformSettings();
  const owner = db.$with("owner").as(db.select({ familyId: familyMembers.familyId, email: users.email }).from(families).innerJoin(familyMembers, eq(familyMembers.id, families.ownerMemberId)).innerJoin(users, eq(users.id, familyMembers.userId)));
  const [rows, [newFeedback]] = await Promise.all([
    db
      .with(owner)
      .select({
        id: families.id,
        name: families.name,
        createdAt: families.createdAt,
        members: sql<number>`(select count(*)::int from family_members m where m.family_id = ${families.id} and m.is_active)`,
        ownerEmail: owner.email,
        status: familyBilling.status,
        plan: familyBilling.plan,
        trialEndsAt: familyBilling.trialEndsAt,
        compNote: familyBilling.compNote,
      })
      .from(families)
      .leftJoin(familyBilling, eq(familyBilling.familyId, families.id))
      .leftJoin(owner, eq(owner.familyId, families.id))
      .orderBy(desc(families.createdAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(feedback).where(eq(feedback.status, "new")),
  ]);
  const counts = rows.reduce<Record<string, number>>((m, r) => ((m[r.status ?? "none"] = (m[r.status ?? "none"] ?? 0) + 1), m), {});
  const mrr = rows.reduce((s, r) => s + (r.status === "active" ? (r.plan === "yearly" ? settings.yearlyPriceCents / 12 : settings.monthlyPriceCents) : 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Admin" title={`${settings.brandName} admin`} description="Prices, trial and families across the whole service. Only platform admins see this page." />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Families", rows.length],
          ["Paying", counts.active ?? 0],
          ["On trial", counts.trialing ?? 0],
          ["Monthly revenue (est.)", formatPrice(Math.round(mrr), settings.currency)],
        ].map(([k, v]) => (
          <Card key={k as string} className="!p-4">
            <p className="text-sm text-muted">{k}</p>
            <p className="font-display text-2xl font-semibold">{v}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Pricing & product" icon={<CreditCard className="size-4" />} />
        {!stripeConfigured() && (
          <p className="mb-4 rounded-xl bg-olive-50 px-4 py-2.5 text-sm text-olive-700">
            Stripe isn&apos;t connected yet, so everyone can use the app free. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Netlify to start charging (see README → Payments).
          </p>
        )}
        <ActionForm action={savePlatformSettings} submitLabel="Save" resetOnSuccess={false} showSuccess>
          <TextField name="brandName" label="Product name" defaultValue={settings.brandName} required maxLength={60} hint="Shown on the website, sign-in and receipts. Each family's own name is still their app title." />
          <FormRow cols={3}>
            <NumberField name="monthly" label="Monthly price ($)" min={0.5} step="0.01" defaultValue={(settings.monthlyPriceCents / 100).toFixed(2)} required />
            <NumberField name="yearly" label="Yearly price ($)" min={0.5} step="0.01" defaultValue={(settings.yearlyPriceCents / 100).toFixed(2)} required />
            <NumberField name="trialDays" label="Free trial (days)" min={0} max={90} defaultValue={settings.trialDays} required />
          </FormRow>
          <CheckboxField name="billingEnabled" label="Charge for the app" description="Off: every family uses it free (handy while testing)." defaultChecked={settings.billingEnabled} />
        </ActionForm>
        <p className="mt-3 text-xs text-muted">New prices apply to new subscriptions. Existing subscribers keep the price they signed up at.</p>
      </Card>

      <Card>
        <CardHeader
          title="Families"
          icon={<Users className="size-4" />}
          action={
            <Link href="/admin/feedback" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
              <MessageSquareHeart className="size-4" /> Feedback{newFeedback?.n ? ` (${newFeedback.n} new)` : ""}
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted uppercase">
              <tr>
                <th className="py-2 pr-3">Family</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">People</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const status = r.status ?? "none";
                return (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3 text-muted">{r.ownerEmail ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.members}</td>
                    <td className="py-2 pr-3 text-muted">{r.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={TONE[status] ?? "neutral"}>{status === "none" ? "No plan" : status.replace("_", " ")}</Badge>
                      {r.plan && status !== "complimentary" && <span className="ml-1 text-xs text-muted">{r.plan}</span>}
                      {status === "trialing" && r.trialEndsAt && <span className="ml-1 text-xs text-muted">until {r.trialEndsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    </td>
                    <td className="py-2 text-right">
                      <ActionButton
                        action={setComplimentary}
                        fields={{ familyId: r.id, on: status === "complimentary" ? "0" : "1" }}
                        confirm={status === "complimentary" ? `Stop giving ${r.name} free access? They'll be asked to choose a plan.` : `Give ${r.name} free access?`}
                        className="h-8 rounded-lg px-2.5 text-xs font-medium text-ink-soft ring-1 ring-line hover:bg-sunken"
                      >
                        {status === "complimentary" ? "Remove free access" : "Make free"}
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
