import { getBaby, logsInRange } from "@/lib/baby";
import { BABY_KINDS, logSummary, type BabyLogKind } from "@/lib/baby-kinds";
import { getViewer } from "@/lib/dal";
import { utcToZoned } from "@/lib/dates";
import { memberOptions } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Spreadsheet-safe CSV cell (quotes, and no formulas from typed-in text). */
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The baby's log as a CSV file (for the pediatrician or your own records). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.can("baby")) return new Response("Not found", { status: 404 });
  const baby = await getBaby(viewer, id);
  if (!baby) return new Response("Not found", { status: 404 });
  if (!(await rateLimit(`baby-export:${viewer.member.id}`, 20, 3600))) return new Response("Too many downloads. Try again later.", { status: 429 });
  const days = Math.min(366, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const [logs, members] = await Promise.all([logsInRange(baby.id, from, to), memberOptions(viewer)]);
  const names = new Map(members.map((m) => [m.id, m.displayName]));
  const tz = viewer.family.timezone;
  const units = { volume: baby.volumeUnit, weight: baby.weightUnit };
  const rows = [
    ["Date", "Time", "Type", "Details", "Amount", "Ended", "Minutes", "Notes", "Logged by"],
    ...logs.map((l) => {
      const s = utcToZoned(l.startedAt, tz);
      const e = l.endedAt ? utcToZoned(l.endedAt, tz) : null;
      return [
        s.date,
        s.time,
        BABY_KINDS[l.kind as BabyLogKind]?.label ?? l.kind,
        logSummary(l, units, to),
        l.amount ?? "",
        e ? `${e.date} ${e.time}` : "",
        l.endedAt ? Math.round((l.endedAt.getTime() - l.startedAt.getTime()) / 60_000) : "",
        l.notes ?? "",
        l.createdByMemberId ? (names.get(l.createdByMemberId) ?? "") : "",
      ];
    }),
  ];
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const name = `${baby.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "baby"}-log-${utcToZoned(to, tz).date}.csv`;
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
