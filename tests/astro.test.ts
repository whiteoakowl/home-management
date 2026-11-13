import { test } from "node:test";
import assert from "node:assert/strict";
import { moonForDate, moonSign, phasesBetween, seasonEvent } from "../src/lib/astro";

const near = (a: Date, iso: string, minutes = 5) => assert.ok(Math.abs(a.getTime() - Date.parse(iso)) <= minutes * 60000, `${a.toISOString()} vs ${iso}`);

test("principal moon phases match published times (USNO)", () => {
  const ev = phasesBetween(new Date("2024-01-01T00:00:00Z"), new Date("2024-02-01T00:00:00Z"));
  near(ev.find((e) => e.phase === "new")!.at, "2024-01-11T11:57:00Z");
  near(ev.find((e) => e.phase === "full")!.at, "2024-01-25T17:54:00Z");
  near(ev.find((e) => e.phase === "first_quarter")!.at, "2024-01-18T03:53:00Z");
  near(ev.find((e) => e.phase === "last_quarter")!.at, "2024-01-04T03:30:00Z");
  const ev25 = phasesBetween(new Date("2025-01-01T00:00:00Z"), new Date("2025-01-31T00:00:00Z"));
  near(ev25.find((e) => e.phase === "full")!.at, "2025-01-13T22:27:00Z");
  const ev26 = phasesBetween(new Date("2026-11-01T00:00:00Z"), new Date("2026-12-01T00:00:00Z"));
  near(ev26.find((e) => e.phase === "full")!.at, "2026-11-24T14:53:00Z", 10);
});

test("daily phase naming", () => {
  assert.equal(moonForDate("2024-01-25").phase, "full_moon");
  assert.equal(moonForDate("2024-01-11").phase, "new_moon");
  assert.equal(moonForDate("2024-01-14").phase, "waxing_crescent");
  assert.equal(moonForDate("2024-01-21").phase, "waxing_gibbous");
  assert.equal(moonForDate("2024-01-28").phase, "waning_gibbous");
  assert.ok(moonForDate("2024-01-25").illumination > 0.98);
  assert.ok(moonForDate("2024-01-11").illumination < 0.02);
  // Local date matters: 2024-01-25 17:54 UTC is still Jan 25 in New York (UTC-5).
  assert.equal(moonForDate("2024-01-25", -300).phase, "full_moon");
});

test("moon sign", () => {
  // Full moon of 2024-01-25 was in Leo; new moon of 2024-01-11 in Capricorn.
  assert.equal(moonSign(new Date("2024-01-25T17:54:00Z")), "Leo");
  assert.equal(moonSign(new Date("2024-01-11T11:57:00Z")), "Capricorn");
});

test("equinoxes & solstices", () => {
  near(seasonEvent(2024, "march_equinox"), "2024-03-20T03:06:00Z");
  near(seasonEvent(2024, "june_solstice"), "2024-06-20T20:51:00Z");
  near(seasonEvent(2024, "september_equinox"), "2024-09-22T12:44:00Z");
  near(seasonEvent(2024, "december_solstice"), "2024-12-21T09:20:00Z");
  near(seasonEvent(2026, "december_solstice"), "2026-12-21T20:50:00Z");
});

import { upcomingSabbats, wheelForYear } from "../src/lib/sabbats";

test("wheel of the year", () => {
  const w = wheelForYear(2026, { tz: "America/New_York" });
  const d = Object.fromEntries(w.map((x) => [x.key, x.date]));
  assert.equal(d.samhain, "2026-10-31");
  assert.equal(d.ostara, "2026-03-20");
  assert.equal(d.litha, "2026-06-21");
  assert.equal(d.mabon, "2026-09-22");
  assert.equal(d.yule, "2026-12-21");
  const south = Object.fromEntries(wheelForYear(2026, { tz: "Australia/Sydney", southern: true }).map((x) => [x.key, x.date]));
  assert.equal(south.yule, "2026-06-21");
  assert.equal(south.samhain, "2026-04-30");
  assert.equal(south.beltane, "2026-10-31");
  assert.equal(south.ostara, "2026-09-23");
  const over = Object.fromEntries(wheelForYear(2026, { tz: "UTC", overrides: { imbolc: "02-02" } }).map((x) => [x.key, x.date]));
  assert.equal(over.imbolc, "2026-02-02");
  const up = upcomingSabbats("2026-11-13", { tz: "America/New_York" }, 3);
  assert.deepEqual(up.map((x) => x.key), ["yule", "imbolc", "ostara"]);
});
