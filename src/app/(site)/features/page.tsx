import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Icon } from "@/components/icons";
import { CallToAction, Section, SectionTitle } from "@/components/site/parts";
import { readSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/billing";
import { MODULE_META, type NavGroup } from "@/lib/modules";
import { EXTRA_FEATURES } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Features",
  description: "Calendar, chores, meals, sports and dance, family chat, photo albums, wishlists, budget, home, health and more, in one family app.",
};

const GROUPS: { group: NavGroup; title: string; intro: string }[] = [
  { group: "Today", title: "Plan the days", intro: "The calendar, chat and kids' activities that keep everyone in sync." },
  { group: "Cleaning & Chores", title: "Share the work", intro: "Chores and cleaning with schedules, rotations and rewards." },
  { group: "Family Pantry", title: "Feed the family", intro: "Pantry, recipes, meal plans and shopping lists that talk to each other." },
  { group: "Household", title: "Run the house", intro: "Everything about your home, its people, pets, vehicles and paperwork." },
  { group: "Personal", title: "Grow together", intro: "Journals, goals, reading and fitness, private or shared." },
  { group: "Money", title: "Stay on budget", intro: "Income, bills, savings and reports for the whole household." },
  { group: "Land", title: "Garden & homestead", intro: "For families who grow food or keep animals." },
];

export default async function FeaturesPage() {
  const [settings, user] = await Promise.all([getPlatformSettings(), readSessionUser()]);
  const modules = Object.values(MODULE_META).filter((m) => m.inNav);
  const trial = settings.billingEnabled ? settings.trialDays : 0;

  return (
    <>
      <div className="bg-hearth">
        <Section className="pb-10">
          <SectionTitle as="h1" eyebrow="Features" title="Everything your family needs. Nothing it doesn't." intro={`${settings.brandName} has a section for nearly every part of family life. Turn on the ones you use and hide the rest.`} />
        </Section>
      </div>

      {GROUPS.map(({ group, title, intro }) => {
        const items = modules.filter((m) => m.group === group);
        if (!items.length) return null;
        return (
          <Section key={group} className="py-10 sm:py-12">
            <div className="mb-6">
              <h2 className="text-[28px] font-semibold">{title}</h2>
              <p className="text-muted">{intro}</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Icon name={m.icon} className="size-5" />
                    </span>
                    <h3 className="text-lg font-semibold">{m.label}</h3>
                  </div>
                  <p className="text-[15px] text-ink-soft">{m.tagline}</p>
                  {m.highlights.length > 0 && (
                    <ul className="mt-auto flex flex-col gap-1.5 text-sm text-muted">
                      {m.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden /> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      <div className="mt-6 border-y border-line bg-surface/60">
        <Section>
          <SectionTitle eyebrow="And all of this" title="Built in, everywhere" />
          <ul className="mx-auto grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRA_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <CallToAction trialDays={trial} signedIn={!!user} />
    </>
  );
}
