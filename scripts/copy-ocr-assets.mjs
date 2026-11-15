/**
 * Copies the receipt-scanning OCR engine (tesseract.js worker + WebAssembly core + English
 * language data) into public/ocr so phones load it from this site, not a third-party CDN.
 * Receipt photos never leave the device. Runs before `next dev` and `next build`.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "public", "ocr");
const nm = (...p) => path.join(root, "node_modules", ...p);
fs.mkdirSync(path.join(out, "core"), { recursive: true });
fs.copyFileSync(nm("tesseract.js", "dist", "worker.min.js"), path.join(out, "worker.min.js"));
for (const f of fs.readdirSync(nm("tesseract.js-core"))) {
  if (/^tesseract-core.*\.wasm\.js$/.test(f)) fs.copyFileSync(nm("tesseract.js-core", f), path.join(out, "core", f));
}
fs.copyFileSync(nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), path.join(out, "eng.traineddata.gz"));
console.log("ocr: assets ready in public/ocr");
