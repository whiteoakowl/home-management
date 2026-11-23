import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { deletePregnancyEntry } from "@/app/actions/pregnancy";
import { DeleteButton } from "@/components/forms/inline";
import { EntryModal } from "@/components/pregnancy/forms";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { formatShortDate } from "@/lib/dates";
import { JOURNAL_CATEGORIES } from "@/lib/pregnancy/catalog";
import { trimesterOfWeek } from "@/lib/pregnancy/dates";
import { entriesOf } from "@/lib/pregnancy/queries";
import { PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Pregnancy journal" };
const PAGE = 20;

export default async function JournalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; c?: string; w?: string; page?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, now, can, has } = ctx;
  const page = Math.max(0, Number(sp.page) || 0);
  const category = JOURNAL_CATEGORIES.some((c) => c.value === sp.c) ? sp.c! : null;
  const week = Number(sp.w) >= 1 && Number(sp.w) <= 45 ? Number(sp.w) : null;
  const rows = await entriesOf(p.id, ["journal"], { q: sp.q, category, week, limit: PAGE + 1, offset: page * PAGE });
  const more = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const edit = can("journal");
  const qs = (o: Record<string, string | number | null | undefined>) => "?" + new URLSearchParams(Object.entries({ q: sp.q, c: category, w: week, ...o }).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

  return (
    <>
      <PregnancyHeader ctx={ctx} active="journal" />
      {!has("journal") && <PremiumLocked f="journal" />}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap gap-2" role="search">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search your journal" maxLength={80} className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm" aria-label="Search" />
          <select name="c" defaultValue={category ?? ""} className="h-10 rounded-xl border border-line-strong bg-surface px-2 text-sm" aria-label="Type">
            <option value="">All types</option>
            {JOURNAL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input name="w" type="number" min={1} max={45} defaultValue={week ?? ""} placeholder="Week" className="h-10 w-20 rounded-xl border border-line-strong bg-surface px-2 text-sm" aria-label="Week" />
          <button className="h-10 rounded-xl bg-sunken px-3 text-sm font-medium ring-1 ring-line">Filter</button>
        </form>
        {edit && <EntryModal pregnancyId={p.id} kind="journal" now={now} triggerLabel="New entry" />}
      </div>
      {list.length ? (
        <ul className="flex flex-col gap-3">
          {list.map((e) => (
            <li key={e.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">
                      {formatShortDate(e.date)}
                      {e.week ? ` · Week ${e.week} · Trimester ${trimesterOfWeek(e.week)}` : ""} {e.category && <Badge>{JOURNAL_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}</Badge>} {e.mood}
                    </p>
                    {e.title && <p className="mt-1 font-semibold">{e.title}</p>}
                    {e.body && <p className="mt-1 text-[15px] whitespace-pre-line">{e.body}</p>}
                  </div>
                  {edit && (
                    <span className="flex shrink-0">
                      <EntryModal pregnancyId={p.id} kind="journal" now={now} item={{ id: e.id, kind: "journal", category: e.category, title: e.title, body: e.body, date: e.date, mood: e.mood }} triggerContent={<Pencil className="size-4" />} triggerClassName="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-sunken" />
                      <DeleteButton action={deletePregnancyEntry} fields={{ id: e.id }} what="this entry" />
                    </span>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-muted">{sp.q || category || week ? "Nothing matches that search." : "Write about how you're feeling, milestones, firsts and memories. Each entry is stamped with your week and trimester."}</p>
        </Card>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={qs({ page: page - 1 })} className="font-medium text-primary-600">← Newer</Link> : <span />}
        {more && <Link href={qs({ page: page + 1 })} className="font-medium text-primary-600">Older →</Link>}
      </div>
    </>
  );
}
