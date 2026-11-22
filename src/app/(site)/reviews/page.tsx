import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { MessageSquareHeart } from "lucide-react";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { CallToAction, ReviewCard, Section, SectionTitle, Stars } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/billing";

export const metadata: Metadata = { title: "Reviews", description: "What families say about the app." };

export default async function ReviewsPage() {
  const [settings, user, rows] = await Promise.all([
    getPlatformSettings(),
    readSessionUser(),
    db.select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, displayName: reviews.displayName }).from(reviews).where(eq(reviews.status, "approved")).orderBy(desc(reviews.featured), desc(reviews.updatedAt)).limit(200),
  ]);
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const trial = settings.billingEnabled ? settings.trialDays : 0;
  return (
    <>
      <div className="bg-hearth">
        <Section className="pb-10">
          <SectionTitle as="h1" eyebrow="Reviews" title="From families like yours" intro={`Real reviews from families using ${settings.brandName}.`} />
          {rows.length > 0 && (
            <div className="mx-auto flex w-fit flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-6 py-4 shadow-[var(--shadow-card)]">
              <p className="font-display text-4xl font-semibold">{avg.toFixed(1)}</p>
              <Stars rating={avg} />
              <p className="text-sm text-muted">
                from {rows.length} review{rows.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </Section>
      </div>
      <Section className="pt-6">
        {rows.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
            <MessageSquareHeart className="size-10 text-primary-500" />
            <p className="text-lg font-semibold">Reviews are on their way</p>
            <p className="text-muted">We&apos;re new! Be one of the first families to share what you think.</p>
          </div>
        ) : (
          <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {rows.map((r) => (
              <li key={r.id} className="mb-4 break-inside-avoid">
                <ReviewCard r={r} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="font-semibold">Already using {settings.brandName}?</p>
          <ButtonLink href={user ? "/feedback#review" : "/login?next=/feedback"} variant="secondary">
            Write a review
          </ButtonLink>
        </div>
      </Section>
      <CallToAction trialDays={trial} signedIn={!!user} />
    </>
  );
}
