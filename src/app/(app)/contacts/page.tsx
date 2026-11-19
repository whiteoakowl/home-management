import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import { Cake, Contact as ContactIcon, Mail, MapPin, MessageSquare, Phone, Star } from "lucide-react";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { deleteContact, toggleFavoriteContact } from "@/app/actions/hub";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { ContactModal } from "@/components/hub/forms";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { formatShortDate, todayIn } from "@/lib/dates";
import { CONTACT_CATEGORIES, CONTACT_LABEL, nextBirthday } from "@/lib/hub";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

const tel = (p: string) => p.replace(/[^\d+]/g, "");

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const viewer = await getViewer();
  if (!viewer.can("contacts")) notFound();
  const sp = await searchParams;
  const group = typeof sp.group === "string" && (CONTACT_CATEGORIES as readonly string[]).includes(sp.group) ? sp.group : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const today = todayIn(viewer.family.timezone);
  const canUse = viewer.can("contacts", "use");
  const canAll = viewer.can("contacts", "edit");

  const all = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.familyId, viewer.family.id), or(eq(contacts.private, false), eq(contacts.createdByMemberId, viewer.member.id))))
    .orderBy(asc(contacts.name));
  const used = CONTACT_CATEGORIES.filter((c) => all.some((x) => x.category === c));
  const shown = all
    .filter((c) => !group || c.category === group)
    .filter((c) => !q || [c.name, c.relationship, c.phone, c.email, c.notes].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const birthdays = all
    .filter((c) => c.birthday)
    .map((c) => ({ c, next: nextBirthday(c.birthday!, today) }))
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 5);

  return (
    <>
      <PageHeader eyebrow="Household" title="Contacts" description="The family address book. Tap a number to call or text. Birthdays show on the family calendar." actions={canUse ? <ContactModal defaultCategory={group || undefined} /> : undefined} />
      {all.length === 0 ? (
        <Card>
          <EmptyState icon={<ContactIcon />} title="Start your family address book" description="Add babysitters, teachers, doctors, neighbors and relatives so everyone has the numbers they need." example="Ms. Garcia · 2nd grade teacher · (555) 123-4567" action={canUse ? <ContactModal /> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-4">
            <form className="flex gap-2" role="search">
              {group && <input type="hidden" name="group" value={group} />}
              <input name="q" defaultValue={q} placeholder="Search contacts…" aria-label="Search contacts" className="h-11 flex-1 rounded-full border border-line bg-surface px-4 outline-none focus:border-primary-400" />
            </form>
            {used.length > 1 && (
              <div className="overflow-x-auto">
                <SegmentLinks active={group || "all"} items={[{ key: "all", href: "/contacts", label: "All" }, ...used.map((c) => ({ key: c, href: `/contacts?group=${c}`, label: CONTACT_LABEL[c]!.split(" ")[0]! }))]} />
              </div>
            )}
            {shown.length === 0 && <p className="text-sm text-muted">No contacts match.</p>}
            <ul className="grid gap-3 sm:grid-cols-2">
              {shown.map((c) => {
                const mine = c.createdByMemberId === viewer.member.id;
                const canChange = canUse && (mine || canAll);
                return (
                  <li key={c.id}>
                    <Card className="flex h-full flex-col gap-2 p-4">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-sm text-muted">{c.relationship ?? CONTACT_LABEL[c.category]}</p>
                        </div>
                        {canUse && (
                          <ActionButton action={toggleFavoriteContact} fields={{ id: c.id }} label={c.favorite ? "Remove from favorites" : "Add to favorites"} className="size-9 rounded-full hover:bg-sunken">
                            <Star className={cn("size-4", c.favorite ? "fill-amber-400 text-amber-500" : "text-muted")} />
                          </ActionButton>
                        )}
                        {canChange && (
                          <ContactModal
                            item={{ id: c.id, name: c.name, category: c.category, relationship: c.relationship, phone: c.phone, altPhone: c.altPhone, email: c.email, address: c.address, birthday: c.birthday, notes: c.notes, favorite: c.favorite, private: c.private, mine }}
                          />
                        )}
                        {canChange && <DeleteButton action={deleteContact} fields={{ id: c.id }} what={c.name} />}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.private && <Badge tone="mist">Only me</Badge>}
                        <Badge>{CONTACT_LABEL[c.category]}</Badge>
                      </div>
                      <div className="flex flex-col gap-1 text-sm">
                        {[c.phone, c.altPhone].filter(Boolean).map((p) => (
                          <span key={p} className="flex items-center gap-2">
                            <a href={`tel:${tel(p!)}`} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
                              <Phone className="size-3.5" aria-hidden /> {p}
                            </a>
                            <a href={`sms:${tel(p!)}`} aria-label={`Text ${c.name}`} className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-sunken">
                              <MessageSquare className="size-3.5" />
                            </a>
                          </span>
                        ))}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-primary-700 hover:underline [overflow-wrap:anywhere]">
                            <Mail className="size-3.5 shrink-0" aria-hidden /> {c.email}
                          </a>
                        )}
                        {c.address && (
                          <a href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-ink-soft hover:underline">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span className="whitespace-pre-line">{c.address}</span>
                          </a>
                        )}
                        {c.birthday && (
                          <span className="inline-flex items-center gap-1.5 text-muted">
                            <Cake className="size-3.5" aria-hidden /> {formatShortDate(c.birthday)}
                          </span>
                        )}
                        {c.notes && <p className="mt-1 whitespace-pre-line text-muted">{c.notes}</p>}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
          {birthdays.length > 0 && (
            <div>
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <Cake className="size-4 text-primary-600" /> Upcoming birthdays
                </h2>
                <ul className="flex flex-col divide-y divide-line">
                  {birthdays.map(({ c, next }) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted">{next === today ? "Today! 🎉" : formatShortDate(next)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
