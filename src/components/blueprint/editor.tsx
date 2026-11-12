"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  LoaderCircle,
  Minus,
  MousePointerClick,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { newKey, paletteFor, paletteItem, type BlueprintLayout, type BlueprintObject } from "@/lib/blueprint";
import { PlantAvatar } from "@/components/garden/plant-avatar";
import { cn } from "@/lib/utils";

/** px per plan unit at zoom 1. Coordinates are stored in units (ft). */
const S = 20;

export type PlantingChip = { id: string; bedKey: string | null; name: string; imageUrl: string | null; photoUrl: string | null; category: string | null; quantity: number; spacingIn: string | null };
export type PlantOption = { id: string; name: string; variety: string | null; imageUrl: string | null; photoUrl: string | null; category: string | null; spacingIn: string | null };

type Drag =
  | { mode: "move"; key: string; dx: number; dy: number }
  | { mode: "resize"; key: string }
  | { mode: "rotate"; key: string }
  | null;

const snap = (v: number, g: number) => Math.round(v / g) * g;
const round = (v: number) => Math.round(v * 100) / 100;

export function BlueprintEditor({
  kind,
  initial,
  canEdit,
  onSave,
  plantings = [],
  plants = [],
  onAddPlanting,
  onUpdatePlanting,
  onRemovePlanting,
}: {
  kind: "garden" | "farm";
  initial: BlueprintLayout;
  canEdit: boolean;
  onSave: (layout: BlueprintLayout) => Promise<{ ok: boolean; message?: string }>;
  plantings?: PlantingChip[];
  plants?: PlantOption[];
  onAddPlanting?: (bedKey: string, plantId: string, quantity: number) => Promise<void>;
  onUpdatePlanting?: (id: string, quantity: number) => Promise<void>;
  onRemovePlanting?: (id: string) => Promise<void>;
}) {
  const palette = paletteFor(kind);
  const [layout, setLayout] = useState<BlueprintLayout>(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(kind === "garden" ? 1 : 0.35);
  const [drag, setDrag] = useState<Drag>(null);
  const [saving, startSave] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [plantQuery, setPlantQuery] = useState("");
  const [plantDrag, setPlantDrag] = useState<{ plant: PlantOption; x: number; y: number } | null>(null);
  const [pendingPlant, startPlant] = useTransition();
  const [armedPlant, setArmedPlant] = useState<PlantOption | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);

  /** Zoom so the whole plan width fits the canvas. */
  const fitZoom = () => {
    const el = canvasRef.current;
    if (!el) return;
    const z = Math.max(0.1, Math.min(2, (el.clientWidth - 16) / (layout.width * S)));
    setZoom(Math.round(z * 100) / 100);
  };
  // Fit once on first layout (ResizeObserver callback, not a render-time setState).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (fittedRef.current || el.clientWidth === 0) return;
      fittedRef.current = true;
      setZoom(Math.round(Math.max(0.1, Math.min(2, (el.clientWidth - 16) / (initial.width * S))) * 100) / 100);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [initial.width]);

  const objects = useMemo(() => [...layout.objects].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)), [layout.objects]);
  const sel = layout.objects.find((o) => o.key === selected) ?? null;
  const selMeta = sel ? paletteItem(kind, sel.type) : null;
  const grid = layout.gridSize;

  const mutate = (fn: (objs: BlueprintObject[]) => BlueprintObject[]) => {
    setLayout((l) => ({ ...l, objects: fn(l.objects) }));
    setDirty(true);
    setSaveMsg(null);
  };
  const patch = (key: string, p: Partial<BlueprintObject>) => mutate((objs) => objs.map((o) => (o.key === key ? { ...o, ...p } : o)));

  const toUnits = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x / S, y: p.y / S };
  };

  const addObject = (type: string) => {
    const meta = paletteItem(kind, type)!;
    const maxZ = Math.max(0, ...layout.objects.map((o) => o.zIndex ?? 0));
    const count = layout.objects.filter((o) => o.type === type).length + 1;
    // Cascade new objects so they don't stack exactly on top of each other.
    const offset = (layout.objects.length % 8) * Math.max(grid, 1) * 2;
    const obj: BlueprintObject = {
      key: newKey(),
      type,
      label: `${meta.label} ${count}`,
      x: snap(Math.min(Math.max(0, layout.width - meta.w), Math.max(0, layout.width / 4 - meta.w / 2 + offset)), grid),
      y: snap(Math.min(Math.max(0, layout.height - meta.h), Math.max(0, layout.height / 4 - meta.h / 2 + offset)), grid),
      w: meta.w,
      h: meta.h,
      rotation: 0,
      zIndex: type === "zone" || type === "pasture" || type === "field" ? 0 : maxZ + 1,
    };
    mutate((objs) => [...objs, obj]);
    setSelected(obj.key);
  };

  const duplicate = (key: string) => {
    const o = layout.objects.find((x) => x.key === key);
    if (!o) return;
    const copy = { ...o, key: newKey(), x: o.x + grid * 2, y: o.y + grid * 2, label: `${o.label ?? "Copy"} copy`, zIndex: (o.zIndex ?? 0) + 1 };
    mutate((objs) => [...objs, copy]);
    setSelected(copy.key);
  };
  const remove = (key: string) => {
    mutate((objs) => objs.filter((o) => o.key !== key));
    setSelected(null);
  };
  const reorder = (key: string, dir: "front" | "back") => {
    const zs = layout.objects.map((o) => o.zIndex ?? 0);
    patch(key, { zIndex: dir === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1 });
  };

  const save = () => {
    startSave(async () => {
      const r = await onSave(layout);
      if (r.ok) setDirty(false);
      setSaveMsg(r.ok ? "Saved" : (r.message ?? "Couldn't save"));
    });
  };

  // Keyboard: delete, arrows nudge, ⌘/Ctrl+D duplicate, ⌘/Ctrl+S save.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove(selected);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicate(selected);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const o = layout.objects.find((x) => x.key === selected)!;
        const step = e.shiftKey ? grid * 5 : grid;
        patch(selected, {
          x: o.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
          y: o.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
        });
      } else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toUnits(e.clientX, e.clientY);
    const o = layout.objects.find((x) => x.key === drag.key);
    if (!o) return;
    if (drag.mode === "move") {
      patch(o.key, { x: round(snap(p.x - drag.dx, grid / 2)), y: round(snap(p.y - drag.dy, grid / 2)) });
    } else if (drag.mode === "resize") {
      // Pointer in the object's local (unrotated) frame, top-left fixed.
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const a = (-o.rotation * Math.PI) / 180;
      const lx = Math.cos(a) * (p.x - cx) - Math.sin(a) * (p.y - cy) + cx;
      const ly = Math.sin(a) * (p.x - cx) + Math.cos(a) * (p.y - cy) + cy;
      const meta = paletteItem(kind, o.type);
      const minH = meta?.shape === "line" ? o.h : grid / 2;
      patch(o.key, { w: round(Math.max(grid / 2, snap(lx - o.x, grid / 2))), h: meta?.shape === "line" ? o.h : round(Math.max(minH, snap(ly - o.y, grid / 2))) });
    } else if (drag.mode === "rotate") {
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      const deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      patch(o.key, { rotation: ((Math.round(deg / 15) * 15) % 360 + 360) % 360 });
    }
  };

  /** Plant into a bed; saves unsaved layout first so the server knows the bed. */
  const plantInto = (bedKey: string, plant: PlantOption) => {
    if (!onAddPlanting) return;
    setSelected(bedKey);
    startPlant(async () => {
      if (dirty) {
        const r = await onSave(layout);
        if (!r.ok) {
          setSaveMsg(r.message ?? "Couldn't save");
          return;
        }
        setDirty(false);
        setSaveMsg("Saved");
      }
      await onAddPlanting(bedKey, plant.id, 1);
    });
  };
  const plantIntoRef = useRef(plantInto);
  useEffect(() => {
    plantIntoRef.current = plantInto;
  });

  // Plant drag from the palette onto a bed (pointer-based; works with touch & mouse).
  useEffect(() => {
    if (!plantDrag) return;
    const move = (e: PointerEvent) => setPlantDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-bed-key]");
      const bedKey = el?.getAttribute("data-bed-key");
      const plant = plantDrag.plant;
      setPlantDrag(null);
      if (bedKey) plantIntoRef.current(bedKey, plant);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [plantDrag]);

  const byBed = useMemo(() => Map.groupBy(plantings, (p) => p.bedKey ?? ""), [plantings]);
  const filteredPlants = plants.filter((p) => `${p.name} ${p.variety ?? ""}`.toLowerCase().includes(plantQuery.toLowerCase())).slice(0, 40);
  const W = layout.width * S;
  const H = layout.height * S;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2">
        {canEdit && (
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </button>
        )}
        <span className="text-sm text-muted" role="status">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : saveMsg ?? "All changes saved"}
        </span>
        {pendingPlant && <LoaderCircle className="size-4 animate-spin text-primary-600" aria-label="Adding plant" />}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.1, round(z / 1.25)))} className="size-9 rounded-lg text-ink-soft hover:bg-sunken">
            <ZoomOut className="mx-auto size-4" />
          </button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, round(z * 1.25)))} className="size-9 rounded-lg text-ink-soft hover:bg-sunken">
            <ZoomIn className="mx-auto size-4" />
          </button>
          <button type="button" onClick={fitZoom} className="h-9 rounded-lg px-2 text-sm font-medium text-ink-soft hover:bg-sunken">
            Fit
          </button>
          <span className="ml-2 hidden text-sm text-muted sm:inline">
            {layout.width} × {layout.height} {layout.unit} · grid {layout.gridSize} {layout.unit}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_1fr_300px]">
        {/* Palette */}
        {canEdit && (
          <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 xl:max-h-[640px] xl:overflow-y-auto">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Add to plan</p>
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
              {palette.map((p) => (
                <button key={p.type} type="button" onClick={() => addObject(p.type)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken">
                  <span
                    className={cn("inline-block shrink-0", p.shape === "ellipse" ? "size-5 rounded-full" : p.shape === "line" ? "h-1 w-5 rounded" : "h-4 w-5 rounded-sm")}
                    style={{ background: p.shape === "line" ? p.stroke : p.fill, border: p.shape === "line" ? undefined : `1.5px ${p.dashed ? "dashed" : "solid"} ${p.stroke}` }}
                    aria-hidden
                  />
                  {p.label}
                </button>
              ))}
            </div>
            {kind === "garden" && plants.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">Plants</p>
                <p className="text-xs text-muted">Drag onto a bed, or tap one then tap a bed.</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
                  <input value={plantQuery} onChange={(e) => setPlantQuery(e.target.value)} placeholder="Find a plant" aria-label="Find a plant" className="h-8 w-full rounded-lg border border-line-strong bg-surface pl-7 text-sm" />
                </div>
                <ul className="flex flex-col gap-0.5">
                  {filteredPlants.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setPlantDrag({ plant: p, x: e.clientX, y: e.clientY });
                        }}
                        onClick={() => setArmedPlant((a) => (a?.id === p.id ? null : p))}
                        className={cn("flex w-full touch-none items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-sunken", armedPlant?.id === p.id && "bg-primary-50 ring-1 ring-primary-300")}
                      >
                        <PlantAvatar imageUrl={p.imageUrl} photoUrl={p.photoUrl} name={p.name} category={p.category} size="xs" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}

        {/* Canvas */}
        <div ref={canvasRef} className={cn("relative overflow-auto rounded-2xl border border-line bg-[#fbfaf6]", !canEdit && "xl:col-span-2")} style={{ maxHeight: 640 }}>
          <svg
            ref={svgRef}
            width={W * zoom}
            height={H * zoom}
            viewBox={`0 0 ${W} ${H}`}
            className="block touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDrag(null)}
            onPointerLeave={() => setDrag(null)}
            onPointerDown={(e) => {
              if (e.target === svgRef.current || (e.target as Element).getAttribute("data-bg")) setSelected(null);
            }}
            role="application"
            aria-label={`${kind === "garden" ? "Garden" : "Farm"} blueprint canvas`}
          >
            <defs>
              <pattern id="grid-minor" width={S * grid} height={S * grid} patternUnits="userSpaceOnUse">
                <path d={`M ${S * grid} 0 L 0 0 0 ${S * grid}`} fill="none" stroke="#ece6e2" strokeWidth={1} />
              </pattern>
              <pattern id="grid-major" width={S * grid * 5} height={S * grid * 5} patternUnits="userSpaceOnUse">
                <rect width={S * grid * 5} height={S * grid * 5} fill="url(#grid-minor)" />
                <path d={`M ${S * grid * 5} 0 L 0 0 0 ${S * grid * 5}`} fill="none" stroke="#ddd3d6" strokeWidth={1.2} />
              </pattern>
            </defs>
            <rect data-bg="1" width={W} height={H} fill="url(#grid-major)" />
            {objects.map((o) => {
              const meta = paletteItem(kind, o.type) ?? palette[0]!;
              const w = o.w * S;
              const h = o.h * S;
              const isSel = o.key === selected;
              const fill = o.color ?? meta.fill;
              const chips = byBed.get(o.key) ?? [];
              const plantable = kind === "garden" && meta.plantable;
              return (
                <g
                  key={o.key}
                  transform={`translate(${o.x * S} ${o.y * S}) rotate(${o.rotation} ${w / 2} ${h / 2})`}
                  data-bed-key={plantable ? o.key : undefined}
                  className={canEdit ? "cursor-move" : "cursor-pointer"}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (armedPlant && plantable && onAddPlanting) {
                      const plant = armedPlant;
                      setArmedPlant(null);
                      plantInto(o.key, plant);
                      return;
                    }
                    setSelected(o.key);
                    if (!canEdit) return;
                    (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture?.(e.pointerId);
                    const p = toUnits(e.clientX, e.clientY);
                    setDrag({ mode: "move", key: o.key, dx: p.x - o.x, dy: p.y - o.y });
                  }}
                >
                  {meta.shape === "ellipse" ? (
                    <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={meta.stroke} strokeWidth={2} strokeDasharray={meta.dashed ? "8 6" : undefined} />
                  ) : meta.shape === "line" ? (
                    <rect width={w} height={Math.max(h, 0.3) * S} rx={3} fill={o.color ?? meta.stroke} strokeDasharray={meta.dashed ? "10 6" : undefined} />
                  ) : (
                    <rect width={w} height={h} rx={6} fill={fill} stroke={meta.stroke} strokeWidth={2} strokeDasharray={meta.dashed ? "8 6" : undefined} />
                  )}
                  {meta.shape !== "line" && (
                    <foreignObject x={4} y={4} width={Math.max(0, w - 8)} height={Math.max(0, h - 8)} className="pointer-events-none overflow-hidden">
                      <div className="flex h-full flex-col gap-1 overflow-hidden text-[11px] leading-tight">
                        <span className="truncate font-semibold text-ink-soft">{o.label}</span>
                        {plantable && (
                          <div className="flex flex-wrap gap-1">
                            {chips.map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-white/85 py-0.5 pr-1.5 pl-0.5 shadow-sm" title={`${c.name} · ${c.quantity} plants${c.spacingIn ? ` · ${Number(c.spacingIn)}″ spacing` : ""}`}>
                                <PlantAvatar imageUrl={c.imageUrl} photoUrl={c.photoUrl} name={c.name} category={c.category} size="xs" className="size-4 text-[10px]" />
                                <span className="max-w-20 truncate">{c.name}</span>
                                <span className="text-muted">×{c.quantity}</span>
                                {c.spacingIn && <span className="text-muted">{Number(c.spacingIn)}″</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </foreignObject>
                  )}
                  {meta.shape === "line" && o.label && (
                    <text x={w / 2} y={-6} textAnchor="middle" fontSize={11} fill="#4a3946" className="pointer-events-none">
                      {o.label}
                    </text>
                  )}
                  {isSel && (
                    <>
                      <rect x={-4} y={-4} width={w + 8} height={(meta.shape === "line" ? Math.max(h, 0.3) * S : h) + 8} rx={8} fill="none" stroke="#6a2d5e" strokeWidth={2} strokeDasharray="6 4" className="pointer-events-none" />
                      {canEdit && (
                        <>
                          {/* rotate handle */}
                          <line x1={w / 2} y1={-4} x2={w / 2} y2={-26} stroke="#6a2d5e" strokeWidth={1.5} />
                          <circle
                            cx={w / 2}
                            cy={-30}
                            r={8}
                            fill="#fff"
                            stroke="#6a2d5e"
                            strokeWidth={2}
                            className="cursor-grab"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDrag({ mode: "rotate", key: o.key });
                            }}
                          >
                            <title>Rotate</title>
                          </circle>
                          {/* resize handle */}
                          <rect
                            x={w - 7}
                            y={(meta.shape === "line" ? Math.max(h, 0.3) * S : h) - 7}
                            width={14}
                            height={14}
                            rx={3}
                            fill="#6a2d5e"
                            className="cursor-nwse-resize"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setDrag({ mode: "resize", key: o.key });
                            }}
                          >
                            <title>Resize</title>
                          </rect>
                        </>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {layout.objects.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted">
              <MousePointerClick className="size-8" aria-hidden />
              <p className="max-w-xs text-[15px]">{canEdit ? "Add beds, paths and structures from the left, then drag to arrange them." : "This plan is empty."}</p>
            </div>
          )}
        </div>

        {/* Inspector */}
        <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 xl:max-h-[640px] xl:overflow-y-auto">
          {!sel ? (
            <>
              <p className="font-semibold">Plan</p>
              <p className="text-sm text-muted">Select something on the canvas to edit it. Drag to move; use the square to resize and the circle to rotate.</p>
              {canEdit && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    Width ({layout.unit})
                    <input type="number" min={5} max={5000} value={layout.width} onChange={(e) => (setLayout((l) => ({ ...l, width: Math.max(5, Number(e.target.value) || 5) })), setDirty(true))} className="h-9 rounded-lg border border-line-strong px-2" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Height ({layout.unit})
                    <input type="number" min={5} max={5000} value={layout.height} onChange={(e) => (setLayout((l) => ({ ...l, height: Math.max(5, Number(e.target.value) || 5) })), setDirty(true))} className="h-9 rounded-lg border border-line-strong px-2" />
                  </label>
                </div>
              )}
              <p className="text-xs text-muted">Shortcuts: arrows to nudge, Delete to remove, Ctrl/⌘+D duplicate, Ctrl/⌘+S save.</p>
              <ul className="flex flex-col gap-1 text-sm">
                {objects
                  .slice()
                  .reverse()
                  .map((o) => (
                    <li key={o.key}>
                      <button type="button" onClick={() => setSelected(o.key)} className="w-full truncate rounded-md px-2 py-1 text-left hover:bg-sunken">
                        {o.label ?? o.type}
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{selMeta?.label ?? sel.type}</p>
                {canEdit && (
                  <div className="flex">
                    <button type="button" aria-label="Duplicate" title="Duplicate" onClick={() => duplicate(sel.key)} className="size-8 rounded-lg text-ink-soft hover:bg-sunken">
                      <Copy className="mx-auto size-4" />
                    </button>
                    <button type="button" aria-label="Bring to front" title="Bring to front" onClick={() => reorder(sel.key, "front")} className="size-8 rounded-lg text-ink-soft hover:bg-sunken">
                      <ArrowUpToLine className="mx-auto size-4" />
                    </button>
                    <button type="button" aria-label="Send to back" title="Send to back" onClick={() => reorder(sel.key, "back")} className="size-8 rounded-lg text-ink-soft hover:bg-sunken">
                      <ArrowDownToLine className="mx-auto size-4" />
                    </button>
                    <button type="button" aria-label="Delete" title="Delete" onClick={() => remove(sel.key)} className="size-8 rounded-lg text-wine-500 hover:bg-wine-50">
                      <Trash2 className="mx-auto size-4" />
                    </button>
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Name
                <input value={sel.label ?? ""} disabled={!canEdit} onChange={(e) => patch(sel.key, { label: e.target.value.slice(0, 60) })} className="h-9 rounded-lg border border-line-strong px-2" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["w", "h", "x", "y"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-sm">
                    {{ w: "Width", h: "Depth", x: "X", y: "Y" }[k]} ({layout.unit})
                    <input
                      type="number"
                      step={grid / 2}
                      value={sel[k]}
                      disabled={!canEdit || (k === "h" && selMeta?.shape === "line")}
                      onChange={(e) => patch(sel.key, { [k]: k === "w" || k === "h" ? Math.max(0.3, Number(e.target.value) || 0.3) : Number(e.target.value) || 0 })}
                      className="h-9 rounded-lg border border-line-strong px-2 disabled:bg-sunken"
                    />
                  </label>
                ))}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 text-sm">
                  Rotation
                  <button type="button" aria-label="Rotate left 15°" onClick={() => patch(sel.key, { rotation: (sel.rotation + 345) % 360 })} className="size-8 rounded-lg border border-line hover:bg-sunken">
                    <RotateCcw className="mx-auto size-4" />
                  </button>
                  <span className="w-10 text-center tabular-nums">{sel.rotation}°</span>
                  <button type="button" aria-label="Rotate right 15°" onClick={() => patch(sel.key, { rotation: (sel.rotation + 15) % 360 })} className="size-8 rounded-lg border border-line hover:bg-sunken">
                    <RotateCw className="mx-auto size-4" />
                  </button>
                </div>
              )}
              {canEdit && selMeta?.shape !== "line" && (
                <div className="flex flex-col gap-1.5 text-sm">
                  Colour
                  <div className="flex flex-wrap gap-1.5">
                    {[undefined, "#ece9d8", "#e9edd6", "#f3e3ef", "#f0dde2", "#ecebef", "#e3d9cf", "#dfe6ee"].map((c) => (
                      <button key={c ?? "default"} type="button" aria-label={c ? `Colour ${c}` : "Default colour"} onClick={() => patch(sel.key, { color: c })} className={cn("size-7 rounded-full border-2", sel.color === c ? "border-ink" : "border-line")} style={{ background: c ?? selMeta?.fill }} />
                    ))}
                  </div>
                </div>
              )}
              {kind === "garden" && selMeta?.plantable && (
                <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
                  <p className="text-sm font-semibold">Plants in {sel.label}</p>
                  {(byBed.get(sel.key) ?? []).length === 0 && <p className="text-sm text-muted">Drag plants here from the list.</p>}
                  <ul className="flex flex-col gap-1.5">
                    {(byBed.get(sel.key) ?? []).map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <PlantAvatar imageUrl={c.imageUrl} photoUrl={c.photoUrl} name={c.name} category={c.category} size="xs" />
                        <span className="flex-1 truncate">
                          {c.name}
                          {c.spacingIn && <span className="text-muted"> · {Number(c.spacingIn)}″</span>}
                        </span>
                        {onUpdatePlanting && (
                          <span className="flex items-center rounded-full border border-line">
                            <button type="button" aria-label={`Fewer ${c.name}`} onClick={() => c.quantity > 1 && startPlant(() => onUpdatePlanting(c.id, c.quantity - 1))} className="size-7 text-muted">
                              <Minus className="mx-auto size-3" />
                            </button>
                            <span className="w-6 text-center tabular-nums">{c.quantity}</span>
                            <button type="button" aria-label={`More ${c.name}`} onClick={() => startPlant(() => onUpdatePlanting(c.id, c.quantity + 1))} className="size-7 text-muted">
                              <Plus className="mx-auto size-3" />
                            </button>
                          </span>
                        )}
                        {onRemovePlanting && (
                          <button type="button" aria-label={`Remove ${c.name}`} onClick={() => startPlant(() => onRemovePlanting(c.id))} className="size-7 rounded-full text-muted hover:text-wine-500">
                            <Trash2 className="mx-auto size-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {armedPlant && <p className="text-xs text-primary-700">Tap a bed to plant {armedPlant.name}.</p>}
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {plantDrag && (
        <div className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-surface px-2 py-1 text-sm shadow-[var(--shadow-pop)]" style={{ left: plantDrag.x, top: plantDrag.y }}>
          <PlantAvatar imageUrl={plantDrag.plant.imageUrl} photoUrl={plantDrag.plant.photoUrl} name={plantDrag.plant.name} category={plantDrag.plant.category} size="xs" />
          {plantDrag.plant.name}
        </div>
      )}
    </div>
  );
}
