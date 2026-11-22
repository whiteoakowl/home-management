import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LifeBuoy, MessageSquareHeart } from "lucide-react";
import { FaqList } from "@/components/help/faq-list";
import { HelpSearch } from "@/components/help/help-search";
import { Icon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { articleHref, articleOf, searchDocs } from "@/lib/help";
import { getHelp } from "@/lib/help/server";

export const metadata: Metadata = { title: "Help & Support" };

/** Popular articles shown first (only the ones this person may read). */
const POPULAR = ["navigating-the-app", "create-event", "recurring-events", "create-chore", "shopping-list", "push-notifications", "albums", "important-info", "add-family-member", "permissions"];

export default async function HelpPage() {
  const { categories, articles, faqs } = await getHelp();
  const readable = new Set(articles.map((a) => a.slug));
  const popular = POPULAR.filter((s) => readable.has(s)).map((s) => articleOf(s)!).slice(0, 6);
  const names = Object.fromEntries(categories.map((c) => [c.key, c.title]));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <PageHeader eyebrow="Help & Support" title="How can we help?" description="Step-by-step guides for everything in your family's app." />

      <HelpSearch docs={searchDocs(articles)} categories={names} />

      {popular.length > 0 && (
        <section aria-labelledby="popular">
          <h2 id="popular" className="mb-3 text-lg font-semibold">
            Popular
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {popular.map((a) => (
              <li key={a.slug}>
                <Link href={articleHref(a)} className="flex min-h-12 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-[15px] hover:border-primary-300 hover:bg-primary-50">
                  {a.title}
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="topics">
        <h2 id="topics" className="mb-3 text-lg font-semibold">
          Browse by topic
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.key}>
              <Link href={`/help/${c.key}`} className="flex h-full gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary-300">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Icon name={c.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{c.title}</span>
                  <span className="text-sm text-muted">{c.description}</span>
                  <span className="text-xs text-muted">
                    {c.count} {c.count === 1 ? "article" : "articles"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {faqs.length > 0 && (
        <section aria-labelledby="faqs">
          <h2 id="faqs" className="mb-3 text-lg font-semibold">
            Frequently asked questions
          </h2>
          <FaqList faqs={faqs} />
        </section>
      )}

      <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
            <LifeBuoy className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">Still need help?</p>
            <p className="text-sm text-muted">Send us a question, report a problem or suggest an idea. We read every message.</p>
          </div>
        </div>
        <ButtonLink href="/feedback" variant="secondary" icon={<MessageSquareHeart className="size-4" />}>
          Contact support
        </ButtonLink>
      </Card>
    </div>
  );
}
