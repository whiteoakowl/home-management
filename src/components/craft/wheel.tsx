import Link from "next/link";
import type { Sabbat } from "@/lib/sabbats";

/**
 * The Wheel of the Year as an SVG: eight clickable segments starting with
 * Samhain at the top, highlighting the next sabbat.
 */
export function WheelOfYear({ items, next }: { items: { s: Sabbat; date: string }[]; next?: string }) {
  const size = 360;
  const c = size / 2;
  const R = 170;
  const r = 70;
  const order = ["samhain", "yule", "imbolc", "ostara", "beltane", "litha", "lughnasadh", "mabon"];
  const sorted = order.map((k) => items.find((i) => i.s.key === k)!).filter(Boolean);
  const pt = (rad: number, a: number) => [c + rad * Math.sin(a), c - rad * Math.cos(a)] as const;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[420px]" role="group" aria-label="Wheel of the Year">
      <circle cx={c} cy={c} r={R + 4} fill="#0b0e1f" stroke="#d4b26a" strokeOpacity="0.5" />
      {sorted.map((it, i) => {
        const a0 = ((i - 0.5) / 8) * 2 * Math.PI;
        const a1 = ((i + 0.5) / 8) * 2 * Math.PI;
        const [x0, y0] = pt(R, a0);
        const [x1, y1] = pt(R, a1);
        const [x2, y2] = pt(r, a1);
        const [x3, y3] = pt(r, a0);
        const [tx, ty] = pt((R + r) / 2, (i / 8) * 2 * Math.PI);
        const active = it.s.key === next;
        const fill = active ? "#6655a8" : i % 2 ? "#1b2148" : "#2a2358";
        return (
          <Link key={it.s.key} href={`/spiritual/wheel/${it.s.key}`} aria-label={`${it.s.name}, ${fmt(it.date)}`} className="group focus:outline-none">
            <path d={`M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 0 ${x3} ${y3} Z`} fill={fill} stroke="#d4b26a" strokeOpacity="0.35" strokeWidth="1.5" className="transition-opacity group-hover:opacity-85 group-focus-visible:opacity-85" />
            <text x={tx} y={ty - 12} textAnchor="middle" fontSize="20" aria-hidden>
              {it.s.emoji}
            </text>
            <text x={tx} y={ty + 8} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#fbf6ee">
              {it.s.name}
            </text>
            <text x={tx} y={ty + 22} textAnchor="middle" fontSize="10" fill="#e0c27e">
              {fmt(it.date)}
            </text>
          </Link>
        );
      })}
      <circle cx={c} cy={c} r={r - 4} fill="#141a33" stroke="#d4b26a" strokeOpacity="0.6" />
      <text x={c} y={c - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="#e9d6a6">
        Wheel of
      </text>
      <text x={c} y={c + 13} textAnchor="middle" fontSize="13" fontWeight="600" fill="#e9d6a6">
        the Year
      </text>
    </svg>
  );
}
