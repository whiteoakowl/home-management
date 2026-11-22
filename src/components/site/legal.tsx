import type { ReactNode } from "react";
import { Section } from "./parts";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <Section className="max-w-3xl">
      <h1 className="text-[36px] font-semibold">{title}</h1>
      <p className="mb-8 text-sm text-muted">Last updated {updated}</p>
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink-soft [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </Section>
  );
}
