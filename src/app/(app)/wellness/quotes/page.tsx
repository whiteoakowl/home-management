import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Heart } from "lucide-react";
import { db } from "@/db";
import { quoteFavorites } from "@/db/schema";
import { toggleQuoteFavorite } from "@/app/actions/wellness";
import { ActionButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { QuoteNoteForm } from "@/components/wellness/forms";
import { WellnessFooter, WellnessTabs } from "@/components/wellness/shared";
import { CopyQuote } from "@/components/wellness/copy-quote";
import { AreaOff } from "@/components/health/area-off";
import { getViewer } from "@/lib/dal";
import { areaHidden } from "@/lib/privacy";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { healthProfile } from "@/lib/personal-health";
import { quoteById, quoteFor } from "@/lib/quotes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: PageProps<"/wellness/quotes">) {
  const viewer = await getViewer();
  if (areaHidden(viewer.member, "wellness")) return <AreaOff label="Mental Wellness" />;
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const [profile, favs] = await Promise.all([healthProfile(viewer.family.id, viewer.member.id), db.select().from(quoteFavorites).where(eq(quoteFavorites.memberId, viewer.member.id))]);
  const favMap = new Map(favs.map((f) => [f.quoteId, f]));
  const focus = typeof sp.quote === "string" ? quoteById(sp.quote) : undefined;
  const recent = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).map((d) => ({ date: d, quote: quoteFor(d, profile.quoteCategories) }));
  const QuoteCard = ({ id, date }: { id: string; date?: string }) => {
    const qt = quoteById(id)!;
    const fav = favMap.get(id);
    return (
      <Card className="flex flex-col gap-2">
        {date && <p className="text-xs font-semibold tracking-wider text-muted uppercase">{date === today ? "Today" : formatShortDate(date)}</p>}
        <blockquote className="font-display text-lg leading-snug">“{qt.text}”</blockquote>
        <p className="text-sm text-muted">
          {qt.author ? `${qt.author} · ` : ""}
          {qt.category}
        </p>
        {fav?.note && <p className="rounded-lg bg-sunken px-3 py-2 text-sm">{fav.note}</p>}
        <div className="flex flex-wrap gap-2">
          <ActionButton action={toggleQuoteFavorite} fields={{ quoteId: id }} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium", fav ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken")}>
            <Heart className={cn("size-4", fav && "fill-current")} /> {fav ? "Saved" : "Save"}
          </ActionButton>
          <CopyQuote text={`“${qt.text}”${qt.author ? ` — ${qt.author}` : ""}`} />
        </div>
      </Card>
    );
  };
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader eyebrow="My private · Mental Wellness" title="Quotes" description="A new one every day. Save the ones that speak to you and add your own note." />
      <WellnessTabs active="quotes" />
      {focus && (
        <Card className="flex flex-col gap-3">
          <CardHeader title="Add a note" />
          <blockquote className="font-display text-lg">“{focus.text}”</blockquote>
          <QuoteNoteForm quoteId={focus.id} note={favMap.get(focus.id)?.note ?? null} />
        </Card>
      )}
      {favs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Saved</h2>
          {favs.filter((f) => quoteById(f.quoteId)).map((f) => (
            <QuoteCard key={f.quoteId} id={f.quoteId} />
          ))}
        </section>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Recent days</h2>
        {recent.map((r) => (
          <QuoteCard key={r.date} id={r.quote.id} date={r.date} />
        ))}
      </section>
      <WellnessFooter />
    </div>
  );
}
