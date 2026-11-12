"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, CheckCircle2, Keyboard, LoaderCircle, ScanBarcode } from "lucide-react";
import { lookupBarcode, saveInventoryItem, type ProductLookup } from "@/app/actions/kitchen";
import { ActionForm } from "@/components/forms/action-form";
import { InventoryFields } from "@/components/kitchen/inventory-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * Phone-camera barcode scanner using the native BarcodeDetector API
 * (Chrome, Edge, Android). Falls back to typing the number on other browsers.
 */
export function Scanner({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported] = useState(() => typeof window !== "undefined" && !!window.BarcodeDetector);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "error">("off");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [lookup, setLookup] = useState<ProductLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [saved, setSaved] = useState<number>(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  const identify = useCallback(
    async (code: string) => {
      stop();
      setBarcode(code);
      setLooking(true);
      setLookup(await lookupBarcode(code));
      setLooking(false);
    },
    [stop],
  );

  const startCamera = async () => {
    if (!window.BarcodeDetector) return;
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const found = await detector.detect(video);
          if (found[0]?.rawValue) {
            navigator.vibrate?.(60);
            await identify(found[0].rawValue);
            return;
          }
        } catch {
          /* frame not ready */
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      setCamera("error");
    }
  };

  useEffect(() => stop, [stop]);

  const reset = () => {
    setBarcode(null);
    setLookup(null);
    setManual("");
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      {saved > 0 && !barcode && (
        <p className="flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-[15px] text-primary-700">
          <CheckCircle2 className="size-5" /> Saved! Scan the next item, or{" "}
          <button type="button" onClick={() => router.push("/kitchen")} className="font-semibold underline">
            go to the kitchen
          </button>
          .
        </p>
      )}

      {!barcode && (
        <Card className="flex flex-col items-center gap-4 p-4 sm:p-5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-primary-800">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {camera === "on" && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary-300 shadow-[0_0_12px_#c991c4]" />}
            {camera !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
                <ScanBarcode className="size-12" aria-hidden />
                <p className="text-[15px]">{supported ? "Point your camera at a barcode." : "Camera scanning isn't supported in this browser. Type the barcode number below."}</p>
              </div>
            )}
          </div>
          {supported && (
            <Button onClick={camera === "on" ? stop : startCamera} disabled={camera === "starting"} variant={camera === "on" ? "secondary" : "primary"} icon={camera === "on" ? <CameraOff className="size-4" /> : <Camera className="size-4" />}>
              {camera === "on" ? "Stop camera" : camera === "starting" ? "Starting…" : "Start scanning"}
            </Button>
          )}
          {camera === "error" && <p className="text-sm text-wine-700">We couldn&apos;t open the camera. Check camera permissions, or enter the number below.</p>}
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) identify(manual.trim());
            }}
          >
            <label htmlFor="manual-barcode" className="sr-only">
              Barcode number
            </label>
            <Input id="manual-barcode" inputMode="numeric" placeholder="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
            <Button type="submit" variant="secondary" icon={<Keyboard className="size-4" />}>
              Look up
            </Button>
          </form>
        </Card>
      )}

      {barcode && looking && (
        <Card className="flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin text-primary-600" /> Looking up {barcode}…
        </Card>
      )}

      {barcode && lookup && (
        <Card>
          <div className="mb-4 flex items-start gap-3">
            {lookup.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lookup.imageUrl} alt="" className="size-16 rounded-xl object-contain" />
            )}
            <div>
              <p className="font-semibold">{lookup.found ? `Found: ${lookup.name}` : "New product"}</p>
              <p className="text-sm text-muted">
                Barcode {barcode}
                {lookup.source === "family" && " · scanned before"}
                {lookup.source === "openfoodfacts" && " · from Open Food Facts"}
              </p>
              {lookup.message && <p className="mt-1 text-sm text-ink-soft">{lookup.message}</p>}
            </div>
          </div>
          <ActionForm
            action={saveInventoryItem}
            submitLabel="Save to inventory"
            onSuccess={() => {
              setSaved((n) => n + 1);
              reset();
            }}
            footer={
              <Button variant="ghost" onClick={reset}>
                Scan another
              </Button>
            }
          >
            <InventoryFields
              categories={categories}
              d={{ barcode, name: lookup.name ?? "", brand: lookup.brand ?? null, productImageUrl: lookup.imageUrl ?? null, unit: lookup.unit ?? null, location: lookup.location ?? "pantry" }}
            />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
