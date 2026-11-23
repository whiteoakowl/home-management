import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { deletePregnancyEntry } from "@/app/actions/pregnancy";
import { DeleteButton } from "@/components/forms/inline";
import { EntryModal } from "@/components/pregnancy/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentLinks } from "@/components/ui/tabs";
import { formatShortDate } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { DOC_CATEGORIES, PHOTO_CATEGORIES } from "@/lib/pregnancy/catalog";
import { entriesOf } from "@/lib/pregnancy/queries";
import { PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Photos & documents" };
const PAGE = 24;

export default async function PhotosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; c?: string; page?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const ctx = await pregnancyContext(id);
  const { p, now, can, has } = ctx;
  const tab = sp.tab === "docs" ? "docs" : "photos";
  const kind = tab === "docs" ? "document" : "photo";
  const cats = tab === "docs" ? DOC_CATEGORIES : PHOTO_CATEGORIES;
  const category = cats.some((c) => c.value === sp.c) ? sp.c! : null;
  const page = Math.max(0, Number(sp.page) || 0);
  const rows = await entriesOf(p.id, [kind], { category, limit: PAGE + 1, offset: page * PAGE });
  const list = rows.slice(0, PAGE);
  const feat = tab === "docs" ? "documents" : "photos";
  const edit = can(feat);
  const editIcon = "inline-flex size-8 items-center justify-center rounded-lg bg-surface/90 text-ink shadow hover:bg-surface";

  return (
    <>
      <PregnancyHeader ctx={ctx} active="photos" />
      {!has(feat) && <PremiumLocked f={feat} />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentLinks active={tab} items={[{ key: "photos", label: "Bump & photos", href: "?tab=photos" }, { key: "docs", label: "Documents", href: "?tab=docs" }]} />
        {edit && <EntryModal pregnancyId={p.id} kind={kind} now={now} />}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`?tab=${tab}`} className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-line ${!category ? "bg-ink text-white" : "bg-surface"}`}>
          All
        </Link>
        {cats.map((c) => (
          <Link key={c.value} href={`?tab=${tab}&c=${c.value}`} className={`rounded-full px-3 py-1.5 text-sm ring-1 ring-line ${category === c.value ? "bg-ink text-white" : "bg-surface"}`}>
            {c.label}
          </Link>
        ))}
      </div>
      {!list.length ? (
        <Card>
          <CardHeader title={tab === "docs" ? "No documents yet" : "No photos yet"} />
          <p className="text-sm text-muted">{tab === "docs" ? "Keep ultrasound reports, test results and provider instructions in one private place." : "Add a bump photo each week to watch the change, plus ultrasound pictures and announcements."}</p>
        </Card>
      ) : tab === "photos" ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((e) => (
            <li key={e.id} className="relative overflow-hidden rounded-2xl border border-line bg-surface">
              <a href={fileUrl(e.fileId) ?? "#"} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(e.fileId, true) ?? ""} alt={e.title ?? "Pregnancy photo"} className="aspect-square w-full object-cover" loading="lazy" />
              </a>
              <div className="p-2 text-sm">
                <p className="truncate font-medium">{e.title || PHOTO_CATEGORIES.find((c) => c.value === e.category)?.label}</p>
                <p className="text-xs text-muted">
                  {formatShortDate(e.date)}
                  {e.week ? ` · Week ${e.week}` : ""}
                </p>
              </div>
              {edit && (
                <span className="absolute top-2 right-2 flex gap-1">
                  <EntryModal pregnancyId={p.id} kind="photo" now={now} item={{ id: e.id, kind: "photo", category: e.category, title: e.title, body: e.body, date: e.date, mood: e.mood }} triggerContent={<Pencil className="size-4" />} triggerClassName={editIcon} />
                  <DeleteButton action={deletePregnancyEntry} fields={{ id: e.id }} what="this photo" className="size-8 bg-surface/90 shadow" />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xl" aria-hidden>
                  📄
                </span>
                <a href={fileUrl(e.fileId) ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="block font-medium text-primary-700 hover:underline">{e.title || "Document"}</span>
                  <span className="text-sm text-muted">{[DOC_CATEGORIES.find((c) => c.value === e.category)?.label, formatShortDate(e.date), e.week && `Week ${e.week}`, e.body].filter(Boolean).join(" · ")}</span>
                </a>
                {edit && (
                  <span className="flex shrink-0">
                    <EntryModal pregnancyId={p.id} kind="document" now={now} item={{ id: e.id, kind: "document", category: e.category, title: e.title, body: e.body, date: e.date, mood: e.mood }} triggerContent={<Pencil className="size-4" />} triggerClassName="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-sunken" />
                    <DeleteButton action={deletePregnancyEntry} fields={{ id: e.id }} what="this document" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={`?tab=${tab}${category ? `&c=${category}` : ""}&page=${page - 1}`} className="font-medium text-primary-600">← Newer</Link> : <span />}
        {rows.length > PAGE && <Link href={`?tab=${tab}${category ? `&c=${category}` : ""}&page=${page + 1}`} className="font-medium text-primary-600">Older →</Link>}
      </div>
      <p className="mt-6 text-xs text-muted">🔒 Files are stored privately and only shown to people who can see this pregnancy.</p>
    </>
  );
}
