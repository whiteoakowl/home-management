import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui/display";
import { articleHref, categoryOf } from "@/lib/help";
import { getHelp } from "@/lib/help/server";

export async function generateMetadata({ params }: PageProps<"/help/[category]">): Promise<Metadata> {
  const { category } = await params;
  return { title: `${categoryOf(category)?.title ?? "Help"} · Help & Support` };
}

export default async function HelpCategoryPage({ params }: PageProps<"/help/[category]">) {
  const { category } = await params;
  const { categories, articles } = await getHelp();
  const cat = categories.find((c) => c.key === category);
  // Unknown topics, and topics with nothing this person may read, look the same.
  if (!cat) notFound();
  const list = articles.filter((a) => a.category === cat.key);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/help" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-primary-700">
        <ArrowLeft className="size-4" aria-hidden /> Help & Support
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Icon name={cat.icon} className="size-4" /> Help topic
          </span>
        }
        title={cat.title}
        description={cat.description}
      />
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {list.map((a) => (
          <li key={a.slug}>
            <Link href={articleHref(a)} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-sunken">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{a.title}</span>
                <span className="text-sm text-muted">{a.summary.replace(/\*\*/g, "")}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
