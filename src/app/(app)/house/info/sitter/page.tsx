import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { householdInfo } from "@/db/schema";
import { BinderFields } from "@/components/binder/binder-item";
import { PrintButton } from "@/components/binder/print-button";
import { BINDER, isBinderKind, type BinderKind } from "@/lib/binder";
import { getViewer } from "@/lib/dal";
import { formatLongDate, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Babysitter sheet" };

/** Order on the sheet: what a sitter needs first. */
const ORDER: BinderKind[] = ["emergency", "phone", "address", "doctor", "insurance", "sitter", "school", "instructions", "wifi"];

/**
 * One printable page for a babysitter or grandparent: the family binder's
 * sitter sections. Only items the whole family can see are included, so
 * private and parents-only details never end up on paper.
 */
export default async function SitterSheet() {
  const viewer = await getViewer();
  if (!viewer.can("info")) notFound();
  const rows = await db
    .select()
    .from(householdInfo)
    .where(and(eq(householdInfo.familyId, viewer.family.id), isNull(householdInfo.privateOwnerId), eq(householdInfo.visibility, "family")))
    .orderBy(asc(householdInfo.title));
  const kind = (k: string): BinderKind => (isBinderKind(k) ? k : "note");
  // Health insurance only (a sitter doesn't need the car or house policy).
  const items = rows.filter((r) => BINDER[kind(r.kind)].sitter && !(r.kind === "insurance" && r.fields.type && !["health", "dental", "vision"].includes(r.fields.type)));
  const sections = ORDER.map((k) => ({ k, list: items.filter((r) => r.kind === k) })).filter((s) => s.list.length);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/house/info" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline">
          <ArrowLeft className="size-4" /> Family binder
        </Link>
        <PrintButton />
      </div>
      <p className="mb-4 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800 print:hidden">
        Only items the whole family can see are on this sheet. Private and parents-only details (like auto or home insurance) are left off.
      </p>
      <article className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-[#2b1f2a] print:border-0 print:p-0">
        <header className="mb-5 border-b border-line pb-3">
          <p className="text-sm text-muted">For our babysitter · {formatLongDate(todayIn(viewer.family.timezone))}</p>
          <h1 className="text-[28px] font-semibold">The {viewer.family.name} Family</h1>
          <p className="text-sm">In an emergency, call <strong>911</strong> first, then the people below.</p>
        </header>
        {sections.length === 0 ? (
          <p className="text-muted">Add emergency contacts, doctors, house rules and Wi-Fi to the family binder and they&apos;ll appear here.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {sections.map(({ k, list }) => (
              <section key={k} className="break-inside-avoid">
                <h2 className="mb-2 border-b border-line pb-1 text-base font-semibold">
                  {BINDER[k].emoji} {BINDER[k].label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
                  {list.map((r) => (
                    <div key={r.id} className="break-inside-avoid">
                      <p className="font-semibold">{r.title}</p>
                      <BinderFields kind={k} fields={r.fields} title={r.title} body={r.body} print />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
