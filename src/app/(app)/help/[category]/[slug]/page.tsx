import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, MessageSquareHeart } from "lucide-react";
import { Rich } from "@/components/help/rich";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { articleHref, articleOf, categoryOf } from "@/lib/help";
import { getHelp } from "@/lib/help/server";

export async function generateMetadata({ params }: PageProps<"/help/[category]/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${articleOf(slug)?.title ?? "Help"} · Help & Support` };
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-[15px] text-ink-soft">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white" aria-hidden>
            {i + 1}
          </span>
          <span className="pt-0.5">
            <Rich text={s} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[category]/[slug]">) {
  const { category, slug } = await params;
  const { articles } = await getHelp();
  // Articles about sections this person can't open, or for parents/the owner only, aren't found.
  const a = articles.find((x) => x.slug === slug && x.category === category);
  if (!a) notFound();
  const cat = categoryOf(a.category)!;
  const readable = new Set(articles.map((x) => x.slug));
  const related = (a.related ?? []).filter((s) => readable.has(s)).map((s) => articleOf(s)!);
  const more = related.length ? related : articles.filter((x) => x.category === a.category && x.slug !== a.slug).slice(0, 4);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/help" className="inline-flex min-h-11 items-center hover:text-primary-700">
              Help & Support
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-muted" aria-hidden />
          <li>
            <Link href={`/help/${cat.key}`} className="inline-flex min-h-11 items-center hover:text-primary-700">
              {cat.title}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-semibold sm:text-[30px]">{a.title}</h1>
        <p className="text-[15px] text-muted">
          <Rich text={a.summary} />
        </p>
        {(a.audience === "parents" || a.audience === "owner") && (
          <p>
            <Badge tone="olive">{a.audience === "owner" ? "For the account owner" : "For parents"}</Badge>
          </p>
        )}
      </header>

      {a.steps && (
        <Card>
          <h2 className="mb-4 text-base font-semibold">Steps</h2>
          <Steps steps={a.steps} />
        </Card>
      )}

      {a.sections?.map((s) => (
        <section key={s.heading} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.body && (
            <p className="text-[15px] text-ink-soft">
              <Rich text={s.body} />
            </p>
          )}
          {s.steps && <Steps steps={s.steps} />}
          {s.bullets && (
            <ul className="ml-5 flex list-disc flex-col gap-1.5 text-[15px] text-ink-soft marker:text-primary-400">
              {s.bullets.map((b, i) => (
                <li key={i}>
                  <Rich text={b} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {a.openIn && (
        <div>
          <ButtonLink href={a.openIn.href} icon={<ArrowRight className="size-4" />}>
            {a.openIn.label}
          </ButtonLink>
        </div>
      )}

      {more.length > 0 && (
        <section aria-labelledby="related" className="border-t border-line pt-6">
          <h2 id="related" className="mb-3 text-base font-semibold">
            Related articles
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {more.map((r) => (
              <li key={r.slug}>
                <Link href={articleHref(r)} className="flex min-h-12 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-[15px] hover:border-primary-300 hover:bg-primary-50">
                  {r.title}
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <MessageSquareHeart className="size-4" aria-hidden /> Didn&apos;t answer your question?
        <Link href="/feedback" className="font-medium text-primary-700 hover:underline">
          Contact support
        </Link>
      </p>
    </article>
  );
}
