import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { readSessionUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await readSessionUser()) redirect("/");

  return (
    <main className="bg-hearth flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Brand className="mb-8" />
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-line bg-surface/95 p-6 shadow-[var(--shadow-pop)] backdrop-blur sm:p-8">
        {children}
      </div>
      <p className="mt-8 max-w-sm text-center text-sm text-muted">
        Chores, meals, garden, budget and everything in between, for the whole family.
      </p>
    </main>
  );
}
