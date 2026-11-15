/**
 * Runs after `next build` (see package.json "build"). Makes the built CSS work on the older
 * browsers in package.json "browserslist" (iOS/iPadOS 15, Chrome 80+ on Android 8+):
 *
 * 1. Flattens cascade layers (@layer). Browsers without layer support (Chrome < 99,
 *    Safari < 15.4) would otherwise ignore every style in them, i.e. the whole design.
 * 2. Lowers modern syntax for the target browsers (lightningcss).
 * 3. Adds fallbacks the tools above don't: `vh` before `dvh`/`svh`/`lvh`,
 *    `overflow: hidden` before `overflow: clip`, and `transform` for the
 *    `translate` / `scale` properties where those aren't supported.
 *
 * Modern browsers keep using the modern values; older ones fall back.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const postcss = require("postcss");
const { transform, browserslistToTargets } = require("lightningcss");
const browserslist = require("browserslist");
const { default: cascadeLayers } = await import("@csstools/postcss-cascade-layers");

const targets = browserslistToTargets(browserslist(undefined, { path: root }));

/** Fallbacks for properties and units older browsers don't understand. */
const fallbacks = () => ({
  postcssPlugin: "legacy-fallbacks",
  Declaration(decl) {
    if (decl.__legacyDone) return;
    // 100dvh → 100vh first (older browsers skip the dvh line and keep vh).
    if (/\d(?:dvh|svh|lvh)\b/.test(decl.value)) {
      const prev = decl.prev();
      const value = decl.value.replace(/(\d)(?:dvh|svh|lvh)\b/g, "$1vh");
      if (!(prev && prev.type === "decl" && prev.prop === decl.prop && prev.value === value)) {
        decl.cloneBefore({ value }).__legacyDone = true;
      }
    }
    if (decl.prop === "overflow" && decl.value === "clip") {
      const prev = decl.prev();
      if (!(prev && prev.type === "decl" && prev.prop === "overflow" && prev.value === "hidden")) {
        decl.cloneBefore({ value: "hidden" }).__legacyDone = true;
      }
    }
    decl.__legacyDone = true;
  },
  Rule(rule) {
    if (rule.__legacyDone || rule.parent?.type === "atrule" && rule.parent.name === "supports") return;
    rule.__legacyDone = true;
    const fns = [];
    rule.each((d) => {
      if (d.type !== "decl") return;
      if (d.prop === "translate") {
        const [x = "0", y = "0"] = d.value.split(/\s+(?![^(]*\))/);
        fns.push(`translate(${x}, ${y})`);
      } else if (d.prop === "scale") {
        const [x = "1", y = x] = d.value.split(/\s+(?![^(]*\))/);
        fns.push(`scale(${x}, ${y})`);
      }
    });
    if (!fns.length) return;
    const supports = postcss.atRule({ name: "supports", params: "not (translate: 0)" });
    const copy = postcss.rule({ selector: rule.selector });
    copy.__legacyDone = true;
    copy.append(postcss.decl({ prop: "transform", value: fns.join(" ") }));
    supports.append(copy);
    rule.after(supports);
  },
});
fallbacks.postcss = true;

function cssFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? cssFiles(p) : e.name.endsWith(".css") ? [p] : [];
  });
}

const files = cssFiles(path.join(root, ".next", "static"));
for (const file of files) {
  const css = fs.readFileSync(file, "utf8");
  const flat = (await postcss([cascadeLayers()]).process(css, { from: file })).css;
  const lowered = transform({ filename: file, code: Buffer.from(flat), minify: true, targets }).code.toString();
  const out = (await postcss([fallbacks()]).process(lowered, { from: file })).css;
  fs.writeFileSync(file, out);
}
console.log(`legacy-css: made ${files.length} stylesheet(s) work on older browsers.`);
