/**
 * Generates the installable-app icons from the brand mark (src/components/brand.tsx).
 * Run: node scripts/generate-icons.mjs  (outputs to public/icons, committed).
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const mark = (scale = 1) => {
  // House + leaf, drawn in a 40×40 box, scaled around the centre.
  const t = `translate(20 20) scale(${scale}) translate(-20 -20)`;
  return `<g transform="${t}">
    <path d="M10 20.5 20 12l10 8.5V29a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 10 29z" fill="#fffdfb"/>
    <path d="M20 30.5v-7c0-2.6 2-4.6 4.8-4.8-.1 2.7-2.2 4.8-4.8 4.8" fill="none" stroke="#8e4e7b" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M20 30.5v-5c0-1.9-1.5-3.4-3.6-3.6.1 2 1.6 3.6 3.6 3.6" fill="none" stroke="#6d6a3c" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="29.5" cy="11" r="2.5" fill="#c991c4"/>
  </g>`;
};
// "any": rounded square like the in-app mark. "full": edge-to-edge for maskable / iOS (the OS rounds it).
const svg = (variant, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${
    variant === "any" ? '<rect width="40" height="40" rx="9" fill="#2d0f26"/>' : '<rect width="40" height="40" fill="#2d0f26"/>'
  }${mark(scale)}</svg>`;

await mkdir("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, "any", 1.15],
  ["icon-512.png", 512, "any", 1.15],
  ["maskable-192.png", 192, "full", 0.9],
  ["maskable-512.png", 512, "full", 0.9],
  ["apple-touch-icon.png", 180, "full", 1.05],
  ["favicon-32.png", 32, "any", 1.2],
];
for (const [name, size, variant, scale] of out) {
  await sharp(Buffer.from(svg(variant, scale)), { density: 600 }).resize(size, size).png().toFile(`public/icons/${name}`);
  console.log("wrote public/icons/" + name);
}

// favicon.ico: an ICO container holding the 32px PNG (supported by every current browser).
import { readFile, writeFile } from "node:fs/promises";
const png = await readFile("public/icons/favicon-32.png");
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0); // width
entry.writeUInt8(32, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // data offset
await writeFile("src/app/favicon.ico", Buffer.concat([header, entry, png]));
console.log("wrote src/app/favicon.ico");
