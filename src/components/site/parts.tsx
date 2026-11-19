import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ eyebrow, title, intro, center = true, as: H = "h2" }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; center?: boolean; as?: "h1" | "h2" }) {
  return (
    <div className={cn("mb-10 flex max-w-2xl flex-col gap-3", center && "mx-auto text-center")}>
      {eyebrow && <p className="text-sm font-semibold tracking-[0.14em] text-primary-600 uppercase">{eyebrow}</p>}
      <H className="text-[32px] leading-tight font-semibold sm:text-[40px]">{title}</H>
      {intro && <p className="text-lg text-muted">{intro}</p>}
    </div>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden />
      ))}
    </span>
  );
}

export type PublicReview = { id: string; rating: number; title: string | null; body: string; displayName: string };

export function ReviewCard({ r }: { r: PublicReview }) {
  return (
    <figure className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <Stars rating={r.rating} />
      {r.title && <p className="font-display text-lg font-semibold">{r.title}</p>}
      <blockquote className="flex-1 text-[15px] leading-relaxed whitespace-pre-line text-ink-soft">“{r.body}”</blockquote>
      <figcaption className="text-sm font-medium text-muted">{r.displayName}</figcaption>
    </figure>
  );
}

export function CallToAction({ trialDays, signedIn }: { trialDays: number; signedIn: boolean }) {
  return (
    <Section>
      <div className="bg-hearth flex flex-col items-center gap-5 rounded-[2rem] border border-line px-6 py-14 text-center">
        <h2 className="max-w-xl text-[32px] leading-tight font-semibold sm:text-[40px]">Give your family one place for everything.</h2>
        <p className="max-w-lg text-lg text-muted">{trialDays > 0 ? `Try everything free for ${trialDays} days. Cancel anytime.` : "Set up your family in minutes. Cancel anytime."}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={signedIn ? "/" : "/signup"} size="lg">
            {signedIn ? "Open the app" : trialDays > 0 ? "Start your free trial" : "Create your account"}
          </ButtonLink>
          <ButtonLink href="/features" size="lg" variant="secondary">
            See all features
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
