"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, CreditCard, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { cancelSubscription, changePlan, payNow, refreshSubscription, resumeSubscription, subscribe, updatePaymentMethod } from "@/app/actions/billing";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { FlowResult, Plan } from "../../../supabase/functions/_shared/billing-core";
import { CardForm, getStripe } from "./card-form";

export type PlanOption = { plan: Plan; label: string; price: string; per: string; note?: string; best?: boolean };

const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-[15px] font-medium disabled:opacity-50";
const primary = cn(btn, "bg-primary-600 text-white shadow-sm hover:bg-primary-700");
const secondary = cn(btn, "border border-line-strong bg-surface text-ink hover:bg-sunken");
const danger = cn(btn, "bg-wine-500 text-white hover:bg-wine-700");

function Notice({ r }: { r: FlowResult | null }) {
  if (!r?.message) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("rounded-xl px-4 py-3 text-sm", r.ok ? "bg-olive-50 text-olive-800" : "bg-wine-50 text-wine-700")}>
      {r.message}
    </p>
  );
}

/** Choose monthly or yearly, then pay with the Payment Element (all on this page). */
export function SubscribePanel({ publishableKey, options, trialDays, disclosure }: { publishableKey: string; options: PlanOption[]; trialDays: number; disclosure: Record<Plan, string> }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(options.find((o) => o.best)?.plan ?? "monthly");
  const [result, setResult] = useState<FlowResult | null>(null);
  const chosen = options.find((o) => o.plan === plan)!;

  const onDone = (r: FlowResult) => {
    setResult(r);
    if (r.ok) {
      router.replace("/?welcome=1");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Choose a plan</legend>
        {options.map((o) => (
          <label
            key={o.plan}
            className={cn(
              "relative flex cursor-pointer flex-col gap-1 rounded-2xl border p-5 transition-colors",
              plan === o.plan ? "border-primary-500 bg-primary-50/60 ring-2 ring-primary-200" : "border-line hover:border-line-strong",
            )}
          >
            <input type="radio" name="plan" value={o.plan} checked={plan === o.plan} onChange={() => setPlan(o.plan)} className="sr-only" />
            {o.best && <span className="absolute -top-2.5 right-4 rounded-full bg-primary-600 px-2.5 py-0.5 text-xs font-semibold text-white">Best value</span>}
            <span className="text-sm font-semibold tracking-wide text-muted uppercase">{o.label}</span>
            <span>
              <span className="font-display text-3xl font-semibold">{o.price}</span> <span className="text-muted">{o.per}</span>
            </span>
            {o.note && <span className="text-sm text-olive-700">{o.note}</span>}
            {plan === o.plan && <Check className="absolute top-4 left-4 hidden size-4 text-primary-600" aria-hidden />}
          </label>
        ))}
      </fieldset>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-1 font-semibold">Payment details</h2>
        <p className="mb-4 text-sm text-muted">{trialDays > 0 ? `You won't be charged today. Your ${trialDays}-day free trial starts now.` : `You'll be charged ${chosen.price} today.`}</p>
        <CardForm
          publishableKey={publishableKey}
          submitLabel={trialDays > 0 ? `Start ${trialDays}-day free trial` : `Subscribe · ${chosen.price} ${chosen.per}`}
          onSaved={(id) => subscribe(plan, id)}
          onDone={onDone}
        />
        <p className="mt-4 text-xs leading-relaxed text-muted">
          {disclosure[plan]} By continuing you agree to our{" "}
          <Link href="/terms" target="_blank" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" target="_blank" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <Notice r={result && !result.ok ? result : null} />
    </div>
  );
}

export type ManageProps = {
  publishableKey: string;
  canManage: boolean;
  status: string;
  plan: Plan | null;
  /** Shown on the switch button, e.g. "$49.00/year". */
  otherPlanPrice: string;
  saving?: string | null;
  pendingPlan: Plan | null;
  pendingAt: string | null;
  cancelAtPeriodEnd: boolean;
  endsOn: string | null;
  hasCard: boolean;
};

/** Change plan, update the card, pay a failed renewal, cancel or resume: all without leaving the app. */
export function ManageSubscription(p: ManageProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FlowResult | null>(null);
  const [dialog, setDialog] = useState<null | "plan" | "card" | "cancel">(null);
  const [reason, setReason] = useState("");
  const [why, setWhy] = useState("");

  const live = ["trialing", "active", "past_due", "unpaid"].includes(p.status);
  const other: Plan = p.plan === "yearly" ? "monthly" : "yearly";

  const run = (fn: () => Promise<FlowResult>) =>
    start(async () => {
      let r = await fn();
      if (r.clientSecret) {
        const s = await getStripe(p.publishableKey);
        const res = await s!.confirmCardPayment(r.clientSecret);
        const after = await refreshSubscription();
        r = res.error ? { ok: false, message: res.error.message ?? "The payment wasn't confirmed." } : { ok: true, message: "Payment confirmed. Thank you!", status: after.ok ? after.status : undefined };
      }
      setResult(r);
      setDialog(null);
      router.refresh();
    });

  if (!p.canManage) return <p className="text-sm text-muted">Only the family&apos;s account holder can change the plan, payment method or cancel.</p>;

  return (
    <div className="flex flex-col gap-4">
      <Notice r={result} />

      {(p.status === "past_due" || p.status === "unpaid") && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-wine-200 bg-wine-50 p-4">
          <p className="min-w-0 flex-1 text-sm text-wine-800">Your last payment didn&apos;t go through. Pay now with your card on file, or update your card.</p>
          <button type="button" className={primary} disabled={pending} onClick={() => run(payNow)}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Pay now
          </button>
        </div>
      )}

      {p.pendingPlan && p.pendingAt && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-sunken p-4">
          <p className="min-w-0 flex-1 text-sm">
            You&apos;ll switch to the <strong>{p.pendingPlan}</strong> plan on {p.pendingAt}.
          </p>
          <button type="button" className={secondary} disabled={pending} onClick={() => run(() => changePlan(p.plan ?? "yearly"))}>
            Stay on {p.plan}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {live && !p.cancelAtPeriodEnd && p.plan && !p.pendingPlan && (
          <button type="button" className={secondary} disabled={pending} onClick={() => setDialog("plan")}>
            <ArrowRightLeft className="size-4" /> Switch to {other}
            {other === "yearly" && p.saving ? <span className="text-olive-700"> · {p.saving}</span> : null}
          </button>
        )}
        {live && (
          <button type="button" className={secondary} disabled={pending} onClick={() => setDialog("card")}>
            <CreditCard className="size-4" /> {p.hasCard ? "Update payment method" : "Add a payment method"}
          </button>
        )}
        {live && !p.cancelAtPeriodEnd && (
          <button type="button" className={cn(secondary, "text-wine-700")} disabled={pending} onClick={() => setDialog("cancel")}>
            <XCircle className="size-4" /> Cancel subscription
          </button>
        )}
        {live && p.cancelAtPeriodEnd && (
          <button type="button" className={primary} disabled={pending} onClick={() => run(resumeSubscription)}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Resume subscription
          </button>
        )}
      </div>

      <Modal open={dialog === "plan"} onClose={() => setDialog(null)} title={`Switch to the ${other} plan`} size="sm">
        <div className="flex flex-col gap-4 text-[15px]">
          {p.status === "trialing" ? (
            <p>Your free trial continues. When it ends you&apos;ll pay {p.otherPlanPrice}.</p>
          ) : other === "yearly" ? (
            <p>
              You&apos;ll switch now and pay {p.otherPlanPrice}, minus a credit for the unused part of this month. Your plan then renews once a year.
            </p>
          ) : (
            <p>
              You keep your yearly plan until {p.endsOn ?? "the end of the paid year"}, then switch to {p.otherPlanPrice}. Nothing is charged now.
            </p>
          )}
          <button type="button" className={primary} disabled={pending} onClick={() => run(() => changePlan(other))}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Confirm switch
          </button>
        </div>
      </Modal>

      <Modal open={dialog === "card"} onClose={() => setDialog(null)} title="Payment method" description="This card is used for future payments." size="sm">
        {dialog === "card" && <CardForm publishableKey={p.publishableKey} submitLabel="Save card" onSaved={(id) => updatePaymentMethod(id)} onDone={(r) => (setResult(r), setDialog(null), router.refresh())} />}
      </Modal>

      <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancel your subscription?" size="sm">
        <div className="flex flex-col gap-4 text-[15px]">
          <p>
            You can keep using the app until <strong>{p.endsOn ?? "the end of this period"}</strong>, and you won&apos;t be charged again. Your family&apos;s information is kept, so you can come back anytime.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
            Why are you leaving? (optional)
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px]">
              <option value="">Choose…</option>
              <option>Too expensive</option>
              <option>Missing a feature we need</option>
              <option>Too hard to use</option>
              <option>Switching to another app</option>
              <option>We don&apos;t need it right now</option>
              <option>Something else</option>
            </select>
          </label>
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={400} placeholder="Anything we could do better?" className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]" />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondary} onClick={() => setDialog(null)}>
              Keep my plan
            </button>
            <button type="button" className={danger} disabled={pending} onClick={() => run(() => cancelSubscription([reason, why].filter(Boolean).join(": ") || null))}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Cancel subscription
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
