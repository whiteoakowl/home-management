import type { Metadata } from "next";
import { Heart, Pencil } from "lucide-react";
import { deletePregnancyItem, updatePregnancyItem } from "@/app/actions/pregnancy";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PregnancyItemModal } from "@/components/pregnancy/forms";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { itemsOf } from "@/lib/pregnancy/queries";
import { cn } from "@/lib/utils";
import { PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Baby names" };

export default async function NamesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ list?: string; q?: string; sort?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, can, has } = ctx;
  const all = await itemsOf(p.id, "name");
  const list = ["first", "middle", "favorites"].includes(sp.list ?? "") ? sp.list! : "all";
  const q = sp.q?.trim().toLowerCase().slice(0, 60);
  let shown = all.filter((n) => (list === "favorites" ? n.favorite : list === "all" ? true : n.list === list || n.list === "both"));
  if (q) shown = shown.filter((n) => n.title.toLowerCase().includes(q) || (n.notes ?? "").toLowerCase().includes(q));
  shown = [...shown].sort(sp.sort === "az" ? (a, b) => a.title.localeCompare(b.title) : (a, b) => Number(b.favorite) - Number(a.favorite) || (b.rating ?? 0) - (a.rating ?? 0) || a.title.localeCompare(b.title));
  const edit = can("names");
  const href = (o: Record<string, string>) => "?" + new URLSearchParams({ list, ...(sp.q ? { q: sp.q } : {}), ...(sp.sort ? { sort: sp.sort } : {}), ...o }).toString();

  return (
    <>
      <PregnancyHeader ctx={ctx} active="names" />
      {!has("names") && <PremiumLocked f="names" />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks
          active={list}
          items={[
            { key: "all", label: `All (${all.length})`, href: href({ list: "all" }) },
            { key: "favorites", label: "♥ Favorites", href: href({ list: "favorites" }) },
            { key: "first", label: "First", href: href({ list: "first" }) },
            { key: "middle", label: "Middle", href: href({ list: "middle" }) },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <form role="search" className="flex gap-2">
            <input type="hidden" name="list" value={list} />
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Search names" maxLength={60} className="h-10 w-40 rounded-xl border border-line-strong bg-surface px-3 text-sm" aria-label="Search names" />
            <select name="sort" defaultValue={sp.sort ?? ""} className="h-10 rounded-xl border border-line-strong bg-surface px-2 text-sm" aria-label="Sort">
              <option value="">Top rated</option>
              <option value="az">A–Z</option>
            </select>
            <button className="h-10 rounded-xl bg-sunken px-3 text-sm ring-1 ring-line">Go</button>
          </form>
          {edit && <PregnancyItemModal pregnancyId={p.id} kind="name" list={list === "middle" ? "middle" : "first"} triggerLabel="Add names" />}
        </div>
      </div>
      {shown.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => (
            <li key={n.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3">
              {edit ? (
                <ActionButton action={updatePregnancyItem} fields={{ id: n.id, favorite: String(!n.favorite) }} label={n.favorite ? "Remove from favorites" : "Add to favorites"} className="size-9 rounded-full hover:bg-sunken">
                  <Heart className={cn("size-5", n.favorite ? "fill-wine-500 text-wine-500" : "text-muted")} />
                </ActionButton>
              ) : (
                <Heart className={cn("size-5 shrink-0", n.favorite ? "fill-wine-500 text-wine-500" : "text-muted")} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {n.title} <Badge>{n.list === "middle" ? "Middle" : n.list === "both" ? "First or middle" : "First"}</Badge> {n.data.sex === "girl" ? "👧" : n.data.sex === "boy" ? "👦" : ""}
                </p>
                <p className="text-sm text-muted">
                  {edit ? (
                    <span className="inline-flex">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <ActionButton key={r} action={updatePregnancyItem} fields={{ id: n.id, rating: n.rating === r ? 0 : r }} label={`Rate ${r} stars`} className="px-0.5 text-base">
                          <span className={(n.rating ?? 0) >= r ? "text-olive-500" : "text-line-strong"}>★</span>
                        </ActionButton>
                      ))}
                    </span>
                  ) : (
                    n.rating ? "★".repeat(n.rating) : ""
                  )}{" "}
                  {n.notes}
                </p>
              </div>
              {edit && (
                <span className="flex shrink-0">
                  <PregnancyItemModal pregnancyId={p.id} kind="name" item={{ id: n.id, title: n.title, list: n.list, status: n.status, notes: n.notes, rating: n.rating, appointmentId: null, data: n.data }} triggerContent={<Pencil className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken" />
                  <DeleteButton action={deletePregnancyItem} fields={{ id: n.id }} what={n.title} className="size-8" />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className="text-sm text-muted">{q || list !== "all" ? "No names match." : "Start a list of names you love. Add several at once, rate them, heart your favorites and note meanings. Share the pregnancy with your partner so you can both add."}</p>
        </Card>
      )}
    </>
  );
}
