import "server-only";
import { formatPrice, type Plan } from "./billing";

type Settings = { monthlyPriceCents: number; yearlyPriceCents: number; currency: string; trialDays: number };
export type PlanOption = { plan: Plan; label: string; price: string; per: string; note?: string; best?: boolean };

export const longDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null);

export function planOptions(s: Settings): PlanOption[] {
  const saves = s.monthlyPriceCents * 12 - s.yearlyPriceCents;
  return [
    { plan: "monthly", label: "Monthly", price: formatPrice(s.monthlyPriceCents, s.currency), per: "/ month" },
    { plan: "yearly", label: "Yearly", price: formatPrice(s.yearlyPriceCents, s.currency), per: "/ year", note: saves > 0 ? `Save ${formatPrice(saves, s.currency)} a year` : undefined, best: saves > 0 },
  ];
}

export const planPrice = (s: Settings, plan: Plan) => `${formatPrice(plan === "yearly" ? s.yearlyPriceCents : s.monthlyPriceCents, s.currency)}/${plan === "yearly" ? "year" : "month"}`;

/** Plain-language auto-renewal terms shown next to the pay button (required by auto-renewal laws). */
export function renewalDisclosure(s: Settings, trialDays: number, now = new Date()): Record<Plan, string> {
  const first = new Date(now.getTime() + trialDays * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const one = (plan: Plan) =>
    trialDays > 0
      ? `Free for ${trialDays} days. Then ${planPrice(s, plan)} is charged automatically starting ${first}, and every ${plan === "yearly" ? "year" : "month"} after, until you cancel. Cancel anytime before ${first} and you won't be charged.`
      : `${planPrice(s, plan)} is charged today and then automatically every ${plan === "yearly" ? "year" : "month"} until you cancel. Cancel anytime in Account settings → Subscription; you keep access until the end of the period you've paid for.`;
  return { monthly: one("monthly"), yearly: one("yearly") };
}
