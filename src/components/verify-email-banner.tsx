"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { resendVerification } from "@/app/actions/auth";

/** Reminds the account holder to confirm their email (for receipts and password resets). */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
      <MailCheck className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{msg ?? `Please confirm your email: we sent a link to ${email}. It lets us send receipts and password resets.`}</span>
      {!msg && (
        <button type="button" disabled={pending} onClick={() => start(async () => setMsg((await resendVerification())?.message ?? null))} className="font-semibold underline disabled:opacity-50">
          {pending ? "Sending…" : "Send it again"}
        </button>
      )}
    </div>
  );
}
