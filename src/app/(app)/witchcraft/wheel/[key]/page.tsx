import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Settings2 } from "lucide-react";
import { saveSabbatSetting } from "@/app/actions/craft";
import { FormModal } from "@/components/forms/action-form";
import { TextAreaField, TextField } from "@/components/forms/fields";
import { CraftCard } from "@/components/craft/craft-parts";
import { CraftTabs } from "@/components/craft/craft-tabs";
import { fmtDate } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/display";
import { db } from "@/db";
import { celebrations, craftItems } from "@/db/schema";
import { craftVisible, familyWheel } from "@/lib/craft";
import { todayIn } from "@/lib/dates";
import { sabbatByKey } from "@/lib/sabbats";
import { CelebrationModal } from "../../celebrations/celebration-modal";
import { craftViewer } from "../../shared";

export async function generateMetadata({ params }: PageProps<"/witchcraft/wheel/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: sabbatByKey(key)?.name ?? "Sabbat" };
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{title}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i} className="rounded-full bg-sunken px-3 py-1 text-sm">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function SabbatPage({ params }: PageProps<"/witchcraft/wheel/[key]">) {
  const { key } = await params;
  const s = sabbatByKey(key);
  if (!s) notFound();
  const viewer = await craftViewer();
  const today = todayIn(viewer.family.timezone);
  const year = Number(today.slice(0, 4));
  const [{ wheel, settings }, next, related, cels] = await Promise.all([
    familyWheel(viewer, year),
    familyWheel(viewer, year + 1),
    db.select().from(craftItems).where(and(craftVisible(viewer), eq(craftItems.sabbat, s.key))).orderBy(asc(craftItems.name)),
    db.select().from(celebrations).where(and(eq(celebrations.familyId, viewer.family.id), eq(celebrations.sabbat, s.key))).orderBy(asc(celebrations.date)),
  ]);
  const thisYear = wheel.find((w) => w.key === s.key)!;
  const date = thisYear.date >= today ? thisYear : next.wheel.find((w) => w.key === s.key)!;
  const setting = settings.find((x) => x.key === s.key);
  const canEdit = viewer.can("witchcraft", "edit");
  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/witchcraft/wheel" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Wheel of the Year
      </Link>
      <CraftTabs active="wheel" />
      <header className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[#2d0f26] via-[#4d1c2b] to-[#6a2d5e] p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="text-6xl" aria-hidden>
            {s.emoji}
          </span>
          <div className="flex-1">
            <p className="text-sm text-[#e8d5e4]">{s.also}</p>
            <h1 className="text-[34px] leading-tight font-semibold text-white">{s.name}</h1>
            <p className="mt-1 text-white/85">
              {fmtDate(date.date)}
              {date.exact && ` · exact ${s.kind === "solar" ? "moment" : ""} ${date.exact.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: viewer.family.timezone })}`}
              {date.overridden && " · your family's date"}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <CelebrationModal defaults={{ name: `${s.name} celebration`, sabbat: s.key, date: date.date, decorations: s.altar.join("\n"), activities: s.family.join("\n") }} />
              <FormModal
                title={`${s.name} settings`}
                action={saveSabbatSetting}
                triggerVariant="secondary"
                triggerIcon={<Settings2 className="size-4" />}
                triggerLabel="Date & notes"
                size="md"
                description="Override the date if your tradition celebrates on a different day (for example Imbolc on Feb 2)."
              >
                <input type="hidden" name="key" value={s.key} />
                <TextField name="monthDay" label="Celebrate on (MM-DD)" defaultValue={setting?.monthDay ?? ""} placeholder="Leave blank for the traditional date" pattern="\d{2}-\d{2}" />
                <TextAreaField name="notes" label="Family notes & traditions" rows={4} defaultValue={setting?.notes ?? ""} />
              </FormModal>
            </div>
          )}
        </div>
      </header>

      {setting?.notes && (
        <Card>
          <CardHeader title="Our family's traditions" />
          <p className="text-sm whitespace-pre-line">{setting.notes}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Meaning" />
          <p className="text-[15px]">{s.meaning}</p>
          <h3 className="mt-4 mb-1 font-semibold">History</h3>
          <p className="text-[15px] text-ink-soft">{s.history}</p>
        </Card>
        <Card className="flex flex-col gap-4">
          <List title="Colors" items={s.colors} />
          <List title="Herbs & plants" items={s.herbs} />
          <List title="Crystals" items={s.crystals} />
          <List title="Foods" items={s.foods} />
        </Card>
        <Card>
          <CardHeader title="Traditions & rituals" />
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {[...s.traditions, ...s.ritualIdeas].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Altar & family activities" />
          <ul className="list-disc space-y-1 pl-5 text-[15px]">
            {s.altar.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px]">
            {s.family.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Celebrations" />
        {cels.length ? (
          <ul className="divide-y divide-line">
            {cels.map((c) => (
              <li key={c.id}>
                <Link href={`/witchcraft/celebrations/${c.id}`} className="flex justify-between py-2.5 hover:text-primary-700">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-muted">
                    {fmtDate(c.date)} {c.date < today && <Badge>Past</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No {s.name} celebrations planned yet.</p>
        )}
      </Card>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Spells, rituals &amp; practices for {s.name}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {related.map((i) => (
              <CraftCard key={i.id} it={i} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
