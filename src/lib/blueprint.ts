/**
 * Blueprint (garden & farm planner) object palettes and layout validation.
 * Coordinates are in plan units (ft by default). Pure module: safe on client & server.
 */
import * as z from "zod";
import type { BlueprintLayout, BlueprintObject } from "@/db/schema/garden";

export type Shape = "rect" | "ellipse" | "line";
export type PaletteItem = { type: string; label: string; w: number; h: number; shape: Shape; fill: string; stroke: string; dashed?: boolean; plantable?: boolean };

export const GARDEN_PALETTE: PaletteItem[] = [
  { type: "bed", label: "Raised bed", w: 4, h: 8, shape: "rect", fill: "#ece9d8", stroke: "#6d6a3c", plantable: true },
  { type: "row", label: "Row", w: 12, h: 1.5, shape: "rect", fill: "#e7e4d2", stroke: "#9c9772", plantable: true },
  { type: "container", label: "Pot / container", w: 2, h: 2, shape: "ellipse", fill: "#f2e8ee", stroke: "#a2748f", plantable: true },
  { type: "tree", label: "Tree", w: 6, h: 6, shape: "ellipse", fill: "#dfe3c8", stroke: "#6d6a3c" },
  { type: "path", label: "Path", w: 3, h: 12, shape: "rect", fill: "#efe9e6", stroke: "#d3c7cc" },
  { type: "structure", label: "Structure / shed", w: 8, h: 6, shape: "rect", fill: "#e6dee0", stroke: "#7d7586" },
  { type: "trellis", label: "Trellis", w: 6, h: 0.4, shape: "line", fill: "#4a3946", stroke: "#4a3946" },
  { type: "irrigation", label: "Irrigation line", w: 12, h: 0.3, shape: "line", fill: "#8a9bb0", stroke: "#8a9bb0", dashed: true },
  { type: "fence", label: "Fence", w: 16, h: 0.3, shape: "line", fill: "#4a3946", stroke: "#4a3946" },
  { type: "zone", label: "Zone", w: 10, h: 10, shape: "rect", fill: "rgba(201,145,196,0.10)", stroke: "#8e4e7b", dashed: true },
  { type: "compost", label: "Compost", w: 3, h: 3, shape: "rect", fill: "#e3d9cf", stroke: "#7a5b4a" },
];

export const FARM_PALETTE: PaletteItem[] = [
  { type: "barn", label: "Barn", w: 30, h: 20, shape: "rect", fill: "#f0dde2", stroke: "#7a2e44" },
  { type: "coop", label: "Chicken coop", w: 8, h: 6, shape: "rect", fill: "#f3e3ef", stroke: "#8e4e7b" },
  { type: "run", label: "Chicken run", w: 16, h: 12, shape: "rect", fill: "rgba(156,151,114,0.12)", stroke: "#9c9772", dashed: true },
  { type: "pasture", label: "Pasture", w: 60, h: 40, shape: "rect", fill: "#e9edd6", stroke: "#6d6a3c" },
  { type: "field", label: "Field", w: 50, h: 30, shape: "rect", fill: "#f1efe3", stroke: "#9c9772" },
  { type: "garden", label: "Garden", w: 20, h: 16, shape: "rect", fill: "#ece9d8", stroke: "#6d6a3c" },
  { type: "greenhouse", label: "Greenhouse", w: 12, h: 20, shape: "rect", fill: "#ecebef", stroke: "#7d7586" },
  { type: "animal_area", label: "Animal area", w: 24, h: 18, shape: "rect", fill: "rgba(162,116,143,0.12)", stroke: "#a2748f", dashed: true },
  { type: "storage", label: "Storage", w: 10, h: 8, shape: "rect", fill: "#e6dee0", stroke: "#4c4555" },
  { type: "equipment", label: "Equipment", w: 8, h: 5, shape: "rect", fill: "#e7e5ea", stroke: "#4c4555" },
  { type: "water", label: "Water source", w: 6, h: 6, shape: "ellipse", fill: "#dfe6ee", stroke: "#8a9bb0" },
  { type: "tree", label: "Tree", w: 10, h: 10, shape: "ellipse", fill: "#dfe3c8", stroke: "#6d6a3c" },
  { type: "fence", label: "Fence", w: 40, h: 0.5, shape: "line", fill: "#4a3946", stroke: "#4a3946" },
  { type: "gate", label: "Gate", w: 6, h: 0.8, shape: "line", fill: "#c991c4", stroke: "#8e4e7b" },
];

export const paletteFor = (kind: "garden" | "farm") => (kind === "garden" ? GARDEN_PALETTE : FARM_PALETTE);
export const paletteItem = (kind: "garden" | "farm", type: string) => paletteFor(kind).find((p) => p.type === type);

export function emptyLayout(kind: "garden" | "farm", width?: number, height?: number): BlueprintLayout {
  return kind === "garden"
    ? { width: width ?? 40, height: height ?? 30, unit: "ft", gridSize: 1, objects: [] }
    : { width: width ?? 300, height: height ?? 200, unit: "ft", gridSize: 5, objects: [] };
}

const ObjectSchema = z.object({
  key: z.string().min(1).max(40),
  type: z.string().min(1).max(30),
  label: z.string().max(60).optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().positive().max(5000),
  h: z.number().positive().max(5000),
  rotation: z.number().finite(),
  color: z.string().max(40).optional(),
  zIndex: z.number().int().optional(),
});

export const LayoutSchema = z.object({
  width: z.number().positive().max(5000),
  height: z.number().positive().max(5000),
  unit: z.enum(["ft", "m"]),
  gridSize: z.number().positive().max(100),
  objects: z.array(ObjectSchema).max(500),
});

export function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

export type { BlueprintLayout, BlueprintObject };
