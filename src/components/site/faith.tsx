import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { FAITH_OPTIONS, FAITH_POINTS } from "@/lib/site-content";
import { Section, SectionTitle } from "./parts";

/** Public-site band showing the religion tabs in the Spiritual section. */
export function FaithShowcase({ link = true }: { link?: boolean }) {
  return (
    <div id="faith" className="scroll-mt-20 border-y border-line bg-surface/60">
      <Section>
        <SectionTitle
          eyebrow="Faith & spiritual life"
          title="Your faith, your way"
          intro="Every family member can choose their own religion, more than one, or none at all. Each gets its own tab with holidays, reading, devotions, a prayer list and a journal."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FAITH_OPTIONS.map((f) => (
            <li key={f.name} className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span className="text-2xl" aria-hidden>
                  {f.emoji}
                </span>
                {f.name}
              </h3>
              <p className="text-[15px] text-muted">{f.does}</p>
            </li>
          ))}
        </ul>
        <ul className="mx-auto mt-10 grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {FAITH_POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[15px]">
              <Check className="mt-0.5 size-4 shrink-0 text-olive-600" aria-hidden /> {p}
            </li>
          ))}
        </ul>
        {link && (
          <p className="mt-8 text-center">
            <Link href="/features#spiritual-faith" className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline">
              See everything in the Spiritual & faith section <ChevronRight className="size-4" />
            </Link>
          </p>
        )}
      </Section>
    </div>
  );
}
