import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, Car, ClipboardList, FileText, Gauge, Landmark, Package, Trash2, Wrench } from "lucide-react";
import { db } from "@/db";
import { familyMembers, vehicleParts, vehicles, vehicleServices } from "@/db/schema";
import { deleteMileage, deletePart, deleteScheduleItem, deleteService, deleteVehicle } from "@/app/actions/vehicles";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { LoanModal, MileageModal, PartModal, ScheduleModal, ServiceModal, VehicleModal } from "@/components/vehicles/forms";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";
import { cn, formatCents } from "@/lib/utils";
import { vehicleSummary, vehicleTitle } from "@/lib/vehicle-data";
import { monthDayYear } from "@/lib/vehicles";

export const metadata: Metadata = { title: "Vehicle" };

const STATUS = { overdue: { tone: "wine", label: "Overdue" }, soon: { tone: "mist", label: "Due soon" }, ok: { tone: "olive", label: "OK" }, unknown: { tone: "neutral", label: "Set last done" } } as const;

export default async function VehiclePage({ params }: PageProps<"/vehicles/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("vehicles")) notFound();
  const [v] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.familyId, viewer.family.id)));
  if (!v) notFound();
  const today = todayIn(viewer.family.timezone);
  const [summary, services, parts, members] = await Promise.all([
    vehicleSummary(viewer, v, today),
    db.select({ s: vehicleServices, by: familyMembers.displayName }).from(vehicleServices).leftJoin(familyMembers, eq(familyMembers.id, vehicleServices.loggedByMemberId)).where(eq(vehicleServices.vehicleId, v.id)).orderBy(desc(vehicleServices.date), desc(vehicleServices.createdAt)),
    db.select().from(vehicleParts).where(eq(vehicleParts.vehicleId, v.id)).orderBy(vehicleParts.name),
    memberOptions(viewer),
  ]);
  const { currentMiles, rate, due, loan, readings } = summary;
  const canEdit = viewer.can("vehicles", "edit");
  const canUse = viewer.can("vehicles", "use");
  const canBudget = viewer.can("budget", "edit");
  const schedOpts = due.map((d) => ({ id: d.s.id, title: d.s.title }));
  const img = fileUrl(v.imageFileId);
  const driver = members.find((m) => m.id === v.driverMemberId);
  const spent = services.reduce((s, x) => s + (x.s.costCents ?? 0), 0);
  const yearSpent = services.filter((x) => x.s.date.slice(0, 4) === today.slice(0, 4)).reduce((s, x) => s + (x.s.costCents ?? 0), 0);
  const papers = [
    { label: "Registration", date: v.registrationExpiresOn },
    { label: "Insurance renews", date: v.insuranceRenewsOn },
    { label: "Inspection", date: v.inspectionDueOn },
  ].filter((p) => p.date);
  const specs = [
    ["VIN", v.vin],
    ["Plate", v.plate],
    ["Color", v.color],
    ["Oil", v.oilType],
    ["Tires", v.tireSize],
    ["Insurance", [v.insuranceCompany, v.insurancePolicy].filter(Boolean).join(" · ") || null],
    ["Purchased", v.purchaseDate ? `${formatShortDate(v.purchaseDate)}${v.purchasePriceCents ? ` · ${formatCents(v.purchasePriceCents)}` : ""}` : null],
    ["Main driver", driver?.displayName ?? null],
  ].filter(([, val]) => val) as [string, string][];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Vehicles
      </Link>
      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-primary-100 to-mist-50">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={v.nickname} className="aspect-[16/10] w-full object-cover" />
          ) : (
            <span className="flex aspect-[16/10] items-center justify-center text-primary-600/50">
              <Car className="size-20" aria-hidden />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <PageHeader eyebrow={vehicleTitle(v) || "Vehicle"} title={v.nickname} />
          <p className="-mt-4 flex items-center gap-2 text-[17px]">
            <Gauge className="size-5 text-muted" aria-hidden />
            <strong className="font-display text-2xl">{currentMiles != null ? currentMiles.toLocaleString() : "—"}</strong> miles
            {rate ? <span className="text-sm text-muted">· about {Math.round(rate * 30).toLocaleString()} mi/month</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {canUse && <ServiceModal vehicleId={v.id} today={today} schedule={schedOpts} canBudget={canBudget} currentMiles={currentMiles} />}
            {canUse && <MileageModal vehicleId={v.id} today={today} current={currentMiles} />}
            {canEdit && (
              <VehicleModal
                members={members}
                item={{ id: v.id, nickname: v.nickname, year: v.year, make: v.make, model: v.model, trim: v.trim, color: v.color, vin: v.vin, plate: v.plate, driverMemberId: v.driverMemberId, imageUrl: img, purchaseDate: v.purchaseDate, purchasePrice: v.purchasePriceCents ? v.purchasePriceCents / 100 : null, oilType: v.oilType, tireSize: v.tireSize, insuranceCompany: v.insuranceCompany, insurancePolicy: v.insurancePolicy, insuranceRenewsOn: v.insuranceRenewsOn, registrationExpiresOn: v.registrationExpiresOn, inspectionDueOn: v.inspectionDueOn, active: v.active, notes: v.notes }}
              />
            )}
          </div>
          {papers.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {papers.map((p) => (
                <li key={p.label} className={cn("rounded-full px-3 py-1", p.date! < today ? "bg-wine-50 text-wine-700" : p.date! <= addDays(today, 30) ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "bg-sunken text-ink-soft")}>
                  {p.label} {p.date! < today ? "expired" : ""} {formatShortDate(p.date!)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Maintenance due" icon={<ClipboardList className="size-4" />} action={canEdit ? <ScheduleModal vehicleId={v.id} /> : undefined} />
            {currentMiles == null && <p className="mb-2 text-sm text-muted">Add the current mileage to see what&apos;s due by miles.</p>}
            <ul className="flex flex-col divide-y divide-line">
              {due.map(({ s, d }) => (
                <li key={s.id} className="flex items-center gap-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {s.title} <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                    </span>
                    <span className="block text-xs text-muted">
                      Every {[s.everyMiles && `${s.everyMiles.toLocaleString()} mi`, s.everyMonths && `${s.everyMonths} mo`].filter(Boolean).join(" or ")}
                      {s.lastDate ? ` · last ${formatShortDate(s.lastDate)}${s.lastMiles ? ` at ${s.lastMiles.toLocaleString()} mi` : ""}` : " · last done not set"}
                      {d.dueMiles != null ? ` · due at ${d.dueMiles.toLocaleString()} mi` : ""}
                      {d.dueDate ? ` · ~${formatShortDate(d.dueDate)}` : ""}
                      {d.milesLeft != null && d.milesLeft > 0 ? ` (${d.milesLeft.toLocaleString()} mi left)` : ""}
                    </span>
                  </span>
                  {canUse && <ServiceModal vehicleId={v.id} today={today} schedule={schedOpts} canBudget={canBudget} preset={{ scheduleId: s.id, title: s.title }} label="Done" triggerVariant="soft" currentMiles={currentMiles} />}
                  {canEdit && (
                    <>
                      <ScheduleModal vehicleId={v.id} item={{ id: s.id, title: s.title, everyMiles: s.everyMiles, everyMonths: s.everyMonths, lastDate: s.lastDate, lastMiles: s.lastMiles, notes: s.notes }} />
                      <DeleteButton action={deleteScheduleItem} fields={{ id: s.id }} what={s.title} className="size-9" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={`Work & repairs${spent ? ` · ${formatCents(yearSpent)} this year` : ""}`} icon={<Wrench className="size-4" />} />
            {services.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {services.map(({ s, by }) => (
                  <li key={s.id} className="flex items-start gap-2 py-2.5">
                    <span className="w-20 shrink-0 text-sm text-muted">{formatShortDate(s.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{s.title}</span> {s.kind !== "maintenance" && <Badge>{s.kind}</Badge>}
                      <span className="block text-xs text-muted">{[s.miles ? `${s.miles.toLocaleString()} mi` : null, s.shop, by ? `logged by ${by}` : null].filter(Boolean).join(" · ")}</span>
                      {s.parts && <span className="mt-0.5 block text-xs whitespace-pre-line text-ink-soft">Parts: {s.parts}</span>}
                      {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
                      {s.receiptFileId && (
                        <a href={fileUrl(s.receiptFileId)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 underline">
                          <FileText className="size-3" /> Receipt
                        </a>
                      )}
                    </span>
                    {s.costCents ? <span className="text-sm font-semibold tabular-nums">{formatCents(s.costCents)}</span> : null}
                    {(canEdit || s.loggedByMemberId === viewer.member.id) && (
                      <span className="flex">
                        <ServiceModal vehicleId={v.id} today={today} schedule={schedOpts} canBudget={false} item={{ id: s.id, scheduleId: s.scheduleId, date: s.date, miles: s.miles, kind: s.kind, title: s.title, shop: s.shop, parts: s.parts, cost: s.costCents ? s.costCents / 100 : null, notes: s.notes }} />
                        <DeleteButton action={deleteService} fields={{ id: s.id }} what={s.title} className="size-9" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Log oil changes, repairs, inspections and tires: date, mileage, shop, parts and cost.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Loan" icon={<Landmark className="size-4" />} action={canEdit ? <LoanModal vehicleId={v.id} loan={v.loanAmountCents ? { lender: v.loanLender, amount: v.loanAmountCents / 100, apr: v.loanApr ?? 0, payment: (v.loanPaymentCents ?? 0) / 100, startDate: v.loanStartDate ?? "", termMonths: v.loanTermMonths ?? 60 } : undefined} /> : undefined} />
            {loan ? (
              loan.paidOff ? (
                <p className="text-[15px] font-medium text-emerald-700 dark:text-emerald-300">Paid off 🎉</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="font-display text-4xl font-semibold tabular-nums">{loan.paymentsLeft}</p>
                  <p className="-mt-2 text-sm text-muted">payments left · paid off {monthDayYear(loan.payoffDate)}</p>
                  <ProgressBar value={Math.round(loan.progress * 100)} max={100} label="Loan paid off" />
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">Balance (est.)</dt>
                      <dd className="font-semibold">{formatCents(loan.balanceCents)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Monthly</dt>
                      <dd className="font-semibold">{formatCents(v.loanPaymentCents!)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Next payment</dt>
                      <dd className="font-semibold">{loan.nextPaymentDate ? formatShortDate(loan.nextPaymentDate) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Interest left</dt>
                      <dd className="font-semibold">{formatCents(loan.interestLeftCents)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted">
                    {v.loanLender ? `${v.loanLender} · ` : ""}
                    {formatCents(v.loanAmountCents!)} at {v.loanApr ?? 0}% for {v.loanTermMonths} months. Estimates assume on-time payments.
                  </p>
                </div>
              )
            ) : (
              <p className="text-sm text-muted">No loan. Add one to see a payoff countdown.</p>
            )}
          </Card>

          {specs.length > 0 && (
            <Card>
              <CardHeader title="Profile" icon={<Car className="size-4" />} />
              <dl className="grid gap-1.5 text-sm">
                {specs.map(([k, val]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted">{k}</dt>
                    <dd className="min-w-0 break-words">{val}</dd>
                  </div>
                ))}
              </dl>
              {v.notes && <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{v.notes}</p>}
            </Card>
          )}

          <Card>
            <CardHeader title="Parts & specs" icon={<Package className="size-4" />} action={canEdit ? <PartModal vehicleId={v.id} /> : undefined} />
            {parts.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {parts.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.name}</span>
                      {p.partNumber && <span className="text-muted"> · {p.partNumber}</span>}
                      <span className="block text-xs text-muted">{[p.brand, p.whereToBuy, p.lastReplacedOn && `replaced ${formatShortDate(p.lastReplacedOn)}`, p.notes].filter(Boolean).join(" · ")}</span>
                    </span>
                    {canEdit && (
                      <>
                        <PartModal vehicleId={v.id} item={{ id: p.id, name: p.name, partNumber: p.partNumber, brand: p.brand, whereToBuy: p.whereToBuy, lastReplacedOn: p.lastReplacedOn, notes: p.notes }} />
                        <DeleteButton action={deletePart} fields={{ id: p.id }} what={p.name} className="size-9" />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Keep wiper sizes, bulbs, filter numbers and where to buy them.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Mileage log" icon={<Gauge className="size-4" />} />
            {readings.length ? (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {readings.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-1.5">
                    <span className="w-20 text-muted">{formatShortDate(r.date)}</span>
                    <span className="flex-1 font-medium tabular-nums">{r.miles.toLocaleString()} mi</span>
                    {canEdit && <DeleteButton action={deleteMileage} fields={{ id: r.id }} what="this reading" className="size-8" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Update the odometer now and then to predict when things are due.</p>
            )}
          </Card>

          {canEdit && (
            <ActionButton action={deleteVehicle} fields={{ id: v.id }} confirm={`Delete ${v.nickname} and all its records?`} className="h-9 w-fit rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
              <Trash2 className="size-4" /> Delete vehicle
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

