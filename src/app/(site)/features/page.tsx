import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { Icon } from "@/components/icons";
import { FaithShowcase } from "@/components/site/faith";
import { CallToAction, Section, SectionTitle } from "@/components/site/parts";
import { readSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/billing";
import { FEATURE_CATALOG } from "@/lib/feature-catalog";
import { EXTRA_FEATURES } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Features",
  description: "Every section and tab in the app: calendar, chores, meals, sports and dance, family chat, photo albums, wishlists, budget, faith (Christian, Catholic, Jewish, Hindu, Buddhist), home, health and more.",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default async function FeaturesPage() {
  const [settings, user] = await Promise.all([getPlatformSettings(), readSessionUser()]);
  const trial = settings.billingEnabled ? settings.trialDays : 0;
  const count = FEATURE_CATALOG.reduce((n, g) => n + g.sections.length, 0);

  return (
    <>
      <div className="bg-hearth">
        <Section className="pb-8">
          <SectionTitle as="h1" eyebrow="Features" title="Everything your family needs. Nothing it doesn't." intro={`${count} sections, each with its own tabs. Turn on the ones your family uses and hide the rest.`} />
          {/* Jump to a group */}
          <nav aria-label="Feature groups" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
            {FEATURE_CATALOG.map((g) => (
              <a key={g.title} href={`#${slug(g.title)}`} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-sunken">
                {g.title}
              </a>
            ))}
          </nav>
          <p className="mt-6 text-center text-[15px]">
            <a href="#faith" className="font-medium text-primary-700 hover:underline">
              ✝️ ⛪ ✡️ 🕉️ ☸️ 🌙 Faith tabs for Christian, Catholic, Jewish, Hindu, Buddhist and spiritual families →
            </a>
          </p>
        </Section>
      </div>

      {FEATURE_CATALOG.map((g) => (
        <Section key={g.title} id={slug(g.title)} className="scroll-mt-20 py-10 sm:py-12">
          <div className="mb-6">
            <h2 className="text-[28px] font-semibold">{g.title}</h2>
            <p className="text-muted">{g.intro}</p>
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {g.sections.map((s) => (
              <li key={s.name} id={slug(s.name)} className="flex scroll-mt-20 flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Icon name={s.icon} className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-lg leading-tight font-semibold">{s.name}</h3>
                    <p className="text-sm text-muted">{s.summary}</p>
                  </div>
                </div>
                <dl className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
                  {s.tabs.map((t) => (
                    <div key={t.name} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden />
                      <div>
                        <dt className="inline font-semibold text-ink">{t.name}: </dt>
                        <dd className="inline text-ink-soft">{t.does}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <FaithShowcase />

      <div className="border-b border-line bg-surface/60">
        <Section>
          <SectionTitle eyebrow="And all of this" title="Built in, everywhere" />
          <ul className="mx-auto grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRA_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden /> {f}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center">
            <Link href={user ? "/feedback?kind=feature" : "/contact"} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
              <Sparkles className="size-4" /> Missing something? Suggest a feature <ChevronRight className="size-4" />
            </Link>
          </p>
        </Section>
      </div>

      <CallToAction trialDays={trial} signedIn={!!user} />
    </>
  );
}
