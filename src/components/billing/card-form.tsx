"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Appearance, type Stripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { LoaderCircle, Lock } from "lucide-react";
import { beginCardSetup, refreshSubscription } from "@/app/actions/billing";
import type { FlowResult } from "../../../supabase/functions/_shared/billing-core";

/**
 * Stripe Payment Element, styled like the rest of the app. The card fields
 * are Stripe's own secure frames: card numbers go straight from the browser
 * to Stripe and never touch our servers or database (PCI DSS SAQ A).
 * Stripe.js is always loaded from js.stripe.com, as Stripe requires.
 */
const stripes = new Map<string, Promise<Stripe | null>>();
export const getStripe = (key: string) => {
  if (!stripes.has(key)) stripes.set(key, loadStripe(key));
  return stripes.get(key)!;
};

/** The Payment Element's look, taken from the app's (and the family's) colors. */
function appearanceFrom(el: HTMLElement | null): Appearance {
  const css = el ? getComputedStyle(el) : null;
  const v = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  return {
    theme: "stripe",
    variables: {
      colorPrimary: v("--color-primary-600", "#6a2d5e"),
      colorBackground: v("--color-surface", "#fffdfb"),
      colorText: v("--color-ink", "#2a1a26"),
      colorTextSecondary: v("--color-muted", "#7d7586"),
      colorDanger: v("--color-wine-500", "#7a2e44"),
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      fontSizeBase: "15px",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { border: `1px solid ${v("--color-line-strong", "#d3c7cc")}`, boxShadow: "none", padding: "12px 14px" },
      ".Input:focus": { borderColor: v("--color-primary-600", "#6a2d5e"), boxShadow: `0 0 0 3px color-mix(in srgb, ${v("--color-primary-600", "#6a2d5e")} 18%, transparent)` },
      ".Label": { fontWeight: "500", color: v("--color-ink-soft", "#4a3946") },
      ".Tab, .Block": { border: `1px solid ${v("--color-line", "#e6dee0")}`, boxShadow: "none" },
    },
  };
}

type Saved = (setupIntentId: string) => Promise<FlowResult>;

function Inner({ submitLabel, onSaved, onDone, publishableKey }: { submitLabel: string; onSaved: Saved; onDone: (r: FlowResult) => void; publishableKey: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const finish = async (r: FlowResult) => {
    // The bank wants to confirm the payment (3-D Secure): finish it here, then read the result.
    if (r.clientSecret) {
      const s = await getStripe(publishableKey);
      const res = await s!.confirmCardPayment(r.clientSecret);
      if (res.error) {
        await refreshSubscription();
        return onDone({ ok: false, message: res.error.message ?? "The payment wasn't confirmed." });
      }
      const after = await refreshSubscription();
      return onDone({ ok: true, message: "Payment confirmed. Thank you!", status: after.ok ? after.status : undefined });
    }
    onDone(r);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: `${window.location.origin}${window.location.pathname}${window.location.search}` },
      });
      if (err) {
        setError(err.message ?? "Your card couldn't be saved.");
        return;
      }
      if (setupIntent?.status !== "succeeded") {
        setError("Your card couldn't be confirmed. Please try again.");
        return;
      }
      const r = await onSaved(setupIntent.id);
      if (!r.ok && !r.clientSecret) setError(r.message);
      else await finish(r);
    } catch (e) {
      console.error("Payment form error:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!ready && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" /> Loading secure card form…
        </p>
      )}
      <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      {error && (
        <p role="alert" className="rounded-xl bg-wine-50 px-3 py-2 text-sm text-wine-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || !ready || busy}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary-600 px-5 font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : <Lock className="size-4" />}
        {busy ? "Working…" : submitLabel}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="size-3" /> Secured by Stripe. Your card number never touches our servers.
      </p>
    </form>
  );
}

/**
 * Collects a card (Stripe SetupIntent), then hands the confirmed SetupIntent
 * to `onSaved` (subscribe, or update the card). Also finishes the rare flow
 * where the bank redirected away and back (?setup_intent=…).
 */
export function CardForm({ publishableKey, submitLabel, onSaved, onDone }: { publishableKey: string; submitLabel: string; onSaved: Saved; onDone: (r: FlowResult) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const stripePromise = useMemo(() => getStripe(publishableKey), [publishableKey]);

  useEffect(() => {
    let live = true;
    const url = new URL(window.location.href);
    const returned = url.searchParams.get("setup_intent");
    const run = async () => {
      // Back from a bank redirect: carry on with the saved card.
      if (returned && url.searchParams.get("redirect_status") === "succeeded") {
        ["setup_intent", "setup_intent_client_secret", "redirect_status"].forEach((k) => url.searchParams.delete(k));
        window.history.replaceState(null, "", url.toString());
        const r = await onSaved(returned);
        if (live) onDone(r);
        return;
      }
      const r = await beginCardSetup();
      if (!live) return;
      if (r.ok) {
        setAppearance(appearanceFrom(ref.current));
        setClientSecret(r.clientSecret);
      } else setError(r.message);
    };
    void run();
    return () => {
      live = false;
    };
    // Runs once per form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options: StripeElementsOptions | null = clientSecret && appearance ? { clientSecret, appearance, fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" }] } : null;

  return (
    <div ref={ref}>
      {error ? (
        <p role="alert" className="rounded-xl bg-wine-50 px-3 py-2 text-sm text-wine-700">
          {error}
        </p>
      ) : options ? (
        <Elements stripe={stripePromise} options={options}>
          <Inner submitLabel={submitLabel} onSaved={onSaved} onDone={onDone} publishableKey={publishableKey} />
        </Elements>
      ) : (
        <p className="flex items-center gap-2 py-6 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" /> Preparing secure payment…
        </p>
      )}
    </div>
  );
}
