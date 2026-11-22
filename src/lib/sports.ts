/**
 * Sports: built-in sports with their usual stats, plus season totals,
 * averages and win-loss records. Pure (unit-tested in tests/sports.test.ts).
 */
export type StatDef = { key: string; label: string; short: string; kind?: "count" | "time" | "decimal" };
export type SportDef = { key: string; label: string; emoji: string; stats: StatDef[]; scoring: "score" | "place" | "none" };

const s = (key: string, label: string, short = label, kind: StatDef["kind"] = "count"): StatDef => ({ key, label, short, kind });

export const SPORTS: SportDef[] = [
  { key: "basketball", label: "Basketball", emoji: "🏀", scoring: "score", stats: [s("pts", "Points", "PTS"), s("reb", "Rebounds", "REB"), s("ast", "Assists", "AST"), s("stl", "Steals", "STL"), s("blk", "Blocks", "BLK"), s("3pm", "3-pointers made", "3PM"), s("ftm", "Free throws made", "FTM")] },
  { key: "soccer", label: "Soccer", emoji: "⚽", scoring: "score", stats: [s("g", "Goals", "G"), s("a", "Assists", "A"), s("sh", "Shots", "SH"), s("sv", "Saves", "SV"), s("min", "Minutes played", "MIN")] },
  { key: "baseball", label: "Baseball / Softball", emoji: "⚾", scoring: "score", stats: [s("ab", "At bats", "AB"), s("h", "Hits", "H"), s("r", "Runs", "R"), s("rbi", "RBIs", "RBI"), s("hr", "Home runs", "HR"), s("bb", "Walks", "BB"), s("so", "Strikeouts", "SO"), s("sb", "Stolen bases", "SB")] },
  { key: "football", label: "Football", emoji: "🏈", scoring: "score", stats: [s("td", "Touchdowns", "TD"), s("yds", "Yards", "YDS"), s("rec", "Receptions", "REC"), s("tkl", "Tackles", "TKL"), s("int", "Interceptions", "INT"), s("sck", "Sacks", "SCK")] },
  { key: "volleyball", label: "Volleyball", emoji: "🏐", scoring: "score", stats: [s("k", "Kills", "K"), s("ace", "Aces", "ACE"), s("dig", "Digs", "DIG"), s("blk", "Blocks", "BLK"), s("ast", "Assists", "AST")] },
  { key: "hockey", label: "Hockey", emoji: "🏒", scoring: "score", stats: [s("g", "Goals", "G"), s("a", "Assists", "A"), s("sog", "Shots on goal", "SOG"), s("sv", "Saves", "SV"), s("pim", "Penalty minutes", "PIM")] },
  { key: "lacrosse", label: "Lacrosse", emoji: "🥍", scoring: "score", stats: [s("g", "Goals", "G"), s("a", "Assists", "A"), s("gb", "Ground balls", "GB"), s("sv", "Saves", "SV")] },
  { key: "tennis", label: "Tennis", emoji: "🎾", scoring: "score", stats: [s("ace", "Aces", "ACE"), s("df", "Double faults", "DF"), s("gw", "Games won", "GW")] },
  { key: "swimming", label: "Swimming", emoji: "🏊", scoring: "place", stats: [s("time", "Time (seconds)", "TIME", "time"), s("place", "Place", "PL")] },
  { key: "track", label: "Track & field / Cross country", emoji: "🏃", scoring: "place", stats: [s("time", "Time (seconds)", "TIME", "time"), s("dist", "Distance / height", "DIST", "decimal"), s("place", "Place", "PL")] },
  { key: "gymnastics", label: "Gymnastics / Cheer", emoji: "🤸", scoring: "place", stats: [s("score", "Score", "SCORE", "decimal"), s("place", "Place", "PL")] },
  { key: "wrestling", label: "Wrestling / Martial arts", emoji: "🤼", scoring: "place", stats: [s("w", "Wins", "W"), s("l", "Losses", "L"), s("pin", "Pins / submissions", "PIN")] },
  { key: "karate", label: "Karate", emoji: "🥋", scoring: "place", stats: [s("w", "Wins", "W"), s("l", "Losses", "L"), s("pts", "Points", "PTS"), s("place", "Place", "PL")] },
  { key: "golf", label: "Golf", emoji: "⛳", scoring: "place", stats: [s("strokes", "Strokes", "STR"), s("putts", "Putts", "PUTT")] },
  { key: "other", label: "Other sport", emoji: "🏅", scoring: "score", stats: [] },
];

export const sportDef = (key: string | null | undefined) => SPORTS.find((x) => x.key === key) ?? SPORTS.at(-1)!;

/** A team's stats: the sport's built-in list, plus any custom ones the family added. */
export function teamStats(sport: string, custom: string[] = []): StatDef[] {
  const base = sportDef(sport).stats;
  const extra = custom
    .map((c) => c.trim())
    .filter((c) => c && !base.some((b) => b.label.toLowerCase() === c.toLowerCase()))
    .map((c) => s(`c:${c.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, c, c.slice(0, 6).toUpperCase()));
  return [...base, ...extra];
}

export type GameResult = { ourScore: number | null; theirScore: number | null; outcome?: string | null };

/** "win" | "loss" | "tie" | null, from an explicit outcome or the score. */
export function outcomeOf(g: GameResult): "win" | "loss" | "tie" | null {
  if (g.outcome === "win" || g.outcome === "loss" || g.outcome === "tie") return g.outcome;
  if (g.ourScore == null || g.theirScore == null) return null;
  return g.ourScore > g.theirScore ? "win" : g.ourScore < g.theirScore ? "loss" : "tie";
}

/** Win-loss(-tie) record, e.g. "7-2-1". */
export function record(games: GameResult[]) {
  let w = 0;
  let l = 0;
  let t = 0;
  for (const g of games) {
    const o = outcomeOf(g);
    if (o === "win") w++;
    else if (o === "loss") l++;
    else if (o === "tie") t++;
  }
  return { w, l, t, text: t ? `${w}-${l}-${t}` : `${w}-${l}` };
}

/**
 * Season line for one athlete: totals and per-game averages for each stat
 * (for times and places, the best value instead of a total).
 */
export function seasonLine(defs: StatDef[], lines: Record<string, number>[]) {
  const out: Record<string, { total: number | null; avg: number | null; best: number | null; games: number }> = {};
  for (const d of defs) {
    const vals = lines.map((l) => l[d.key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const total = vals.reduce((a, b) => a + b, 0);
    const lowerIsBetter = d.kind === "time" || d.key === "place" || d.key === "strokes";
    out[d.key] = {
      games: vals.length,
      total: vals.length && !lowerIsBetter && d.kind !== "decimal" ? total : null,
      avg: vals.length ? Math.round((total / vals.length) * 10) / 10 : null,
      best: vals.length ? (lowerIsBetter ? Math.min(...vals) : Math.max(...vals)) : null,
    };
  }
  return out;
}

/** Batting average for baseball/softball lines (H / AB), ".333" style. */
export function battingAverage(lines: Record<string, number>[]) {
  const ab = lines.reduce((a, l) => a + (l.ab ?? 0), 0);
  const h = lines.reduce((a, l) => a + (l.h ?? 0), 0);
  if (!ab) return null;
  return (h / ab).toFixed(3).replace(/^0/, "");
}

/** Seconds → "1:05.32" for swim/track times. */
export function formatTime(sec: number | null | undefined) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const rest = (sec - m * 60).toFixed(2).padStart(5, "0");
  return m ? `${m}:${rest}` : (sec).toFixed(2);
}

/** "1:05.32" / "65.32" → seconds. */
export function parseTime(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
}
