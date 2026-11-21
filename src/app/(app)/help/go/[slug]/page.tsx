import { notFound, redirect } from "next/navigation";
import { articleHref, articleOf } from "@/lib/help";
import { getHelp } from "@/lib/help/server";

/**
 * The page "?" buttons point here. It opens the article; if the article is
 * for parents or the owner only, it opens that topic (or the Help Center) instead.
 */
export default async function HelpGo({ params }: PageProps<"/help/go/[slug]">) {
  const { slug } = await params;
  const { articles, categories } = await getHelp();
  const a = articleOf(slug);
  if (!a) notFound();
  if (articles.some((x) => x.slug === slug)) redirect(articleHref(a));
  redirect(categories.some((c) => c.key === a.category) ? `/help/${a.category}` : "/help");
}
