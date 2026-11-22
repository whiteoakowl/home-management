import { formatShortDate } from "@/lib/dates";

/**
 * A small line chart (1–5 scale or any range), drawn as SVG on the server.
 * Gaps where nothing was logged; a screen-reader table carries the values.
 */
export function TrendChart({
  title,
  points,
  min = 1,
  max = 5,
  labels,
  format = (v: number) => String(v),
}: {
  title: string;
  points: { date: string; value: number | null }[];
  min?: number;
  max?: number;
  /** Words for the low and high ends ("Low", "High"). */
  labels?: [string, string];
  format?: (v: number) => string;
}) {
  const w = 320;
  const h = 110;
  const pad = 8;
  const n = Math.max(1, points.length - 1);
  const x = (i: number) => pad + (i / n) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / Math.max(0.0001, max - min)) * (h - pad * 2);
  const segs: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segs.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
  });
  if (cur) segs.push(cur);
  const logged = points.filter((p) => p.value !== null);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm font-medium">
        {title}
        <span className="text-xs font-normal text-muted">{logged.length ? `${logged.length} day${logged.length === 1 ? "" : "s"} logged` : "Nothing logged yet"}</span>
      </figcaption>
      <div className="flex gap-2">
        {labels && (
          <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-[10px] text-muted" aria-hidden>
            <span>{labels[1]}</span>
            <span>{labels[0]}</span>
          </div>
        )}
        <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" aria-hidden>
          <line x1={pad} x2={w - pad} y1={y((min + max) / 2)} y2={y((min + max) / 2)} className="stroke-line" strokeDasharray="3 4" />
          {segs.map((d, i) => (
            <path key={i} d={d} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="stroke-primary-500" />
          ))}
          {points.map((p, i) => (p.value !== null ? <circle key={p.date} cx={x(i)} cy={y(p.value)} r="3" className="fill-primary-600" /> : null))}
        </svg>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {logged.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatShortDate(p.date)}</th>
              <td>{format(p.value!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Simple vertical bars (e.g. days done per week). */
export function BarChart({ title, bars, max }: { title: string; bars: { label: string; value: number }[]; max: number }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <ol className="flex h-24 items-end gap-1.5">
        {bars.map((b) => (
          <li key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-muted">{b.value}</span>
            <span className="w-full rounded-t-md bg-primary-400" style={{ height: `${Math.max(4, (b.value / Math.max(1, max)) * 64)}px` }} aria-hidden />
            <span className="text-[10px] text-muted">{b.label}</span>
            <span className="sr-only">
              {b.label}: {b.value}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
