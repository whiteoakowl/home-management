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
};

export const WIDGETS: WidgetDef[] = [
  { id: "today", title: "Today at a glance", module: null, defaultSize: "lg", defaultVisible: true, personal: true },
  { id: "chores", title: "Chores", module: "chores", defaultSize: "md", defaultVisible: true, personal: true },
  { id: "events", title: "Events", module: "calendar", defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "weather", title: "Weather", module: null, defaultSize: "sm", defaultVisible: true },
  { id: "announcements", title: "Announcements", module: null, defaultSize: "sm", defaultVisible: true, personal: true },
  { id: "tasks", title: "Tasks", module: "chores", defaultSize: "sm", defaultVisible: true, personal: true },
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
  const added = WIDGETS.filter((w) => !seen.has(w.id)).map((w) => ({
    id: w.id,
    visible: w.defaultVisible,
    size: w.defaultSize,
  }));
  return [...known, ...added];
}
