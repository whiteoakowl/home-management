import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES } from "../src/db/schema/_shared";
import { capForPlan, FREE_MODULES, FREE_SECTION_NAMES, isPremiumModule, PREMIUM_TABS, tierOf } from "../src/lib/plan-tiers";
import { FEATURE_CATALOG } from "../src/lib/feature-catalog";

const day = 86_400_000;
const now = new Date("2026-11-21T12:00:00Z");
const created = (daysAgo: number) => new Date(now.getTime() - daysAgo * day);

test("payments off: everyone has Premium", () => {
  assert.equal(tierOf({ billingOn: false, paid: false, familyCreatedAt: created(400), trialDays: 7, now }).tier, "premium");
});

test("new family: no-card trial for trialDays, then Free", () => {
  const t = tierOf({ billingOn: true, paid: false, familyCreatedAt: created(2), trialDays: 7, now });
  assert.equal(t.tier, "trial");
  assert.equal(t.trialDaysLeft, 5);
  const last = tierOf({ billingOn: true, paid: false, familyCreatedAt: new Date(now.getTime() - 7 * day + 3600_000), trialDays: 7, now });
  assert.equal(last.tier, "trial");
  assert.equal(last.trialDaysLeft, 1);
  assert.equal(tierOf({ billingOn: true, paid: false, familyCreatedAt: created(7), trialDays: 7, now }).tier, "free");
  assert.equal(tierOf({ billingOn: true, paid: false, familyCreatedAt: created(30), trialDays: 7, now }).tier, "free");
  assert.equal(tierOf({ billingOn: true, paid: false, familyCreatedAt: created(0), trialDays: 0, now }).tier, "free");
});

test("paid (active, complimentary, Stripe trial, past due) is Premium, even after the trial", () => {
  assert.equal(tierOf({ billingOn: true, paid: true, familyCreatedAt: created(400), trialDays: 7, now }).tier, "premium");
  // Subscribing mid-trial keeps the remaining days for Stripe's trial.
  assert.equal(tierOf({ billingOn: true, paid: true, familyCreatedAt: created(3), trialDays: 7, now }).trialDaysLeft, 4);
});

test("Free plan caps Premium sections to view-only; free sections and no-access are untouched", () => {
  assert.equal(capForPlan("budget", "edit", false), "view");
  assert.equal(capForPlan("recipes", "use", false), "view");
  assert.equal(capForPlan("budget", "none", false), "none");
  assert.equal(capForPlan("calendar", "edit", false), "edit");
  assert.equal(capForPlan("shopping", "add", false), "add");
  assert.equal(capForPlan("budget", "edit", true), "edit");
});

test("the free hub is exactly the agreed sections", () => {
  assert.deepEqual([...FREE_MODULES].sort(), ["calendar", "chores", "contacts", "info", "lists", "messages", "shopping"]);
  for (const m of MODULES) assert.equal(isPremiumModule(m), !FREE_MODULES.includes(m));
});

test("website plan badges name real sections and tabs", () => {
  const sections = FEATURE_CATALOG.flatMap((g) => g.sections);
  for (const n of FREE_SECTION_NAMES) assert.ok(sections.some((s) => s.name === n), n);
  for (const [n, tabs] of Object.entries(PREMIUM_TABS)) {
    const s = sections.find((x) => x.name === n);
    assert.ok(s, n);
    for (const t of tabs) assert.ok(s!.tabs.some((x) => x.name === t), `${n} → ${t}`);
  }
});
