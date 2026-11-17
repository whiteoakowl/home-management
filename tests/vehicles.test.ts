import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, loanStatus, milesPerDay, monthlyPayment, nextDue } from "../src/lib/vehicles";

test("addMonths keeps the day (clamped to month end)", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 3), "2027-02-15");
  assert.equal(addMonths("2026-05-10", -6), "2025-11-10");
});

test("driving rate from odometer readings", () => {
  assert.equal(milesPerDay([{ date: "2026-01-01", miles: 10000 }, { date: "2026-01-31", miles: 11200 }]), 40);
  assert.equal(milesPerDay([{ date: "2026-01-01", miles: 10000 }]), null);
  assert.equal(milesPerDay([{ date: "2026-01-01", miles: 10000 }, { date: "2026-01-03", miles: 10100 }]), null); // < a week
});

test("maintenance due by miles or time, whichever first", () => {
  const oil = { title: "Oil", everyMiles: 5000, everyMonths: 6, lastDate: "2026-06-01", lastMiles: 40000 };
  const ok = nextDue(oil, 41000, 30, "2026-07-01");
  assert.equal(ok.dueMiles, 45000);
  assert.equal(ok.status, "ok");
  assert.equal(ok.dueDate, "2026-11-11"); // 4000 mi at 30/day ≈ 133 days, before Dec 1
  assert.equal(nextDue(oil, 44700, 30, "2026-07-01").status, "soon"); // 300 miles left
  assert.equal(nextDue(oil, 45100, 30, "2026-07-01").status, "overdue");
  assert.equal(nextDue(oil, 41000, null, "2026-12-02").status, "overdue"); // 6 months passed
  assert.equal(nextDue({ ...oil, lastDate: null, lastMiles: null }, 41000, 30, "2026-07-01").status, "unknown");
});

test("loan countdown", () => {
  const pay = monthlyPayment(2400000, 6, 60); // $24,000, 6% APR, 5 years
  assert.equal(pay, 46399); // $463.99
  const s = loanStatus({ amountCents: 2400000, aprPercent: 6, paymentCents: pay, startDate: "2025-01-15", termMonths: 60 }, "2026-11-17");
  assert.equal(s.paymentsMade, 22); // Feb 2025 … Nov 2026
  assert.equal(s.paymentsLeft, 38);
  assert.equal(s.payoffDate, "2030-01-15");
  assert.equal(s.nextPaymentDate, "2026-12-15");
  assert.ok(s.balanceCents > 1500000 && s.balanceCents < 1700000, String(s.balanceCents));
  const zero = loanStatus({ amountCents: 1200000, aprPercent: 0, paymentCents: 20000, startDate: "2026-01-01", termMonths: 60 }, "2026-01-01");
  assert.equal(zero.paymentsLeft, 60);
});
