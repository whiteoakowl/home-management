/**
 * Vehicle care logic (pure, unit-tested in tests/vehicles.test.ts):
 * driving rate from odometer readings, maintenance due by miles or time,
 * and the car-loan countdown.
 */
import { addDays } from "./dates";

/** Add months keeping the day of month (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(iso: string, n: number) {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + n;
  const d = +iso.slice(8, 10);
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${ty}-${String(tm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const DAY = 86400_000;
const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;

/** Average miles per day from odometer readings (needs two readings at least a week apart). */
export function milesPerDay(readings: { date: string; miles: number }[]): number | null {
  if (readings.length < 2) return null;
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const days = dayNum(last.date) - dayNum(first.date);
  if (days < 7 || last.miles <= first.miles) return null;
  return (last.miles - first.miles) / days;
}

export type ScheduleItem = { title: string; everyMiles: number | null; everyMonths: number | null; lastDate: string | null; lastMiles: number | null };
export type DueStatus = "overdue" | "soon" | "ok" | "unknown";

/**
 * When a maintenance item is next due, by miles and/or time (whichever comes first).
 * "Soon" = within 500 miles or 30 days. Uses the driving rate to estimate a date for mileage-based items.
 */
export function nextDue(item: ScheduleItem, currentMiles: number | null, rate: number | null, today: string) {
  const dueMiles = item.everyMiles && item.lastMiles != null ? item.lastMiles + item.everyMiles : null;
  const dueByTime = item.everyMonths && item.lastDate ? addMonths(item.lastDate, item.everyMonths) : null;
  // Estimated date the mileage will be reached.
  const dueByMilesDate = dueMiles != null && currentMiles != null && rate ? addDays(today, Math.max(0, Math.round((dueMiles - currentMiles) / rate))) : null;
  const dates = [dueByTime, dueByMilesDate].filter((d): d is string => !!d).sort();
  const dueDate = dates[0] ?? null;
  const milesLeft = dueMiles != null && currentMiles != null ? dueMiles - currentMiles : null;
  const daysLeft = dueByTime ? dayNum(dueByTime) - dayNum(today) : null;
  let status: DueStatus = "unknown";
  if (milesLeft != null || daysLeft != null) {
    if ((milesLeft != null && milesLeft <= 0) || (daysLeft != null && daysLeft <= 0)) status = "overdue";
    else if ((milesLeft != null && milesLeft <= 500) || (daysLeft != null && daysLeft <= 30) || (dueByMilesDate && dayNum(dueByMilesDate) - dayNum(today) <= 30)) status = "soon";
    else status = "ok";
  }
  return { dueMiles, dueDate, milesLeft, daysLeft, status };
}

export type Loan = { amountCents: number; aprPercent: number; paymentCents: number; startDate: string; termMonths: number };

/** Monthly payment for a loan (standard amortization). */
export function monthlyPayment(amountCents: number, aprPercent: number, months: number) {
  const r = aprPercent / 100 / 12;
  if (months <= 0) return amountCents;
  if (r === 0) return Math.round(amountCents / months);
  return Math.round((amountCents * r) / (1 - Math.pow(1 + r, -months)));
}

/** Countdown: payments made/left, estimated balance, payoff date and interest still to pay. */
export function loanStatus(loan: Loan, today: string) {
  const r = loan.aprPercent / 100 / 12;
  const firstPayment = addMonths(loan.startDate, 1);
  // Payments made so far (one a month starting a month after the loan start).
  let made = 0;
  while (made < loan.termMonths && addMonths(firstPayment, made) <= today) made++;
  let balance = loan.amountCents;
  for (let i = 0; i < made && balance > 0; i++) balance = balance * (1 + r) - loan.paymentCents;
  balance = Math.max(0, Math.round(balance));
  // Payments still needed at the current payment (can end early if paying extra).
  let left = 0;
  let b = balance;
  let interestLeft = 0;
  while (b > 0 && left < 1200) {
    const interest = b * r;
    interestLeft += interest;
    b = b + interest - loan.paymentCents;
    left++;
    if (loan.paymentCents <= interest) break; // payment doesn't cover interest
  }
  const payoffDate = left ? addMonths(firstPayment, made + left - 1) : today;
  const paidOff = balance === 0;
  return {
    paymentsMade: made,
    paymentsLeft: paidOff ? 0 : left,
    balanceCents: balance,
    payoffDate,
    paidOff,
    interestLeftCents: Math.round(interestLeft),
    progress: loan.amountCents ? Math.min(1, 1 - balance / loan.amountCents) : 1,
    nextPaymentDate: paidOff ? null : addMonths(firstPayment, made),
  };
}

/** Starter maintenance plan (typical intervals; check the owner's manual). */
export const DEFAULT_SCHEDULE: { title: string; everyMiles: number | null; everyMonths: number | null }[] = [
  { title: "Oil & filter change", everyMiles: 5000, everyMonths: 6 },
  { title: "Tire rotation", everyMiles: 6000, everyMonths: 6 },
  { title: "Engine air filter", everyMiles: 15000, everyMonths: 12 },
  { title: "Cabin air filter", everyMiles: 15000, everyMonths: 12 },
  { title: "Brake inspection", everyMiles: 12000, everyMonths: 12 },
  { title: "Wiper blades", everyMiles: null, everyMonths: 12 },
  { title: "Battery check", everyMiles: null, everyMonths: 12 },
  { title: "Coolant flush", everyMiles: 30000, everyMonths: 36 },
  { title: "Brake fluid", everyMiles: 30000, everyMonths: 24 },
  { title: "Transmission fluid", everyMiles: 60000, everyMonths: 48 },
  { title: "Spark plugs", everyMiles: 60000, everyMonths: null },
];

/** "Jan 15, 2030" (payoff dates are often years away). */
export const monthDayYear = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
