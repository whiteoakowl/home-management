import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleOdometer, vehicles, vehicleSchedule } from "@/db/schema";
import type { Viewer } from "./dal";
import { loanStatus, milesPerDay, nextDue } from "./vehicles";

export type VehicleRow = typeof vehicles.$inferSelect;

export async function familyVehicles(viewer: Viewer) {
  return db.select().from(vehicles).where(eq(vehicles.familyId, viewer.family.id)).orderBy(desc(vehicles.active), asc(vehicles.nickname));
}

/** Current miles, driving rate, maintenance due (soonest first) and loan countdown for one vehicle. */
export async function vehicleSummary(viewer: Viewer, v: VehicleRow, today: string) {
  const [readings, schedule] = await Promise.all([
    db.select().from(vehicleOdometer).where(and(eq(vehicleOdometer.familyId, viewer.family.id), eq(vehicleOdometer.vehicleId, v.id))).orderBy(desc(vehicleOdometer.date), desc(vehicleOdometer.miles)),
    db.select().from(vehicleSchedule).where(and(eq(vehicleSchedule.familyId, viewer.family.id), eq(vehicleSchedule.vehicleId, v.id))).orderBy(asc(vehicleSchedule.title)),
  ]);
  const currentMiles = readings.length ? Math.max(...readings.map((r) => r.miles)) : null;
  const rate = milesPerDay(readings.filter((r) => r.date >= readings[readings.length - 1]!.date).map((r) => ({ date: r.date, miles: r.miles })));
  const order = { overdue: 0, soon: 1, ok: 2, unknown: 3 } as const;
  const due = schedule
    .map((s) => ({ s, d: nextDue({ title: s.title, everyMiles: s.everyMiles, everyMonths: s.everyMonths, lastDate: s.lastDate, lastMiles: s.lastMiles }, currentMiles, rate, today) }))
    .sort((a, b) => order[a.d.status] - order[b.d.status] || (a.d.dueDate ?? "9999").localeCompare(b.d.dueDate ?? "9999"));
  const loan =
    v.loanAmountCents && v.loanPaymentCents && v.loanStartDate && v.loanTermMonths
      ? loanStatus({ amountCents: v.loanAmountCents, aprPercent: v.loanApr ?? 0, paymentCents: v.loanPaymentCents, startDate: v.loanStartDate, termMonths: v.loanTermMonths }, today)
      : null;
  return { readings, currentMiles, rate, due, loan };
}

export const vehicleTitle = (v: VehicleRow) => [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
