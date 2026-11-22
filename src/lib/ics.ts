/**
 * iCalendar (.ics, RFC 5545) for calendar sync. Pure functions, unit-tested
 * (tests/ics.test.ts).
 *  - buildIcs: the family calendar as a feed Google Calendar, Outlook and
 *    Apple Calendar can subscribe to.
 *  - parseIcs: events from someone's Google / Outlook / iCloud calendar link,
 *    with repeating events expanded over a date window.
 */
import ICAL from "ical.js";
import type { ImportedEvent } from "@/db/schema";
import { addDays, zonedToUtc } from "./dates";

export type IcsItem = {
  uid: string;
  title: string;
  date: string; // local yyyy-mm-dd
  startMin: number | null; // null = all day
  endMin: number | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (iso: string) => iso.replace(/-/g, "");
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Fold a content line at 75 octets without splitting a UTF-8 character. */
export function foldLine(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "",
    size = 0,
    limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > limit) {
      parts.push(cur);
      cur = "";
      size = 0;
      limit = 74; // continuation lines start with a space
    }
    cur += ch;
    size += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function buildIcs(opts: { name: string; timezone: string; items: IcsItem[]; now?: Date }): string {
  const stamp = utcStamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Bubble//Family Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    `X-WR-TIMEZONE:${opts.timezone}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const it of opts.items) {
    lines.push("BEGIN:VEVENT", `UID:${esc(it.uid)}`, `DTSTAMP:${stamp}`);
    if (it.startMin === null) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(it.date)}`, `DTEND;VALUE=DATE:${dateOnly(addDays(it.date, 1))}`);
    } else {
      const start = zonedToUtc(it.date, hhmm(it.startMin), opts.timezone);
      const endMin = it.endMin !== null && it.endMin > it.startMin ? it.endMin : it.startMin + 60;
      const end = endMin >= 24 * 60 ? zonedToUtc(addDays(it.date, 1), hhmm(endMin - 24 * 60), opts.timezone) : zonedToUtc(it.date, hhmm(endMin), opts.timezone);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    }
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.location) lines.push(`LOCATION:${esc(it.location)}`);
    if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Events between two instants from an .ics file. Repeating events are
 * expanded (at most 3,000 occurrences in total). All-day events keep their
 * calendar dates; timed events are returned in UTC.
 */
export function parseIcs(text: string, from: Date, to: Date): ImportedEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  // Register the file's own time zones so local times convert correctly.
  for (const tz of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  const vevents = comp.getAllSubcomponents("vevent");
  const out: ImportedEvent[] = [];
  const LIMIT = 3000;
  // Edited single occurrences of a repeating event (RECURRENCE-ID) replace the generated ones.
  const exceptions = new Map<string, Map<string, ICAL.Event>>();
  for (const v of vevents) {
    const e = new ICAL.Event(v);
    if (v.hasProperty("recurrence-id")) {
      const m = exceptions.get(e.uid) ?? new Map();
      m.set(e.recurrenceId.toUnixTime().toString(), e);
      exceptions.set(e.uid, m);
    }
  }
  const push = (e: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null) => {
    const allDay = start.isDate;
    const s = allDay ? start.toString().slice(0, 10) : start.toJSDate().toISOString();
    const en = end ? (allDay ? end.toString().slice(0, 10) : end.toJSDate().toISOString()) : null;
    out.push({ uid: `${e.uid}:${s}`, title: (e.summary || "Busy").slice(0, 200), start: s, end: en, allDay, location: e.location?.slice(0, 200) || null, description: e.description?.slice(0, 1000) || null });
  };
  const inRange = (start: ICAL.Time, end: ICAL.Time | null) => {
    const s = start.toJSDate();
    const e = end ? end.toJSDate() : s;
    return e >= from && s <= to;
  };
  for (const v of vevents) {
    if (out.length >= LIMIT) break;
    if (v.hasProperty("recurrence-id")) continue;
    const e = new ICAL.Event(v);
    if ((v.getFirstPropertyValue("status") as string | null)?.toUpperCase() === "CANCELLED") continue;
    if (!e.startDate) continue;
    if (!e.isRecurring()) {
      if (inRange(e.startDate, e.endDate)) push(e, e.startDate, e.endDate);
      continue;
    }
    const it = e.iterator();
    const ex = exceptions.get(e.uid);
    let n = 0;
    for (let next = it.next(); next && n < 5000 && out.length < LIMIT; next = it.next(), n++) {
      if (next.toJSDate() > to) break;
      const changed = ex?.get(next.toUnixTime().toString());
      if (changed) {
        if ((changed.component.getFirstPropertyValue("status") as string | null)?.toUpperCase() !== "CANCELLED" && inRange(changed.startDate, changed.endDate)) push(changed, changed.startDate, changed.endDate);
        continue;
      }
      const d = e.getOccurrenceDetails(next);
      if (inRange(d.startDate, d.endDate)) push(e, d.startDate, d.endDate);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
