import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { articleHref, articleOf, type HelpFaq } from "@/lib/help";
import { Rich } from "./rich";

/** FAQ accordions (native <details>, so they work before scripts load and with keyboards). */
export function FaqList({ faqs }: { faqs: HelpFaq[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {faqs.map((f) => {
        const a = f.slug ? articleOf(f.slug) : undefined;
        return (
          <li key={f.q}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium hover:bg-sunken [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="flex flex-col gap-2 px-4 pb-4 text-[15px] text-ink-soft">
                <p>
                  <Rich text={f.a} />
                </p>
                {a && (
                  <Link href={articleHref(a)} className="w-fit text-sm font-medium text-primary-700 underline-offset-2 hover:underline">
                    Read: {a.title}
                  </Link>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
