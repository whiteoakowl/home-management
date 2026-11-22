import Link from "next/link";
import { Settings2 } from "lucide-react";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { LinkTabs } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { FAITH_META, FAITHS, faithHref, faithPathsOf, type Faith } from "@/lib/faith-config";
import { cn } from "@/lib/utils";

/** One tab per religion/path the member chose (plus the one being viewed). */
export async function FaithTabs({ active }: { active: Faith }) {
  const viewer = await getViewer();
  const mine = faithPathsOf(viewer.member, viewer.family);
  const tabs = FAITHS.filter((f) => mine.includes(f));
  return (
    <nav aria-label="Religions and paths" className="-mx-1 mb-5 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((f) => {
        const on = f === active;
        return (
          <Link
            key={f}
            href={faithHref(f)}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-[15px] font-semibold transition-colors",
              on ? "border-primary-500 bg-primary-600 text-white shadow-sm" : "border-line bg-surface text-ink hover:border-primary-300",
            )}
          >
            <span aria-hidden>{FAITH_META[f].emoji}</span> {FAITH_META[f].tab}
          </Link>
        );
      })}
      {viewer.isParent && (
        <Link href="/settings#faith" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium text-muted hover:text-ink" title="Choose the religions your family uses and who gets each one">
          <Settings2 className="size-4" /> Religions
        </Link>
      )}
    </nav>
  );
}

export type FaithPage = "today" | "holidays" | "saints" | "reading" | "devotions" | "journal";

/** The pages inside one religion's tab. */
export function FaithSubTabs({ faith, active }: { faith: Faith; active: FaithPage }) {
  if (faith === "spiritual") return <CraftTabs active={active} />;
  const base = `/spiritual/faith/${faith}`;
  const m = FAITH_META[faith];
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "today", href: base, label: "Today" },
        { key: "holidays", href: `${base}/holidays`, label: faith === "catholic" ? "Feasts & holy days" : "Holidays" },
        ...(faith === "catholic" ? [{ key: "saints", href: `${base}/holidays?tradition=Saints`, label: "Saints" }] : []),
        { key: "reading", href: `${base}/reading`, label: "Reading" },
        { key: "devotions", href: `${base}/devotions`, label: faith === "christian" ? "Devotions & prayer" : faith === "catholic" ? "Prayer & sacraments" : faith === "jewish" ? "Prayer & mitzvot" : faith === "hindu" ? "Puja & sadhana" : "Practice" },
        { key: "journal", href: `${base}/journal`, label: m.journalTitle },
      ]}
    />
  );
}
