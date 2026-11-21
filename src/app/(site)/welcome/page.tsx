import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Check, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { Icon } from "@/components/icons";
import { FaithShowcase } from "@/components/site/faith";
import { CallToAction, ReviewCard, Section, SectionTitle } from "@/components/site/parts";
import { ButtonLink } from "@/components/ui/button";
import { readSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/billing";
import { PlanCards } from "@/components/site/plans";
import { HOME_HIGHLIGHTS, PILLARS, STEPS } from "@/lib/site-content";

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = await getPlatformSettings();
  return {
    title: { absolute: `${brandName}: your family's home base` },
    description: "One app for your family's calendar, chores, meals, sports, chat, wishlists, budget, faith and more. Free forever for the everyday family hub, with a free Premium trial. Everyone gets their own login.",
  };
}

/** Mock of the app's home screen, drawn in HTML (no real family's data). */
function AppPreview() {
  const rows = [
    { time: "7:30", label: "School drop-off", who: "#8e4e7b" },
    { time: "4:30", label: "Soccer practice · Field 3", who: "#6d6a3c" },
    { time: "5:00", label: "Ballet · Studio B", who: "#c991c4" },
    { time: "6:15", label: "Taco night 🌮", who: "#d08a5c" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-primary-200/40 blur-3xl" />
      <div className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-pop)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Tuesday</p>
            <p className="font-display text-2xl font-semibold">Good morning, Jordans</p>
          </div>
          <div className="flex -space-x-2">
            {["#8e4e7b", "#6d6a3c", "#c991c4", "#d08a5c"].map((c) => (
              <span key={c} className="size-8 rounded-full ring-2 ring-surface" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="mb-4 rounded-2xl bg-sunken p-3">
          <p className="mb-2 text-sm font-semibold">Today</p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-3 text-sm">
                <span className="w-10 text-muted tabular-nums">{r.time}</span>
                <span className="h-6 w-1 rounded-full" style={{ background: r.who }} />
                <span className="font-medium">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-line p-3">
            <p className="font-semibold">Chores</p>
            <p className="text-muted">5 of 7 done</p>
            <div className="mt-2 h-2 rounded-full bg-sunken">
              <div className="h-2 w-[70%] rounded-full bg-primary-500" />
            </div>
          </div>
          <div className="rounded-2xl border border-line p-3">
            <p className="font-semibold">Shopping</p>
            <p className="text-muted">12 items · 3 aisles</p>
            <p className="mt-1 text-xs text-olive-700">✓ Milk added by Ava</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const deleted = (await searchParams).deleted === "1";
  const [settings, user, featured] = await Promise.all([
    getPlatformSettings(),
    readSessionUser(),
    db.select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, displayName: reviews.displayName }).from(reviews).where(eq(reviews.status, "approved")).orderBy(desc(reviews.featured), desc(reviews.rating), desc(reviews.updatedAt)).limit(3),
  ]);
  const trial = settings.billingEnabled && settings.trialDays > 0 ? settings.trialDays : 0;

  return (
    <>
      {deleted && <p role="status" className="bg-olive-50 px-4 py-3 text-center text-sm text-olive-800">Your family&apos;s account and information were deleted, and your subscription was cancelled. Thank you for using {settings.brandName}.</p>}
      <div className="bg-hearth overflow-x-clip">
        <Section className="grid items-center gap-12 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-6">
            <Link href="#plans" className="w-fit rounded-full border border-primary-200 bg-surface/70 px-3 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50">
              Free forever{trial ? ` · ${trial}-day Premium trial, no card` : ""} →
            </Link>
            <h1 className="text-[42px] leading-[1.05] font-semibold sm:text-[56px]">Your whole family, finally on the same page.</h1>
            <p className="max-w-xl text-lg text-muted">
              {settings.brandName} brings your calendar, chores, meals, kids&apos; activities, chat, wishlists and budget into one app, with a login for everyone and your family&apos;s name on the home screen.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={user ? "/" : "/signup"} size="lg">
                {user ? "Open the app" : "Get started free"}
              </ButtonLink>
              <ButtonLink href="/features" size="lg" variant="secondary">
                Explore features
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              {["Free plan forever", trial ? `${trial} days of Premium free, no card` : null, "One price for the whole family"].filter(Boolean).map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-olive-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <AppPreview />
        </Section>
      </div>

      <Section>
        <SectionTitle eyebrow="Everything in one place" title="All the things your family juggles" intro="Stop switching between a calendar app, a chore chart, a grocery list, a group text and a spreadsheet." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Icon name={h.icon} className="size-5" />
              </span>
              <h3 className="text-lg font-semibold">{h.title}</h3>
              <p className="text-[15px] text-muted">{h.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center">
          <Link href="/features" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
            See every feature <ChevronRight className="size-4" />
          </Link>
        </p>
      </Section>

      <FaithShowcase />

      <div className="border-b border-line bg-surface/60">
        <Section>
          <SectionTitle eyebrow="Made for real families" title="Built around the people in your house" />
          <ul className="grid gap-6 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                  <Check className="size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="text-[15px] text-muted">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section>
        <SectionTitle eyebrow="Get started" title="Up and running tonight" />
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-6">
              <span className="font-display text-3xl font-semibold text-primary-500">{i + 1}</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="text-[15px] text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {featured.length > 0 && (
        <Section className="pt-0">
          <SectionTitle eyebrow="Reviews" title="Families love it" />
          <ul className="flex flex-wrap justify-center gap-4">
            {featured.map((r) => (
              <li key={r.id} className="w-full md:w-[calc((100%-2rem)/3)]">
                <ReviewCard r={r} />
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center">
            <Link href="/reviews" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
              Read more reviews <ChevronRight className="size-4" />
            </Link>
          </p>
        </Section>
      )}

      <Section id="plans" className="scroll-mt-20 pt-0">
        <SectionTitle
          eyebrow="Plans"
          title="Start free. Upgrade when you're ready."
          intro={trial ? `The everyday family hub is free forever. Every new family also gets ${trial} days of Premium free, with no card needed.` : "The everyday family hub is free forever. Premium unlocks everything else."}
        />
        <PlanCards s={settings} signedIn={!!user} />
        <p className="mt-6 text-center">
          <Link href="/pricing" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
            Pricing questions <ChevronRight className="size-4" />
          </Link>
        </p>
      </Section>

      <CallToAction trialDays={trial} signedIn={!!user} />
    </>
  );
}
