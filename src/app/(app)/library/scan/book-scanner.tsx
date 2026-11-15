"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Keyboard, LoaderCircle, ScanBarcode } from "lucide-react";
import { lookupIsbn, saveBook, type IsbnLookupResult } from "@/app/actions/library";
import { ActionForm } from "@/components/forms/action-form";
import type { MemberOption } from "@/components/forms/fields";
import { BookFields } from "@/components/library/book-fields";
import { useBarcodeCamera, type BarcodeFormat } from "@/components/scan/use-barcode-camera";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";

const FORMATS: BarcodeFormat[] = ["ean_13", "upc_a"];

/**
 * Scan (or type) an ISBN → look the book up → confirm or edit every detail →
 * save. Nothing is saved until the person presses "Add to library".
 */
export function BookScanner({ categories, members }: { categories: { id: string; name: string }[]; members: MemberOption[] }) {
  const [code, setCode] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<IsbnLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const identify = useCallback(async (raw: string) => {
    setCode(raw);
    setLooking(true);
    setResult(null);
    try {
      setResult(await lookupIsbn(raw));
    } catch {
      setResult({ ok: false, message: "Something went wrong looking that up. Enter the details below." });
    }
    setLooking(false);
  }, []);
  const { videoRef, camera, start, stop, supported } = useBarcodeCamera({ formats: FORMATS, onDetect: identify });

  const reset = () => {
    setCode(null);
    setResult(null);
    setManual("");
  };
  const b = result?.book;
  const badIsbn = result && !result.ok && !result.isbn;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {added.length > 0 && !code && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-[15px] text-primary-700">
          <CheckCircle2 className="size-5" /> Added {added.at(-1)}. Scan the next book, or{" "}
          <Link href="/library/books?sort=recent" className="font-semibold underline">
            see your library
          </Link>
          .
        </p>
      )}

      {(!code || badIsbn) && (
        <Card className="flex flex-col items-center gap-4 p-4 sm:p-5">
          <div className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl bg-[#141a33]">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {camera === "on" && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-[#e0c27e] shadow-[0_0_12px_#e0c27e]" />}
            {camera !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/90">
                <ScanBarcode className="size-12" aria-hidden />
                <p className="text-[15px]">{supported ? "Point your camera at the barcode on the back cover (it starts with 978 or 979)." : "This browser can't open the camera. Type the ISBN below."}</p>
              </div>
            )}
          </div>
          {supported && (
            <Button onClick={camera === "on" ? stop : start} disabled={camera === "starting"} variant={camera === "on" ? "secondary" : "primary"} icon={camera === "on" ? <CameraOff className="size-4" /> : <Camera className="size-4" />}>
              {camera === "on" ? "Stop camera" : camera === "starting" ? "Starting…" : "Start scanning"}
            </Button>
          )}
          {camera === "error" && <p className="text-sm text-wine-700">We couldn&apos;t open the camera. Allow camera access in your browser settings, or type the ISBN below.</p>}
          {badIsbn && (
            <p role="alert" className="text-sm text-wine-700">
              {result?.message}
            </p>
          )}
          <form
            className="flex w-full max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) {
                stop();
                identify(manual.trim());
              }
            }}
          >
            <label htmlFor="manual-isbn" className="sr-only">
              ISBN
            </label>
            <Input id="manual-isbn" inputMode="numeric" placeholder="Or type the ISBN (10 or 13 digits)" value={manual} onChange={(e) => setManual(e.target.value)} />
            <Button type="submit" variant="secondary" icon={<Keyboard className="size-4" />}>
              Look up
            </Button>
          </form>
          <p className="text-sm text-muted">
            No barcode?{" "}
            <Link href="/library/add" className="font-medium text-primary-700 underline">
              Add the book manually
            </Link>
            .
          </p>
        </Card>
      )}

      {code && looking && (
        <Card className="flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin text-primary-600" /> Looking up {code}…
        </Card>
      )}

      {code && result && !badIsbn && (
        <Card>
          <div className="mb-5 flex flex-col gap-2">
            <p className="font-display text-xl font-semibold">{b ? "Is this the right book?" : "Add this book"}</p>
            <p className="text-sm text-muted">
              ISBN {result.isbn}. {b ? "Check the details, change anything that's off, then add it." : result.message}
            </p>
            {result.existing && (
              <p className="flex items-start gap-2 rounded-xl bg-olive-50 px-3 py-2 text-sm text-olive-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  You already have{" "}
                  <Link href={`/library/books/${result.existing.id}`} className="font-semibold underline">
                    {result.existing.title}
                  </Link>
                  . Add it again only if this is another copy.
                </span>
              </p>
            )}
          </div>
          <ActionForm
            key={result.isbn}
            action={saveBook}
            submitLabel="Add to library"
            onSuccess={() => {
              setAdded((a) => [...a, b?.title ? `"${b.title}"` : "the book"]);
              reset();
            }}
            footer={
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            }
          >
            <BookFields
              categories={categories}
              members={members}
              d={{
                isbn: result.isbn,
                title: b?.title,
                subtitle: b?.subtitle,
                author: b?.author,
                coAuthor: b?.coAuthor,
                publisher: b?.publisher,
                publishedDate: b?.publishedDate,
                description: b?.description,
                genre: b?.genre,
                pageCount: b?.pageCount,
                coverPreview: b?.coverUrl,
                coverUrl: b?.coverUrl,
                status: "not_started",
              }}
            />
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
