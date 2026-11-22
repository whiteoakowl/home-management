import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BedDouble,
  Car,
  ExternalLink,
  Images,
  Lock,
  MapPin,
  NotebookPen,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  Receipt,
  Ticket,
  Trash2,
  Users,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { entityPhotos, photoAlbums, planExpenses } from "@/db/schema";
import { FormModal } from "@/components/forms/action-form";
import {
  DateField,
  FormRow,
  SelectField,
  TextField,
} from "@/components/forms/fields";
import { MediaTile } from "@/components/memories/media";
import { albumVisible } from "@/lib/memories";
import {
  deletePlan,
  deletePlanExpense,
  deletePlanItem,
  openTripAlbum,
  savePlanExpense,
} from "@/app/actions/trips";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { PlanItemModal, PlanModal } from "@/components/plans/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader, ProgressBar } from "@/components/ui/display";
import { canChangeItem, getViewer } from "@/lib/dal";
import { fmtTime } from "@/lib/dance";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { listGoals } from "@/lib/goals";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";
import { countdownText, daysUntil, getPlan } from "@/lib/trips";

export const metadata: Metadata = { title: "Plan" };

const usd = (c: number) =>
  `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const VIS: Record<string, string> = {
  private: "Only me",
  parents: "Parents & me",
  selected: "Selected people",
};
const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function PlanPage({ params }: PageProps<"/plans/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  const plan = await getPlan(viewer, id);
  if (!plan) notFound();
  const { p, goal, items } = plan;
  const today = todayIn(viewer.family.timezone);
  const canChange =
    viewer.can("plans", "use") && canChangeItem(viewer, p.createdByMemberId);
  const [members, goals, access, expenses, [album]] = await Promise.all([
    memberOptions(viewer),
    canChange ? listGoals(viewer, { kind: "savings" }) : [],
    getRecordAccess("plan", [p.id]),
    db
      .select()
      .from(planExpenses)
      .where(eq(planExpenses.planId, p.id))
      .orderBy(desc(planExpenses.date), desc(planExpenses.createdAt)),
    db
      .select()
      .from(photoAlbums)
      .where(and(eq(photoAlbums.planId, p.id), albumVisible(viewer)))
      .limit(1),
  ]);
  const albumPhotos = album
    ? await db
        .select({
          id: entityPhotos.id,
          fileId: entityPhotos.fileId,
          mediaType: entityPhotos.mediaType,
        })
        .from(entityPhotos)
        .where(
          and(
            eq(entityPhotos.entityType, "album"),
            eq(entityPhotos.entityId, album.id),
          ),
        )
        .orderBy(desc(entityPhotos.createdAt))
        .limit(8)
    : [];
  const spent = expenses.reduce((s, e) => s + e.amountCents, 0);
  const shared = access.get(p.id) ?? [];
  const photo = fileUrl(p.imageFileId);
  const left = p.startDate ? daysUntil(today, p.startDate) : null;
  const total = items.reduce((s, i) => s + (i.costCents ?? 0), 0);
  const going = members.filter((m) => p.memberIds.includes(m.id));

  const byKind = (k: string) => items.filter((i) => i.kind === k);
  const itinerary = byKind("itinerary");
  // Itinerary grouped by day across the trip (plus anything without a date).
  const days: string[] = [];
  if (p.startDate)
    for (
      let d = p.startDate;
      d <= (p.endDate ?? p.startDate) && days.length < 60;
      d = addDays(d, 1)
    )
      days.push(d);
  for (const i of itinerary)
    if (i.date && !days.includes(i.date)) days.push(i.date);
  days.sort();
  const undated = itinerary.filter((i) => !i.date);

  const itemRow = (i: (typeof items)[number]) => (
    <li key={i.id} className="flex items-start gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {i.title}
          {i.provider && i.provider !== i.title && (
            <span className="font-normal text-muted"> · {i.provider}</span>
          )}
        </p>
        <p className="text-sm text-muted">
          {[
            i.date &&
              `${i.kind === "hotel" ? "In " : i.kind === "vehicle" ? "Pick up " : ""}${formatShortDate(i.date)}${i.startTime ? ` ${fmtTime(i.startTime)}` : ""}`,
            (i.endDate || i.endTime) &&
              `${i.kind === "hotel" ? "out " : i.kind === "vehicle" ? "drop off " : i.kind === "flight" ? "arrives " : "until "}${i.endDate ? formatShortDate(i.endDate) : ""}${i.endTime ? ` ${fmtTime(i.endTime)}` : ""}`,
            i.costCents != null && usd(i.costCents),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {i.location && (
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {i.location}
          </p>
        )}
        {(i.confirmation || i.phone || i.link) && (
          <p className="flex flex-wrap items-center gap-x-3 text-sm">
            {i.confirmation && (
              <span>
                <span className="text-muted">Conf.</span>{" "}
                <strong className="font-mono">{i.confirmation}</strong>
              </span>
            )}
            {i.phone && (
              <a
                href={`tel:${i.phone}`}
                className="text-primary-700 hover:underline"
              >
                {i.phone}
              </a>
            )}
            {i.link && (
              <a
                href={i.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden /> Link
              </a>
            )}
          </p>
        )}
        {i.notes && (
          <p className="mt-0.5 text-sm whitespace-pre-line text-ink-soft">
            {i.notes}
          </p>
        )}
      </div>
      {canChange && (
        <span className="flex shrink-0">
          <PlanItemModal planId={p.id} item={{ ...i }} />
          <DeleteButton
            action={deletePlanItem}
            fields={{ id: i.id }}
            what={i.title}
            className="size-9"
          />
        </span>
      )}
    </li>
  );

  const section = (
    k: "flight" | "hotel" | "vehicle" | "reservation" | "note",
    title: string,
    icon: React.ReactNode,
    empty: string,
  ) => {
    const list = byKind(k);
    if (!list.length && !canChange) return null;
    return (
      <Card>
        <CardHeader
          title={title}
          icon={icon}
          action={
            canChange ? (
              <PlanItemModal planId={p.id} defaultKind={k} triggerLabel="Add" />
            ) : undefined
          }
        />
        {list.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {list.map(itemRow)}
          </ul>
        ) : (
          <p className="text-sm text-muted">{empty}</p>
        )}
      </Card>
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link
        href="/plans"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Travel
      </Link>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-48 w-full rounded-[var(--radius-card)] object-cover sm:h-64"
        />
      )}
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2 capitalize">
            {p.kind}
            {p.visibility !== "family" && (
              <span className="inline-flex items-center gap-1 text-muted normal-case">
                {p.visibility === "selected" ? (
                  <Users className="size-3.5" aria-hidden />
                ) : (
                  <Lock className="size-3.5" aria-hidden />
                )}
                {p.visibility === "selected"
                  ? `${shared.length} ${shared.length === 1 ? "person" : "people"}`
                  : VIS[p.visibility]}
              </span>
            )}
          </span>
        }
        title={p.title}
        description={
          [
            p.destination,
            p.startDate &&
              `${formatShortDate(p.startDate)}${p.endDate && p.endDate !== p.startDate ? ` – ${formatShortDate(p.endDate)}` : ""}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          canChange ? (
            <>
              <PlanModal
                members={members}
                goals={goals
                  .filter(
                    (g) =>
                      g.g.status === "active" || g.g.id === p.savingsGoalId,
                  )
                  .map((g) => ({ id: g.g.id, name: g.g.name }))}
                item={{
                  id: p.id,
                  title: p.title,
                  kind: p.kind,
                  destination: p.destination,
                  description: p.description,
                  startDate: p.startDate,
                  endDate: p.endDate,
                  memberIds: p.memberIds,
                  savingsGoalId: p.savingsGoalId,
                  budgetCents: p.budgetCents,
                  visibility: p.visibility,
                  shared,
                  imageUrl: photo,
                }}
                triggerContent={
                  <>
                    <Pencil className="size-4" /> Edit
                  </>
                }
                triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-sunken"
              />
              <ActionButton
                action={deletePlan}
                fields={{ id: p.id }}
                confirm={`Delete "${p.title}" and everything in it?`}
                label="Delete plan"
                className="size-9 rounded-lg text-muted hover:bg-wine-50 hover:text-wine-500"
              >
                <Trash2 className="size-4" />
              </ActionButton>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">Countdown</p>
          <p className="font-display text-3xl font-semibold">
            {left !== null && left > 1
              ? left
              : countdownText(today, p.startDate, p.endDate)}
          </p>
          {left !== null && left > 1 && (
            <p className="text-sm text-muted">days to go</p>
          )}
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-sm text-muted">
            Booked{spent ? " + spent" : " so far"}
          </p>
          <p className="font-display text-3xl font-semibold tabular-nums">
            {usd(total + spent)}
          </p>
          {p.budgetCents != null && (
            <p
              className={
                total + spent > p.budgetCents
                  ? "text-sm font-medium text-wine-700"
                  : "text-sm text-muted"
              }
            >
              of {usd(p.budgetCents)} budget
            </p>
          )}
        </Card>
        <Card className="flex flex-col justify-center gap-1.5">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <PiggyBank className="size-4" aria-hidden /> Savings goal
          </p>
          {goal && goal.targetCents ? (
            <>
              <Link
                href={`/goals/${goal.id}`}
                className="font-semibold hover:underline"
              >
                {goal.name}
              </Link>
              <ProgressBar
                value={goal.currentCents}
                max={goal.targetCents}
                label={`${goal.name} saved`}
              />
              <p className="text-sm text-muted">
                {usd(goal.currentCents)} of {usd(goal.targetCents)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              {canChange
                ? "Link a savings goal with Edit."
                : "No savings goal linked."}
            </p>
          )}
        </Card>
      </div>

      {(p.description || going.length > 0) && (
        <Card>
          {p.description && (
            <p className="text-[15px] whitespace-pre-line text-ink-soft">
              {p.description}
            </p>
          )}
          {going.length > 0 && (
            <div
              className={
                p.description
                  ? "mt-3 flex flex-wrap items-center gap-2"
                  : "flex flex-wrap items-center gap-2"
              }
            >
              <span className="text-sm text-muted">Going:</span>
              {going.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 text-sm"
                >
                  <Avatar name={m.displayName} color={m.color} size="xs" />{" "}
                  {m.displayName.split(" ")[0]}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Itinerary"
            icon={<MapPin className="size-4" />}
            action={
              canChange ? (
                <PlanItemModal
                  planId={p.id}
                  defaultDate={p.startDate}
                  triggerLabel="Add"
                />
              ) : undefined
            }
          />
          {itinerary.length === 0 && !days.length ? (
            <p className="text-sm text-muted">
              Set the dates and add what you&apos;re doing each day.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {days.map((d) => {
                const list = itinerary.filter((i) => i.date === d);
                const travel = items.filter(
                  (i) =>
                    i.kind !== "itinerary" &&
                    i.kind !== "note" &&
                    (i.date === d || i.endDate === d),
                );
                return (
                  <li key={d}>
                    <h3 className="border-b border-line pb-1 font-sans text-sm font-semibold">
                      {dayLabel(d)}
                    </h3>
                    {travel.map((t) => (
                      <p
                        key={t.id}
                        className="mt-1.5 flex items-center gap-1.5 text-sm text-muted"
                      >
                        {t.kind === "flight" ? (
                          <Plane className="size-3.5" />
                        ) : t.kind === "hotel" ? (
                          <BedDouble className="size-3.5" />
                        ) : t.kind === "reservation" ? (
                          <Ticket className="size-3.5" />
                        ) : (
                          <Car className="size-3.5" />
                        )}
                        {t.title}
                        {t.date === d && t.startTime
                          ? ` · ${fmtTime(t.startTime)}`
                          : t.endDate === d && t.endTime
                            ? ` · ${fmtTime(t.endTime)}`
                            : ""}
                        {t.kind === "hotel"
                          ? t.date === d
                            ? " (check in)"
                            : " (check out)"
                          : ""}
                      </p>
                    ))}
                    {list.length ? (
                      <ul className="flex flex-col divide-y divide-line">
                        {list.map(itemRow)}
                      </ul>
                    ) : (
                      !travel.length && (
                        <p className="mt-1.5 text-sm text-muted">Free day</p>
                      )
                    )}
                  </li>
                );
              })}
              {undated.length > 0 && (
                <li>
                  <h3 className="border-b border-line pb-1 font-sans text-sm font-semibold">
                    Anytime
                  </h3>
                  <ul className="flex flex-col divide-y divide-line">
                    {undated.map(itemRow)}
                  </ul>
                </li>
              )}
            </ol>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          {section(
            "flight",
            "Flights",
            <Plane className="size-4" />,
            "Add flights with times, airline and confirmation number.",
          )}
          {section(
            "hotel",
            "Where we're staying",
            <BedDouble className="size-4" />,
            "Hotels, rentals and campsites with check in / out.",
          )}
          {section(
            "reservation",
            "Reservations",
            <Ticket className="size-4" />,
            "Dinner reservations, park tickets, tours and shows, with confirmation numbers.",
          )}
          {section(
            "vehicle",
            "Vehicles",
            <Car className="size-4" />,
            "Rental cars, the family car, shuttles…",
          )}
          {section(
            "note",
            "Notes",
            <NotebookPen className="size-4" />,
            "Packing lists, ideas, things to remember.",
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Trip photos"
            icon={<Images className="size-4" />}
            action={
              viewer.can("photos") ? (
                <ActionButton
                  action={openTripAlbum}
                  fields={{ planId: p.id }}
                  className="h-9 rounded-full px-3 text-sm font-medium text-primary-700 hover:bg-primary-50"
                >
                  {album ? "Open album" : "Start the album"}
                </ActionButton>
              ) : undefined
            }
          />
          {albumPhotos.length ? (
            <ul className="grid grid-cols-4 gap-1.5">
              {albumPhotos.map((x) => (
                <li
                  key={x.id}
                  className="aspect-square overflow-hidden rounded-lg bg-sunken"
                >
                  <Link href={`/photos/${album!.id}/${x.id}`}>
                    <MediaTile
                      fileId={x.fileId}
                      mediaType={x.mediaType}
                      alt=""
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {album
                ? "No photos yet. Everyone going can add theirs."
                : "One shared album for the trip, so everyone's photos end up in one place."}
            </p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Expenses"
            icon={<Receipt className="size-4" />}
            action={
              canChange ? (
                <FormModal
                  title="Add an expense"
                  triggerLabel="Add"
                  triggerIcon={<Plus className="size-4" />}
                  triggerVariant="soft"
                  triggerSize="sm"
                  action={savePlanExpense}
                  size="sm"
                >
                  <input type="hidden" name="planId" value={p.id} />
                  <FormRow>
                    <TextField
                      name="title"
                      label="What"
                      required
                      maxLength={120}
                      placeholder="Park tickets"
                    />
                    <TextField
                      name="amount"
                      label="Amount ($)"
                      required
                      inputMode="decimal"
                    />
                  </FormRow>
                  <FormRow>
                    <SelectField
                      name="category"
                      label="Type"
                      defaultValue="other"
                      options={EXPENSE_CATS}
                    />
                    <DateField
                      name="date"
                      label="Date"
                      defaultValue={
                        today >= (p.startDate ?? today) &&
                        today <= (p.endDate ?? today)
                          ? today
                          : (p.startDate ?? today)
                      }
                    />
                  </FormRow>
                  <SelectField
                    name="paidBy"
                    label="Paid by"
                    defaultValue={viewer.member.id}
                    placeholder="—"
                    options={members.map((m) => ({
                      value: m.id,
                      label: m.displayName,
                    }))}
                  />
                </FormModal>
              ) : undefined
            }
          />
          {expenses.length ? (
            <>
              <ul className="flex flex-col divide-y divide-line text-sm">
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {e.title}
                      </span>
                      <span className="text-xs text-muted">
                        {[
                          EXPENSE_CATS.find((c) => c.value === e.category)
                            ?.label,
                          e.date && formatShortDate(e.date),
                          members
                            .find((m) => m.id === e.paidByMemberId)
                            ?.displayName.split(" ")[0],
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {usd(e.amountCents)}
                    </span>
                    {canChange && (
                      <DeleteButton
                        action={deletePlanExpense}
                        fields={{ id: e.id }}
                        what={e.title}
                        className="size-8"
                      />
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold">
                <span>Spent on the trip</span>{" "}
                <span className="tabular-nums">{usd(spent)}</span>
              </p>
              {EXPENSE_CATS.filter((c) =>
                expenses.some((e) => e.category === c.value),
              ).length > 1 && (
                <p className="mt-1 text-xs text-muted">
                  {EXPENSE_CATS.filter((c) =>
                    expenses.some((e) => e.category === c.value),
                  )
                    .map(
                      (c) =>
                        `${c.label} ${usd(expenses.filter((e) => e.category === c.value).reduce((s, e) => s + e.amountCents, 0))}`,
                    )
                    .join(" · ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              Track what you spend on food, tickets and souvenirs, next to what
              you booked.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

const EXPENSE_CATS = [
  { value: "lodging", label: "Lodging" },
  { value: "food", label: "Food" },
  { value: "tickets", label: "Tickets" },
  { value: "travel", label: "Travel" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
];
