/**
 * Where household things are stored. Pure data, safe for client components.
 *
 * The Family Pantry holds only the kitchen spots (pantry, refrigerator,
 * freezer, kitchen supplies, canning). Everything else lives with the area it
 * belongs to (farm storage under Farm, the root cellar under Garden, pet
 * supplies under Pets, home supplies under Home maintenance) and every
 * storage area, including craft supplies and the family's own areas, is
 * listed under House → Storage.
 */
import type { Module } from "@/db/schema";

export type StorageLoc = "pantry" | "fridge" | "freezer" | "supplies" | "canning" | "farm" | "garden" | "pets" | "craft" | "home" | "other";

export const PANTRY_LOCATIONS = ["pantry", "fridge", "freezer", "supplies", "canning"] as const;

export const isPantryLocation = (loc: string) => (PANTRY_LOCATIONS as readonly string[]).includes(loc);

export const STORAGE_PLACES: Record<StorageLoc, { label: string; short: string; href: string; area: string; modules: Module[] }> = {
  pantry: { label: "Pantry", short: "Pantry", href: "/kitchen?view=pantry", area: "Family Pantry", modules: ["kitchen"] },
  fridge: { label: "Refrigerator", short: "Fridge", href: "/kitchen?view=fridge", area: "Family Pantry", modules: ["kitchen"] },
  freezer: { label: "Freezer", short: "Freezer", href: "/kitchen?view=freezer", area: "Family Pantry", modules: ["kitchen"] },
  supplies: { label: "Kitchen supplies", short: "Supplies", href: "/kitchen?view=supplies", area: "Family Pantry", modules: ["kitchen"] },
  canning: { label: "Canning", short: "Canning", href: "/kitchen?view=canning", area: "Family Pantry", modules: ["kitchen"] },
  farm: { label: "Farm storage", short: "Farm", href: "/farm/storage", area: "Farm", modules: ["farm"] },
  garden: { label: "Garden / root cellar", short: "Root cellar", href: "/garden/storage", area: "Garden", modules: ["garden"] },
  pets: { label: "Pet supplies", short: "Pets", href: "/pets/supplies", area: "Pets", modules: ["pets"] },
  home: { label: "Home maintenance supplies", short: "Home supplies", href: "/maintenance/supplies", area: "Home maintenance", modules: ["maintenance"] },
  craft: { label: "Craft supplies", short: "Craft", href: "/house/storage/craft", area: "Storage", modules: ["house", "witchcraft"] },
  other: { label: "Other storage", short: "Other", href: "/house/storage/other", area: "Storage", modules: ["house"] },
};

export const PANTRY_LOCATION_OPTIONS = PANTRY_LOCATIONS.map((l) => ({ value: l, label: STORAGE_PLACES[l].label }));

export const storagePlace = (loc: string) => STORAGE_PLACES[loc as StorageLoc] ?? STORAGE_PLACES.other;
