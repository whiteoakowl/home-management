import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth/session";
import { OfferBar, trialOf } from "@/components/site/plans";
import { getBrand, getPlatformSettings } from "@/lib/billing";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];

/** The public website: home, features, pricing, reviews, contact. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [brand, user, settings] = await Promise.all([getBrand(), readSessionUser(), getPlatformSettings()]);
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {!user && <OfferBar trial={trialOf(settings)} />}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/welcome" aria-label={`${brand} home`}>
            <Brand title={brand} />
          </Link>
          <nav aria-label="Website" className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-[15px] font-medium text-ink-soft hover:bg-sunken hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {user ? (
              <ButtonLink href="/">Open the app</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup">Get started free</ButtonLink>
              </>
            )}
          </div>
          <details className="group relative ml-auto md:hidden">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full hover:bg-sunken [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu className="size-5" />
            </summary>
            <div className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-xl px-3 py-2.5 font-medium hover:bg-sunken">
                  {n.label}
                </Link>
              ))}
              <hr className="my-1 border-line" />
              {user ? (
                <ButtonLink href="/">Open the app</ButtonLink>
              ) : (
                <>
                  <Link href="/login" className="rounded-xl px-3 py-2.5 font-medium hover:bg-sunken">
                    Sign in
                  </Link>
                  <ButtonLink href="/signup">Get started free</ButtonLink>
                </>
              )}
            </div>
          </details>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
          <div className="flex flex-col gap-3">
            <Brand title={brand} />
            <p className="max-w-xs text-sm text-muted">One home base for your family&apos;s calendar, chores, meals, activities and everything in between.</p>
            <p className="max-w-xs text-sm font-medium text-ink-soft">
              Free forever for the everyday family hub.{trialOf(settings) > 0 ? ` Premium free for ${trialOf(settings)} days, no card needed.` : ""}{" "}
              <Link href="/pricing" className="text-primary-700 hover:underline">
                See plans
              </Link>
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">Product</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Account" className="flex flex-col gap-2 text-sm">
            <span className="font-semibold">Account</span>
            <Link href="/signup" className="text-muted hover:text-ink">
              Create an account
            </Link>
            <Link href="/login" className="text-muted hover:text-ink">
              Sign in
            </Link>
            <Link href="/privacy-policy" className="text-muted hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted hover:text-ink">
              Terms
            </Link>
          </nav>
        </div>
        <p className="pb-8 text-center text-xs text-muted">
          © {year} {brand}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
