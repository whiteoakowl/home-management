import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, foldLine, parseIcs } from "../src/lib/ics";

test("buildIcs writes timed and all-day events in the family's time zone", () => {
  const ics = buildIcs({
    name: "Vanderbilt Family",
    timezone: "America/New_York",
    now: new Date("2026-11-20T12:00:00Z"),
    items: [
      { uid: "e:1", title: "Soccer practice, field 3", date: "2026-11-24", startMin: 18 * 60, endMin: 19 * 60 + 30, location: "Park; North" },
      { uid: "c:2", title: "Take out trash", date: "2026-11-25", startMin: null, endMin: null },
    ],
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261124T230000Z\r\nDTEND:20261125T003000Z/); // 6pm EST = 23:00 UTC
  assert.ok(ics.includes(String.raw`SUMMARY:Soccer practice\, field 3`));
  assert.ok(ics.includes(String.raw`LOCATION:Park\; North`));
  assert.match(ics, /DTSTART;VALUE=DATE:20261125\r\nDTEND;VALUE=DATE:20261126/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("long lines are folded at 75 bytes", () => {
  const line = `SUMMARY:${"🍝 Dinner ".repeat(20)}`;
  const folded = foldLine(line);
  for (const part of folded.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), line);
});

const GOOGLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:America/Chicago
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
TZNAME:CST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
TZNAME:CDT
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=America/Chicago:20261102T090000
DTEND;TZID=America/Chicago:20261102T100000
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6
UID:standup@google.com
SUMMARY:Team standup
END:VEVENT
BEGIN:VEVENT
RECURRENCE-ID;TZID=America/Chicago:20261116T090000
DTSTART;TZID=America/Chicago:20261116T110000
DTEND;TZID=America/Chicago:20261116T120000
UID:standup@google.com
SUMMARY:Team standup (moved)
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261127
UID:thanksgiving@google.com
SUMMARY:Thanksgiving at Grandma's
LOCATION:Grandma's house
END:VEVENT
BEGIN:VEVENT
DTSTART:20261201T150000Z
DTEND:20261201T160000Z
UID:cancelled@google.com
STATUS:CANCELLED
SUMMARY:Cancelled thing
END:VEVENT
END:VCALENDAR`;

test("parseIcs expands repeats, applies moved occurrences and time zones", () => {
  const ev = parseIcs(GOOGLE, new Date("2026-11-01T00:00:00Z"), new Date("2026-12-31T00:00:00Z"));
  const standups = ev.filter((e) => e.title.startsWith("Team standup"));
  assert.equal(standups.length, 6);
  assert.equal(standups[0]!.start, "2026-11-02T15:00:00.000Z"); // 9am CST
  const moved = standups.find((e) => e.title === "Team standup (moved)")!;
  assert.equal(moved.start, "2026-11-16T17:00:00.000Z");
  const tg = ev.find((e) => e.title.startsWith("Thanksgiving"))!;
  assert.deepEqual([tg.allDay, tg.start, tg.end, tg.location], [true, "2026-11-26", "2026-11-27", "Grandma's house"]);
  assert.ok(!ev.some((e) => e.title === "Cancelled thing"));
});

test("round trip: what we publish can be read back", () => {
  const ics = buildIcs({ name: "F", timezone: "Europe/London", items: [{ uid: "x", title: "Dentist", date: "2026-07-01", startMin: 9 * 60, endMin: 10 * 60 }] });
  const [e] = parseIcs(ics, new Date("2026-06-01T00:00:00Z"), new Date("2026-08-01T00:00:00Z"));
  assert.equal(e!.title, "Dentist");
  assert.equal(e!.start, "2026-07-01T08:00:00.000Z"); // BST
});

import { cleanCalendarUrl, isPrivateAddress } from "../src/lib/calendar-url";

test("calendar links: webcal/http become https, private addresses are refused", () => {
  assert.equal(cleanCalendarUrl("webcal://p01-caldav.icloud.com/published/2/abc"), "https://p01-caldav.icloud.com/published/2/abc");
  assert.equal(cleanCalendarUrl(" http://example.com/a.ics "), "https://example.com/a.ics");
  assert.equal(cleanCalendarUrl("ftp://example.com/a.ics"), null);
  assert.equal(cleanCalendarUrl("https://user:pw@example.com/a.ics"), null);
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ["142.250.72.14", "17.253.144.10", "2607:f8b0:4005:80a::200e"]) assert.ok(!isPrivateAddress(ip), ip);
});
