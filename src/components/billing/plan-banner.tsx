"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";

export type LockedArea = { href: string; label: string; exact?: boolean };

/**
 * Plan notices above every page:
 *  - Free plan, on a Premium page: it's view-only (everything saved is still here).
 *  - Free plan, on Home (parents): what Premium adds.
 *  - Free trial (parents): days left.
 */
export function PlanBanner({ tier, trialDaysLeft, isOwner, isParent, holder, locked }: { tier: "premium" | "trial" | "free"; trialDaysLeft: number; isOwner: boolean; isParent: boolean; holder: string; locked: LockedArea[] }) {
  const path = usePathname();
  if (tier === "premium") return null;

  const cta = isOwner ? (
    <Link href="/billing" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-3.5 text-sm font-semibold text-white hover:bg-primary-700">
      <Sparkles className="size-3.5" aria-hidden /> {tier === "trial" ? "Choose a plan" : "Upgrade"}
    </Link>
  ) : (
    <span className="text-sm text-muted">Ask {holder} to upgrade.</span>
  );

  if (tier === "trial") {
    if (!isParent) return null;
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
        <p>
          <strong className="font-semibold">Premium free trial:</strong> {trialDaysLeft === 1 ? "1 day" : `${trialDaysLeft} days`} left. Afterwards you keep the Free plan, or choose Premium to keep everything.
        </p>
        {cta}
      </div>
    );
  }

  const area = locked
    .filter((a) => (a.exact ? path === a.href : path === a.href || path.startsWith(a.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (area)
    return (
      <div role="note" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm shadow-sm">
        <p className="flex items-start gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
          <span>
            <strong className="font-semibold">{area.label} is part of Premium.</strong> Your family is on the Free plan, so this is view-only. Everything you saved is still here.
          </span>
        </p>
        {cta}
      </div>
    );

  if (path === "/" && isParent)
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
        <p>
          <strong className="font-semibold">You&apos;re on the Free plan.</strong> Premium adds meal plans, recipes, budget, calendar sync, trips and much more.
        </p>
        {isOwner ? (
          <Link href="/billing" className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-primary-300 bg-surface px-3.5 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            See Premium
          </Link>
        ) : null}
      </div>
    );
  return null;
}
