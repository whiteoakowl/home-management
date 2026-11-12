"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Chart palette (validated with the dataviz validator, light surface):
 * plum #8e4e7b and olive #7c7f22 pass lightness, chroma, CVD and contrast.
 */
export const SERIES_COLORS = ["#8e4e7b", "#7c7f22"] as const;

type Fmt = (n: number) => string;
const defaultFmt: Fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function compact(n: number) {
  return Math.abs(n) >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function Legend({ series }: { series: { name: string; color: string }[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-4 text-sm text-ink-soft">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function TableView({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">View as table</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr className="border-b border-line text-muted">
            {headers.map((h) => (
              <th key={h} className="py-1.5 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/60">
              {r.map((c, j) => (
                <td key={j} className="py-1.5 pr-3 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export type BarDatum = { label: string; values: number[] };

/** Vertical column chart; 1–2 series side by side. Hover for values. */
export function BarChart({
  data,
  series,
  height = 220,
  format = defaultFmt,
  label,
}: {
  data: BarDatum[];
  series: { name: string }[];
  height?: number;
  format?: Fmt;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const colored = series.map((s, i) => ({ ...s, color: SERIES_COLORS[i % SERIES_COLORS.length]! }));
  const max = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const W = 640;
  const padL = 44;
  const padB = 28;
  const H = height;
  const plotH = H - padB - 8;
  const band = (W - padL) / Math.max(1, data.length);
  const nS = series.length;
  const barW = Math.min(24, (band * 0.7 - 2 * (nS - 1)) / nS);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const y = (v: number) => 8 + plotH - (v / max) * plotH;
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <figure aria-label={label}>
      <Legend series={colored} />
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padL + band * i + band / 2;
            const groupW = nS * barW + (nS - 1) * 2;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + band * i} y={0} width={band} height={H - padB} fill={hover === i ? "var(--color-sunken)" : "transparent"} opacity={0.6} />
                {d.values.map((v, s) => {
                  const h = Math.max(0, (v / max) * plotH);
                  const x = cx - groupW / 2 + s * (barW + 2);
                  const r = Math.min(4, barW / 2, h);
                  const top = y(v);
                  // Rounded data-end, square baseline.
                  const path = h <= 0 ? "" : `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`;
                  return <path key={s} d={path} fill={colored[s]!.color} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
            style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%` }}
          >
            <p className="mb-1 font-semibold text-ink">{data[hover].label}</p>
            {colored.map((s, i) => (
              <p key={s.name} className="flex items-center gap-1.5 text-ink-soft">
                <span className="size-2 rounded-sm" style={{ background: s.color }} />
                {nS > 1 && `${s.name}: `}
                <span className="font-medium text-ink">{format(data[hover]!.values[i] ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <TableView headers={["", ...series.map((s) => s.name)]} rows={data.map((d) => [d.label, ...d.values.map(format)])} />
    </figure>
  );
}

/** Single-series line chart with crosshair tooltip. */
export function LineChart({
  data,
  height = 200,
  format = defaultFmt,
  label,
  seriesName,
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: Fmt;
  label: string;
  seriesName: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const color = SERIES_COLORS[0];
  const W = 640;
  const H = height;
  const padL = 44;
  const padB = 28;
  const plotH = H - padB - 12;
  const vals = data.map((d) => d.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1);
  const min = Math.max(0, lo - span * 0.15);
  const max = hi + span * 0.15;
  const x = (i: number) => padL + (data.length <= 1 ? (W - padL) / 2 : (i / (data.length - 1)) * (W - padL - 8));
  const y = (v: number) => 12 + plotH - ((v - min) / (max - min)) * plotH;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => min + t * (max - min));
  const labelEvery = Math.ceil(data.length / 8);
  if (!data.length) return null;

  return (
    <figure aria-label={label}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={label}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - padL) / (W - padL - 8)) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.12} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
                {compact(Math.round(t * 10) / 10)}
              </text>
            </g>
          ))}
          {data.length > 1 && <polygon points={`${x(0)},${y(min)} ${pts} ${x(data.length - 1)},${y(min)}`} fill={`url(#${gid})`} />}
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}
          {/* end marker + label */}
          <circle cx={x(data.length - 1)} cy={y(data.at(-1)!.value)} r={4} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={12} y2={12 + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(data[hover]!.value)} r={5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]"
            style={{ left: `${(x(hover) / W) * 100}%` }}
          >
            <p className="font-semibold text-ink">{data[hover]!.label}</p>
            <p className="text-ink-soft">
              {seriesName}: <span className="font-medium text-ink">{format(data[hover]!.value)}</span>
            </p>
          </div>
        )}
      </div>
      <TableView headers={["", seriesName]} rows={data.map((d) => [d.label, format(d.value)])} />
    </figure>
  );
}

/** Horizontal bars for category breakdowns (single series, sorted by caller). */
export function HBarList({
  data,
  format = defaultFmt,
  max: maxOverride,
}: {
  data: { label: string; value: number; limit?: number | null }[];
  format?: Fmt;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(1, ...data.map((d) => Math.max(d.value, d.limit ?? 0)));
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => {
        const over = d.limit != null && d.value > d.limit;
        return (
          <li key={d.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">{d.label}</span>
              <span className={cn("tabular-nums", over ? "font-semibold text-wine-500" : "text-ink-soft")}>
                {format(d.value)}
                {d.limit != null && <span className="text-muted"> / {format(d.limit)}</span>}
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-sunken" title={`${d.label}: ${format(d.value)}`}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (d.value / max) * 100)}%`, background: over ? "var(--color-wine-500)" : SERIES_COLORS[0] }}
              />
              {d.limit != null && <div className="absolute top-[-3px] h-4 w-0.5 rounded bg-ink/60" style={{ left: `${Math.min(100, (d.limit / max) * 100)}%` }} aria-hidden />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
