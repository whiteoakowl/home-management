"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Plus, Receipt, Trash2, Upload } from "lucide-react";
import { importReceipt } from "@/app/actions/receipts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { parseReceipt, sameProduct, type ReceiptItem } from "@/lib/receipt";
import { cn } from "@/lib/utils";

type Existing = { id: string; name: string; quantity: string; unit: string | null };
type Row = ReceiptItem & { key: number; include: boolean; expiresOn: string; mergeWith: string; priceText: string };

const CATEGORIES = ["produce", "meat", "dairy", "pantry", "frozen", "household", "personal", "garden", "farm", "other"] as const;
const LOCATIONS = ["pantry", "fridge", "freezer", "supplies", "farm", "garden", "other"] as const;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const input = "h-11 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[15px] focus:border-primary-500 focus:outline-none";

/** Shrink and grey a photo before OCR: faster on phones, and often more accurate. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't an image we can read. Try a JPG or PNG photo of the receipt."));
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d")!;
    ctx.filter = "grayscale(1) contrast(1.4)";
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Scan or upload a receipt → read it on this device (OCR) → review every item →
 * add the selected ones to the Family Pantry or My Pantry. Nothing is added without review.
 */
export function ReceiptImporter({
  family,
  mine,
  existingFamily,
  existingMine,
  canBudget,
  budgetCategories,
}: {
  family: boolean;
  mine: boolean;
  existingFamily: Existing[];
  existingMine: Existing[];
  canBudget: boolean;
  budgetCategories: string[];
}) {
  const [step, setStep] = useState<"pick" | "reading" | "review">("pick");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [space, setSpace] = useState<"family" | "mine">(family ? "family" : "mine");
  const [state, action] = useActionState(importReceipt, undefined);
  const [pending, start] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  const existing = space === "mine" ? existingMine : existingFamily;

  const matchFor = (name: string) => existing.find((e) => sameProduct(e.name, name))?.id ?? "";
  const toRows = (items: ReceiptItem[]): Row[] =>
    items.map((it) => ({ ...it, key: nextKey.current++, include: true, expiresOn: "", mergeWith: matchFor(it.name), priceText: it.priceCents != null ? (it.priceCents / 100).toFixed(2) : "" }));

  async function read(f: File) {
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep("reading");
    setProgress(0);
    try {
      const canvas = await prepare(f);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr",
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      const parsed = parseReceipt(data.text);
      setText(data.text);
      setStore(parsed.store ?? "");
      setDate(parsed.date ?? "");
      setTotal(parsed.totalCents != null ? (parsed.totalCents / 100).toFixed(2) : "");
      setRows(toRows(parsed.items));
      setStep("review");
    } catch (e) {
      setError((e as Error).message || "We couldn't read that receipt. Try a sharper, well-lit photo, or add the items by hand.");
      setStep("pick");
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include);

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set(
      "items",
      JSON.stringify(
        rows.map((r) => ({
          include: r.include,
          name: r.name,
          quantity: Number(r.quantity) || 1,
          unit: r.unit || null,
          priceCents: r.priceText ? Math.round(Number(r.priceText) * 100) : null,
          category: r.category,
          location: r.location,
          expiresOn: r.expiresOn || null,
          mergeWith: r.mergeWith || null,
        })),
      ),
    );
    if (space === "mine") fd.set("space", "mine");
    if (file) fd.set("image", file);
    start(() => action(fd));
  }

  if (step !== "review") {
    return (
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Receipt className="size-7" aria-hidden />
        </span>
        {step === "reading" ? (
          <>
            <p className="text-lg font-semibold">Reading your receipt…</p>
            <div className="h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary-500 transition-[width]" style={{ width: `${Math.max(5, progress)}%` }} />
            </div>
            <p className="text-sm text-muted">This happens on your device. The photo isn&apos;t sent anywhere to be read.</p>
          </>
        ) : (
          <>
            <p className="max-w-md text-[15px] text-ink-soft">Take a photo of a grocery receipt, or upload one. You&apos;ll check every item before anything is added to the pantry.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button icon={<Camera className="size-4" />} onClick={() => scanRef.current?.click()}>
                Scan Receipt
              </Button>
              <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => uploadRef.current?.click()}>
                Upload Receipt
              </Button>
            </div>
            <input ref={scanRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
            <input ref={uploadRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
            {error && <p role="alert" className="text-sm text-wine-700">{error}</p>}
            <button type="button" onClick={() => setStep("review")} className="text-sm font-medium text-primary-700 underline">
              Or add items by hand
            </button>
          </>
        )}
      </Card>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      className="flex flex-col gap-5"
    >
      <FormMessage message={state?.message} tone={state?.ok ? "success" : "error"} />
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Review Grocery Import</h2>
        <p className="-mt-2 text-sm text-muted">Check each item: fix names, quantities, prices and where it&apos;s stored. Untick anything you don&apos;t want added.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            Store
            <input name="store" value={store} onChange={(e) => setStore(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            Date
            <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
            Total ($)
            <input name="total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className={input} />
          </label>
        </div>
        {family && mine && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink-soft">Add to</legend>
            {(["family", "mine"] as const).map((s) => (
              <label key={s} className={cn("relative flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-medium", space === s ? (s === "mine" ? "border-olive-400 bg-olive-50 text-olive-700" : "border-primary-500 bg-primary-50 text-primary-700") : "border-line-strong")}>
                <input
                  type="radio"
                  name="spaceChoice"
                  checked={space === s}
                  onChange={() => {
                    setSpace(s);
                    setRows((rs) => rs.map((r) => ({ ...r, mergeWith: (s === "mine" ? existingMine : existingFamily).find((e) => sameProduct(e.name, r.name))?.id ?? "" })));
                  }}
                  className="sr-only"
                />
                {s === "family" ? "Family Pantry" : "My Pantry (private)"}
              </label>
            ))}
          </fieldset>
        )}
      </Card>

      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const match = existing.find((e) => e.id === r.mergeWith) ?? existing.find((e) => sameProduct(e.name, r.name));
          return (
            <li key={r.key}>
              <Card className={cn("flex flex-col gap-3 !p-4", !r.include && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <label className="mt-2.5 flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} className="size-5 accent-[var(--color-primary-600)]" aria-label={`Add ${r.name || "item"} to pantry`} />
                  </label>
                  <input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="Item" placeholder="Item name" className={cn(input, "flex-1 font-medium")} />
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name}`} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wine-50 hover:text-wine-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Quantity
                    <input inputMode="decimal" value={r.quantity} onChange={(e) => update(r.key, { quantity: Number(e.target.value) || 0 })} className={input} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Price ($)
                    <input inputMode="decimal" value={r.priceText} onChange={(e) => update(r.key, { priceText: e.target.value })} className={input} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Category
                    <select value={r.category} onChange={(e) => update(r.key, { category: e.target.value as Row["category"] })} className={input}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {cap(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                    Store in
                    <select value={r.location} onChange={(e) => update(r.key, { location: e.target.value as Row["location"] })} className={input}>
                      {LOCATIONS.map((c) => (
                        <option key={c} value={c}>
                          {cap(c)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-1">
                    Expires (optional)
                    <input type="date" value={r.expiresOn} onChange={(e) => update(r.key, { expiresOn: e.target.value })} className={input} />
                  </label>
                </div>
                {match && r.include && (
                  <label className="flex flex-col gap-1 rounded-lg bg-mist-50 p-2.5 text-sm text-mist-700">
                    Already in the pantry: {match.name} ({Number(match.quantity)}
                    {match.unit ? ` ${match.unit}` : ""})
                    <select value={r.mergeWith} onChange={(e) => update(r.key, { mergeWith: e.target.value })} className={cn(input, "h-10")}>
                      <option value={match.id}>Add to existing inventory</option>
                      <option value="">Create a new item</option>
                    </select>
                  </label>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        icon={<Plus className="size-4" />}
        onClick={() => setRows((rs) => [...rs, { key: nextKey.current++, name: "", quantity: 1, unit: null, priceCents: null, priceText: "", category: "other", location: "pantry", include: true, expiresOn: "", mergeWith: "" }])}
      >
        Add an item
      </Button>

      <Card className="flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="saveReceipt" defaultChecked className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            Save this receipt to receipt history
            <span className="block text-xs text-muted">Store, date, total and items. Searchable later.</span>
          </span>
        </label>
        {file && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="keepImage" defaultChecked className="size-4 accent-[var(--color-primary-600)]" /> Keep the photo with the saved receipt
          </label>
        )}
        {canBudget && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="createExpense" className="size-4 accent-[var(--color-primary-600)]" /> Also record the total as a household expense in
            </label>
            <select name="expenseCategory" defaultValue={budgetCategories.find((c) => /grocer/i.test(c)) ?? "Groceries"} className="h-10 rounded-lg border border-line-strong bg-surface px-2">
              {[...new Set(["Groceries", ...budgetCategories])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-soft">
          Notes (optional)
          <textarea name="notes" rows={2} className="rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2 text-[15px]" />
        </label>
      </Card>

      {(preview || text) && (
        <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">See the receipt and the text we read</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && <img src={preview} alt="Your receipt" className="max-h-96 rounded-lg border border-line object-contain" />}
            {text && <pre className="max-h-96 overflow-auto rounded-lg bg-sunken p-3 text-xs whitespace-pre-wrap">{text}</pre>}
          </div>
        </details>
      )}

      <div className="sticky bottom-24 z-10 flex justify-end sm:bottom-4">
        <Button type="submit" disabled={pending} className="shadow-[var(--shadow-pop)]">
          {pending ? "Adding…" : `Add ${chosen.length} Selected Item${chosen.length === 1 ? "" : "s"} to ${space === "mine" ? "My Pantry" : "Family Pantry"}`}
        </Button>
      </div>
    </form>
  );
}
