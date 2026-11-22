import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Gift, ListChecks, Lock, Pencil, ShoppingBasket, Sparkles, Trash2, Users } from "lucide-react";
import { addPartyChecklist, deleteParty, deletePartyGuest, deletePartyItem, partyToShopping, setGuestRsvp, toggleThankYou, togglePartyItem } from "@/app/actions/parties";
import { ActionButton, CheckCircle, DeleteButton } from "@/components/forms/inline";
import { GuestModal, PartyItemModal, PartyModal } from "@/components/parties/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/display";
import { canChangeItem, getViewer } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { getParty, RSVP_LABEL } from "@/lib/parties";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { countdownText } from "@/lib/trips";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Party" };

const usd = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const KIND: Record<string, string> = { birthday: "Birthday party", shower: "Shower", graduation: "Graduation", holiday: "Holiday party", other: "Celebration" };
const VIS: Record<string, string> = { private: "Only me", parents: "Parents & me" };
const RSVP_TONE: Record<string, "olive" | "wine" | "mist" | "primary"> = { yes: "olive", no: "wine", maybe: "primary", invited: "mist", not_sent: "mist" };

const editBtn = "inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const party = await getParty(viewer, id);
  if (!party) notFound();
  const { p, guests, items } = party;
  const today = todayIn(viewer.family.timezone);
  const [members, access] = await Promise.all([memberOptions(viewer), getRecordAccess("party", [p.id])]);
  const shared = access.get(p.id) ?? [];
  const canChange = viewer.can("parties", "use") && canChangeItem(viewer, p.createdByMemberId);
  const photo = fileUrl(p.imageFileId);
  const nameOf = (mid: string | null) => members.find((m) => m.id === mid)?.displayName;

  const of = (k: string) => items.filter((i) => i.kind === k);
  const todos = of("todo");
  const todosDone = todos.filter((t) => t.done).length;
  const coming = guests.filter((g) => g.rsvp === "yes");
  const headcount = coming.reduce((n, g) => n + g.adults + g.kids, 0);
  const kids = coming.reduce((n, g) => n + g.kids, 0);
  const waiting = guests.filter((g) => g.rsvp === "invited" || g.rsvp === "maybe").length;
  const spent = items.reduce((n, i) => n + (i.costCents ?? 0), 0);
  const unbought = items.filter((i) => ["food", "decor", "supply"].includes(i.kind) && !i.done).length;
  const gifts = guests.filter((g) => g.gift);
  const schedule = [...of("schedule")].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  const itemRow = (i: (typeof items)[number], opts: { check?: boolean; meta?: ReactNode } = {}) => (
    <li key={i.id} className="flex items-center gap-3 py-2.5">
      {opts.check !== false && <CheckCircle action={togglePartyItem} id={i.id} done={i.done} label={i.title} size="sm" disabled={!canChange} />}
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", i.done && opts.check !== false && "text-muted line-through")}>{i.title}</p>
        {(opts.meta || i.notes) && <p className="text-sm text-muted">{[opts.meta, i.notes].filter(Boolean).map((x, n) => <span key={n}>{n ? " · " : ""}{x}</span>)}</p>}
      </div>
      {canChange && (
        <span className="flex shrink-0 items-center">
          <PartyItemModal partyId={p.id} kind={i.kind} members={members} item={i} triggerContent={<Pencil className="size-4" />} triggerClassName={editBtn} />
          <DeleteButton action={deletePartyItem} fields={{ id: i.id }} what={i.title} className="size-8" />
        </span>
      )}
    </li>
  );

  const section = (k: string, title: string, empty: string, meta: (i: (typeof items)[number]) => ReactNode, check = true) => (
    <Card>
      <CardHeader title={title} action={canChange ? <PartyItemModal partyId={p.id} kind={k} members={members} /> : undefined} />
      {of(k).length ? <ul className="divide-y divide-line">{of(k).map((i) => itemRow(i, { check, meta: meta(i) }))}</ul> : <p className="text-sm text-muted">{empty}</p>}
    </Card>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/parties" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Party plans
      </Link>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-48 w-full rounded-[var(--radius-card)] object-cover sm:h-64" />
      )}
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {KIND[p.kind] ?? "Party"}
            {p.theme && <span className="text-muted">· {p.theme} theme</span>}
            {p.visibility !== "family" && (
              <span className="inline-flex items-center gap-1 text-muted">
                {p.visibility === "selected" ? <Users className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
                {p.visibility === "selected" ? `${shared.length} ${shared.length === 1 ? "person" : "people"}` : VIS[p.visibility]}
              </span>
            )}
          </span>
        }
        title={p.title}
        description={[p.date && formatShortDate(p.date), p.startTime && `${fmtTime(p.startTime)}${p.endTime ? ` – ${fmtTime(p.endTime)}` : ""}`, p.venue, p.address].filter(Boolean).join(" · ") || undefined}
        actions={
          canChange ? (
            <>
              <PartyModal
                members={members}
                item={{ ...p, shared, imageUrl: photo }}
                triggerContent={
                  <>
                    <Pencil className="size-4" /> Edit
                  </>
                }
                triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
              />
              <ActionButton action={deleteParty} fields={{ id: p.id }} confirm={`Delete "${p.title}" and everything in it?`} label="Delete party" className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500">
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">Countdown</p>
          <p className="text-xl font-semibold">{countdownText(today, p.date, p.date)}</p>
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">Coming</p>
          <p className="text-xl font-semibold">{headcount}</p>
          <p className="text-xs text-muted">
            {kids ? `${kids} kids · ` : ""}
            {waiting} waiting{p.rsvpBy ? ` · RSVP by ${formatShortDate(p.rsvpBy)}` : ""}
          </p>
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">Checklist</p>
          <p className="text-xl font-semibold">
            {todosDone} of {todos.length}
          </p>
          {todos.length > 0 && <ProgressBar value={todosDone} max={todos.length} label="Checklist done" />}
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">Spent</p>
          <p className={cn("text-xl font-semibold", p.budgetCents && spent > p.budgetCents && "text-wine-500")}>{usd(spent)}</p>
          {p.budgetCents ? <p className="text-xs text-muted">of {usd(p.budgetCents)} budget</p> : null}
        </Card>
      </div>

      {p.description && (
        <Card>
          <p className="whitespace-pre-line text-ink-soft">{p.description}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Checklist"
            action={
              canChange ? (
                <span className="flex flex-wrap gap-2">
                  {!todos.length && (
                    <ActionButton action={addPartyChecklist} fields={{ id: p.id }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary-700 ring-1 ring-line hover:bg-sunken">
                      <ListChecks className="size-4" /> Starter checklist
                    </ActionButton>
                  )}
                  <PartyItemModal partyId={p.id} kind="todo" members={members} />
                </span>
              ) : undefined
            }
          />
          {todos.length ? (
            <ul className="divide-y divide-line">
              {todos.map((t) =>
                itemRow(t, {
                  meta: (
                    <>
                      {t.date && <span className={cn(!t.done && t.date < today && "font-medium text-wine-500")}>{t.date < today && !t.done ? "Overdue · " : "Due "}{formatShortDate(t.date)}</span>}
                      {t.assignedMemberId && <span>{t.date ? " · " : ""}{nameOf(t.assignedMemberId)}</span>}
                    </>
                  ),
                }),
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted">Add to-dos, or start with the ready-made party checklist.</p>
          )}
        </Card>

        <Card>
          <CardHeader title={`Guests (${guests.length})`} action={canChange ? <GuestModal partyId={p.id} /> : undefined} />
          {guests.length ? (
            <ul className="divide-y divide-line">
              {guests.map((g) => (
                <li key={g.id} className="flex flex-col gap-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-muted">{[`${g.adults} adult${g.adults === 1 ? "" : "s"}${g.kids ? `, ${g.kids} kid${g.kids === 1 ? "" : "s"}` : ""}`, g.contact, g.notes].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Badge tone={RSVP_TONE[g.rsvp]}>{RSVP_LABEL[g.rsvp]}</Badge>
                    {canChange && (
                      <span className="flex shrink-0 items-center">
                        <GuestModal partyId={p.id} item={g} triggerContent={<Pencil className="size-4" />} triggerClassName={editBtn} />
                        <DeleteButton action={deletePartyGuest} fields={{ id: g.id }} what={g.name} className="size-8" />
                      </span>
                    )}
                  </div>
                  {canChange && g.rsvp !== "yes" && g.rsvp !== "no" && (
                    <div className="flex flex-wrap gap-1.5">
                      {(["yes", "maybe", "no"] as const)
                        .filter((r) => r !== g.rsvp)
                        .map((r) => (
                          <ActionButton key={r} action={setGuestRsvp} fields={{ id: g.id, rsvp: r }} className="h-8 rounded-full px-3 text-sm ring-1 ring-line hover:bg-sunken">
                            {RSVP_LABEL[r]}
                          </ActionButton>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Add the guest list, then mark who&apos;s coming as RSVPs come in.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {section("food", "Food & drinks", "Cake, pizza, snacks, drinks…", (i) => [i.quantity, i.costCents ? usd(i.costCents) : null].filter(Boolean).join(" · "))}
        {section("decor", "Decorations", "Balloons, banners, tablecloths…", (i) => [i.quantity, i.costCents ? usd(i.costCents) : null].filter(Boolean).join(" · "))}
        {section("supply", "Supplies & favors", "Plates, cups, candles, goodie bags…", (i) => [i.quantity, i.costCents ? usd(i.costCents) : null].filter(Boolean).join(" · "))}
        {section("activity", "Games & activities", "Piñata, crafts, a bounce house…", (i) => nameOf(i.assignedMemberId), false)}
      </div>
      {canChange && unbought > 0 && viewer.can("shopping", "add") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive-100 bg-olive-50 px-4 py-3">
          <p className="flex items-center gap-2 text-[15px] text-olive-700">
            <ShoppingBasket className="size-4" /> {unbought} thing{unbought === 1 ? "" : "s"} still to buy.
          </p>
          <ActionButton action={partyToShopping} fields={{ id: p.id }} className="h-9 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-sunken">
            Add to shopping list
          </ActionButton>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Party schedule" action={canChange ? <PartyItemModal partyId={p.id} kind="schedule" members={members} /> : undefined} />
          {schedule.length ? (
            <ul className="divide-y divide-line">
              {schedule.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-primary-700">{i.time ? fmtTime(i.time) : "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.title}</p>
                    {i.notes && <p className="text-sm text-muted">{i.notes}</p>}
                  </div>
                  {canChange && (
                    <span className="flex shrink-0 items-center">
                      <PartyItemModal partyId={p.id} kind="schedule" members={members} item={i} triggerContent={<Pencil className="size-4" />} triggerClassName={editBtn} />
                      <DeleteButton action={deletePartyItem} fields={{ id: i.id }} what={i.title} className="size-8" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Plan the day: guests arrive, games, food, cake & candles, presents.</p>
          )}
        </Card>
        {section("expense", "Other expenses", "Venue, entertainment, invitations…", (i) => [i.costCents ? usd(i.costCents) : null, i.date ? formatShortDate(i.date) : null].filter(Boolean).join(" · "), false)}
      </div>

      <Card>
        <CardHeader title="Gifts & thank-you notes" />
        {gifts.length ? (
          <ul className="divide-y divide-line">
            {gifts.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5">
                <CheckCircle action={toggleThankYou} id={g.id} done={g.thankYouSent} label={`Thank-you sent to ${g.name}`} size="sm" disabled={!canChange} />
                <Gift className="size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{g.gift}</p>
                  <p className="text-sm text-muted">
                    From {g.name}
                    {g.thankYouSent ? " · Thank-you sent" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-4" /> After the party, edit a guest to note their gift, then tick it off when the thank-you note is sent.
          </p>
        )}
      </Card>
    </div>
  );
}
