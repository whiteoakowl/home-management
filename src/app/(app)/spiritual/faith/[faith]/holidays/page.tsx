import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CalendarPlus, Pencil, Undo2 } from "lucide-react";
import { deleteFaithHoliday, saveFaithHoliday } from "@/app/actions/faith";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { FaithSubTabs } from "@/components/faith/tabs";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { daysBetween, todayIn } from "@/lib/dates";
import { familyHolidays } from "@/lib/faith";
import { FAITH_META, isFaith, type Faith } from "@/lib/faith-config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Holidays" };

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
const NOTES: Partial<Record<Faith, string>> = {
  jewish: "Jewish holidays begin at sundown the evening before the date shown. Dates follow the Hebrew calendar; Passover and Shavuot are shown as kept outside Israel (8 and 2 days).",
  hindu: "Festival dates follow the common North Indian (amanta/purnimanta) reckoning in Indian time. Your temple or region may keep a day earlier or later; tap the pencil to change a date for your family.",
  buddhist: "Theravada full-moon days follow the Sri Lankan/Indian lunar calendar, Mahayana days the Chinese lunar calendar. Countries can differ by a day; tap the pencil to change a date for your family.",
  christian: "Western church dates, with Orthodox Christmas and Easter (Pascha) shown too.",
  catholic: "The General Roman Calendar. Some feasts (Epiphany, Ascension, Corpus Christi) move to Sunday in many US dioceses, so check your parish; tap the pencil to change a date for your family.",
};

export default async function FaithHolidays({ params, searchParams }: PageProps<"/spiritual/faith/[faith]/holidays">) {
  const { faith: raw } = await params;
  if (!isFaith(raw)) redirect("/spiritual");
  if (raw === "spiritual") redirect("/spiritual/wheel");
  const faith: Faith = raw;
  const viewer = await getViewer();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const thisYear = Number(today.slice(0, 4));
  const yr = Number(sp.year);
  const year = Number.isInteger(yr) && yr >= thisYear - 5 && yr <= thisYear + 10 ? yr : thisYear;
  const all = await familyHolidays(viewer.family.id, [faith], `${year}-01-01`, `${year}-12-31`);
  const traditions = [...new Set(all.map((h) => h.tradition).filter(Boolean))] as string[];
  const tr = typeof sp.tradition === "string" && traditions.includes(sp.tradition) ? sp.tradition : "";
  const shown = tr ? all.filter((h) => h.tradition === tr || h.custom) : all;
  const months = [...new Set(shown.map((h) => h.date.slice(0, 7)))];
  const base = `/spiritual/faith/${faith}/holidays`;
  const q = (o: { year?: number; tradition?: string }) => {
    const p = new URLSearchParams();
    const y = o.year ?? year;
    if (y !== thisYear) p.set("year", String(y));
    const t = o.tradition ?? tr;
    if (t) p.set("tradition", t);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary-600">
            {FAITH_META[faith].emoji} {FAITH_META[faith].label}
          </p>
          <h1 className="text-[28px] leading-tight font-semibold sm:text-[32px]">
            {tr === "Saints" ? "Saints" : faith === "catholic" ? "Feasts & holy days" : "Holidays"} {year}
          </h1>
        </div>
        <FormModal title="Add a family holiday" triggerLabel="Add a holiday" triggerIcon={<CalendarPlus className="size-4" />} action={saveFaithHoliday} size="sm">
          <input type="hidden" name="faith" value={faith} />
          <FormRow>
            <TextField name="name" label="Name" required maxLength={120} placeholder="Feast of St. Joseph, Grandma's yahrzeit…" />
            <TextField name="emoji" label="Symbol (emoji)" maxLength={8} placeholder="⭐" />
          </FormRow>
          <DateField name="date" label="Date" required defaultValue={today} />
          <CheckboxField name="yearly" label="Every year on this date" defaultChecked />
          <TextAreaField name="notes" label="Notes" rows={2} placeholder="How your family keeps the day" />
        </FormModal>
      </header>
      <FaithSubTabs faith={faith} active={faith === "catholic" && tr === "Saints" ? "saints" : "holidays"} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentLinks active={String(year)} items={[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => ({ key: String(y), href: q({ year: y }), label: String(y) }))} />
        {traditions.length > 1 && <SegmentLinks active={tr || "all"} items={[{ key: "all", href: q({ tradition: "" }), label: "All" }, ...traditions.map((t) => ({ key: t, href: q({ tradition: t }), label: t }))]} />}
      </div>
      {NOTES[faith] && <p className="mb-4 max-w-3xl text-sm text-muted">{NOTES[faith]}</p>}
      <p className="mb-5 text-sm">
        <Link href={`/calendar`} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
          <CalendarDays className="size-4" /> Show these on the family calendar
        </Link>{" "}
        <span className="text-muted">(Calendar → Show → {FAITH_META[faith].label} holidays)</span>
      </p>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays />} title="No holidays" description="Add your family's own days with Add a holiday." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {months.map((m) => (
            <section key={m}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{fmt(`${m}-01`, { month: "long" })}</h2>
              <Card className="p-0">
                <ul className="divide-y divide-line">
                  {shown
                    .filter((h) => h.date.startsWith(m))
                    .map((h) => {
                      const past = (h.endDate ?? h.date) < today;
                      const left = daysBetween(today, h.date);
                      return (
                        <li key={h.key + h.date} className={cn("flex items-start gap-3 px-4 py-3", past && "opacity-60")}>
                          <span className="mt-0.5 text-2xl" aria-hidden>
                            {h.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 font-semibold">
                              {h.name}
                              {h.tradition && <Badge>{h.tradition}</Badge>}
                              {h.custom && <Badge tone="primary">Our family</Badge>}
                              {h.adjusted && <Badge tone="olive">Date changed</Badge>}
                            </p>
                            <p className="text-sm text-ink-soft">{h.about}</p>
                            {h.eve && <p className="text-xs text-muted">Begins at sundown on {fmt(addDay(h.date, -1), { weekday: "long", month: "short", day: "numeric" })}</p>}
                            {h.adjusted && h.notes && <p className="text-xs text-muted">{h.notes}</p>}
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-medium">
                              {fmt(h.date, { weekday: "short", month: "short", day: "numeric" })}
                              {h.endDate && ` – ${fmt(h.endDate, { month: "short", day: "numeric" })}`}
                            </p>
                            <p className="text-xs text-muted">{past ? "Past" : left === 0 ? "Today" : left > 0 ? `in ${left} days` : "Now"}</p>
                            <div className="mt-1 flex justify-end">
                              {h.custom ? (
                                <DeleteButton action={deleteFaithHoliday} fields={{ id: h.id }} what={h.name} />
                              ) : h.adjusted ? (
                                <ActionButton action={deleteFaithHoliday} fields={{ id: h.id }} label="Use the standard date again" className="size-8 rounded-full text-muted hover:bg-sunken">
                                  <Undo2 className="size-4" />
                                </ActionButton>
                              ) : (
                                <FormModal
                                  title={`Change the date of ${h.name}`}
                                  description={`For ${year} only. Use this when your community keeps a different day.`}
                                  triggerContent={<Pencil className="mx-auto size-4" />}
                                  triggerAriaLabel={`Change the date of ${h.name}`}
                                  triggerClassName="size-8 rounded-full text-muted hover:bg-sunken"
                                  action={saveFaithHoliday}
                                  size="sm"
                                >
                                  <input type="hidden" name="faith" value={faith} />
                                  <input type="hidden" name="holidayKey" value={h.key} />
                                  <input type="hidden" name="name" value={h.name} />
                                  <DateField name="date" label="Date" required defaultValue={h.date} />
                                  <TextField name="notes" label="Note (optional)" maxLength={200} placeholder="Our temple's calendar" />
                                </FormModal>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
const addDay = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
