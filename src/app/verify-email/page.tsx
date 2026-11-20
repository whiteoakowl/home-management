import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Brand } from "@/components/brand";
import { consumeToken } from "@/lib/auth/tokens";
import { getBrand } from "@/lib/billing";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

/** The link from the verification email: confirms the address it was sent to. */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const row = typeof token === "string" ? await consumeToken(token, "verify") : null;
  let ok = false;
  if (row) {
    const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId));
    // Only if the account still uses the address the link was sent to.
    if (u && u.email === row.email) {
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId));
      ok = true;
    }
  }
  return (
    <main className="bg-hearth flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Brand className="mb-8" title={await getBrand()} />
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center shadow-[var(--shadow-pop)]">
        {ok ? <CheckCircle2 className="size-10 text-olive-600" /> : <XCircle className="size-10 text-wine-500" />}
        <h1 className="text-2xl font-semibold">{ok ? "Email confirmed" : "This link has expired"}</h1>
        <p className="text-sm text-muted">{ok ? "Thanks! You'll get receipts and password-reset emails at this address." : "Confirmation links work for 3 days and only once. Sign in and send a new one from the banner at the top of the app."}</p>
        <Link href="/" className="mt-2 font-medium text-primary-600 hover:underline">
          Go to the app
        </Link>
      </div>
    </main>
  );
}
