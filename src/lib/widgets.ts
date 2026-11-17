import type { Module } from "@/db/schema/_shared";
import type { WidgetPref } from "@/db/schema/core";

export type WidgetDef = {
  id: string;
  title: string;
  /** Module required to see the widget (null = always available). */
  module: Module | null;
  defaultSize: WidgetPref["size"];
  defaultVisible: boolean;
  /** Also shown on a member's personal portal. */
  personal?: boolean;
  /** Where a widget added in a later release goes in a layout someone already saved. */
  after?: string;
};

export const WIDGETS: WidgetDef[] = [
  { id: "today", title: "Today at a glance", module: null, defaultSize: "lg", defaultVisible: true, personal: true },
  { id: "chores", title: "Today's chores", module: "chores", defaultSize: "md", defaultVisible: true, personal: true },
  { id: "cleaning", title: "Today's cleaning", module: "cleaning", defaultSize: "md", defaultVisible: true, personal: true, after: "chores" },
  { id: "events", title: "Events", module: "calendar", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "weather", title: "Weather", module: null, defaultSize: "sm", defaultVisible: true },
  { id: "announcements", title: "Announcements", module: null, defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "tasks", title: "Today's tasks", module: "chores", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "farmChores", title: "Today's farm chores", module: "farm", defaultSize: "md", defaultVisible: true, personal: true, after: "cleaning" },
  { id: "meals", title: "Today's meals", module: "meals", defaultSize: "sm", defaultVisible: true },
  { id: "shopping", title: "Shopping list", module: "shopping", defaultSize: "sm", defaultVisible: true },
  { id: "pantry", title: "Pantry alerts", module: "kitchen", defaultSize: "sm", defaultVisible: true },
  { id: "garden", title: "Garden", module: "garden", defaultSize: "sm", defaultVisible: true },
  { id: "farm", title: "Farm", module: "farm", defaultSize: "sm", defaultVisible: true },
  { id: "budget", title: "Budget snapshot", module: "budget", defaultSize: "sm", defaultVisible: true },
  { id: "savings", title: "Savings progress", module: "goals", defaultSize: "sm", defaultVisible: true },
  { id: "goals", title: "Goals", module: "goals", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "fitness", title: "Fitness", module: "fitness", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "journal", title: "Journal", module: "journal", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "points", title: "Points & rewards", module: "chores", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "health", title: "Health", module: "medical", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "pets", title: "Pets", module: "pets", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "home", title: "Home upkeep", module: "maintenance", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "moon", title: "Moon & Wheel", module: "witchcraft", defaultSize: "sm", defaultVisible: true },
  { id: "reading", title: "Reading", module: "library", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "activity", title: "Family activity", module: null, defaultSize: "md", defaultVisible: true },
];

export const WIDGET_IDS = WIDGETS.map((w) => w.id);

export function widgetDef(id: string) {
  return WIDGETS.find((w) => w.id === id);
}

/**
 * Merge a saved layout with the registry: keeps saved order/size/visibility,
 * drops unknown widgets and appends widgets added in later releases.
 */
export function resolveLayout(saved: WidgetPref[] | null | undefined): WidgetPref[] {
  const known = (saved ?? []).filter((w) => WIDGET_IDS.includes(w.id));
  const seen = new Set(known.map((w) => w.id));
  const out = [...known];
  for (const w of WIDGETS.filter((x) => !seen.has(x.id))) {
    const pref = { id: w.id, visible: w.defaultVisible, size: w.defaultSize };
    const at = w.after && saved?.length ? out.findIndex((x) => x.id === w.after) : -1;
    if (at >= 0) out.splice(at + 1, 0, pref);
    else out.push(pref);
  }
  return out;
}

/** Cards on section dashboards (Spiritual, Library…), customizable per member. */
export const SECTION_WIDGETS = {
  spiritual: [
    { id: "moon", title: "Moon tonight", size: "lg" },
    { id: "nextMoons", title: "Next full & new moon", size: "sm" },
    { id: "wheel", title: "Wheel of the Year", size: "sm" },
    { id: "celebrations", title: "Upcoming celebrations", size: "sm" },
    { id: "journal", title: "Recent journal entries", size: "md" },
    { id: "forMoon", title: "For this moon", size: "sm" },
    { id: "rituals", title: "Favorite rituals", size: "sm" },
    { id: "spells", title: "Favorite spells", size: "sm" },
    { id: "crystals", title: "Crystal collection", size: "sm" },
    { id: "herbs", title: "Herbal database", size: "sm" },
    { id: "tools", title: "Tools", size: "sm" },
    { id: "supplies", title: "Supplies", size: "sm" },
    { id: "recent", title: "Recently added", size: "md" },
  ],
  library: [
    { id: "stats", title: "Library at a glance", size: "lg" },
    { id: "reading", title: "Currently reading", size: "md" },
    { id: "yearStats", title: "Reading this year", size: "sm" },
    { id: "toRead", title: "To read", size: "sm" },
    { id: "favorites", title: "Favorites", size: "sm" },
    { id: "completed", title: "Recently completed", size: "sm" },
    { id: "recent", title: "Recently added", size: "md" },
    { id: "categories", title: "Categories", size: "sm" },
    { id: "authors", title: "Authors", size: "sm" },
  ],
} as const satisfies Record<string, readonly { id: string; title: string; size: WidgetPref["size"] }[]>;

export type Section = keyof typeof SECTION_WIDGETS;
export const isSection = (s: string): s is Section => s in SECTION_WIDGETS;

/** Saved section layout merged with the registry (new cards appended, unknown dropped). */
export function resolveSectionLayout(section: Section, saved: WidgetPref[] | null | undefined): WidgetPref[] {
  const defs: readonly { id: string; size: WidgetPref["size"] }[] = SECTION_WIDGETS[section];
  const ids = defs.map((d) => d.id);
  const known = (saved ?? []).filter((w) => ids.includes(w.id));
  const seen = new Set(known.map((w) => w.id));
  return [...known, ...defs.filter((d) => !seen.has(d.id)).map((d) => ({ id: d.id, visible: true, size: d.size }))];
}

export const sectionTitles = (section: Section) => Object.fromEntries(SECTION_WIDGETS[section].map((w) => [w.id, w.title]));
