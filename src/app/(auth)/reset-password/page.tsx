import type { Metadata } from "next";
import Link from "next/link";
import { findToken } from "@/lib/auth/tokens";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && (await findToken(token, "reset"));
  if (!valid)
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">This link has expired</h1>
        <p className="text-sm text-muted">Reset links work for 1 hour and only once. Ask for a new one.</p>
        <Link href="/forgot-password" className="font-medium text-primary-600 hover:underline">
          Send me a new link
        </Link>
      </div>
    );
  return <ResetPasswordForm token={token as string} />;
}
