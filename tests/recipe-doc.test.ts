import { test } from "node:test";
import assert from "node:assert/strict";
import { crc32, deflateRawSync } from "node:zlib";
import { parseDuration, recipesFromDocx } from "../src/lib/recipe-doc";

/** Minimal .docx (ZIP) writer for tests. */
function zip(files: Record<string, string>) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const comp = deflateRawSync(data);
    const n = Buffer.from(name);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc32(data), 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    local.push(h, n, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc32(data), 16);
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}
const p = (text: string, style?: string, list = false) =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const doc = (body: string) => zip({ "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}<w:sectPr/></w:body></w:document>` });

test("one recipe per page, fields extracted, nothing invented", () => {
  const body = [
    p("Chicken Parmesan", "Title"),
    p("Prep time: 20 minutes"),
    p("Cook time: 1 hr 5 min"),
    p("Serves 4"),
    p("Source: Grandma Rose"),
    p("Ingredients"),
    p("2 chicken breasts", undefined, true),
    p("1 cup breadcrumbs", undefined, true),
    p("1 cup marinara sauce", undefined, true),
    p("Directions"),
    p("Pound the chicken thin and coat it in the breadcrumbs, pressing so they stick.", undefined, true),
    p("Bake at 400°F for 25 minutes, then top with sauce &amp; cheese.", undefined, true),
    p("Notes: Freezes well."),
    pageBreak,
    p("Chocolate Chip Cookies", "Heading1"),
    p("Makes 24 cookies"),
    p("Ingredients:"),
    p("2 1/4 cups flour"),
    p("1 cup butter"),
    p("2 cups chocolate chips"),
    p("Instructions:"),
    p("1. Cream the butter and sugar together until light and fluffy, about 3 minutes."),
    p("2. Fold in the chips and bake for 10 minutes."),
    pageBreak,
    p("Vegetable Soup", "Title"),
    p("Category: Soup"),
    p("- 4 cups broth"),
    p("- 2 carrots, diced"),
    p("Simmer everything together for 30 minutes until the vegetables are tender."),
  ].join("");
  const { recipes, pages } = recipesFromDocx(doc(body));
  assert.equal(pages, 3);
  assert.deepEqual(recipes.map((r) => r.name), ["Chicken Parmesan", "Chocolate Chip Cookies", "Vegetable Soup"]);
  const [a, b, c] = recipes as [NonNullable<(typeof recipes)[0]>, NonNullable<(typeof recipes)[0]>, NonNullable<(typeof recipes)[0]>];
  assert.equal(a.prepMinutes, 20);
  assert.equal(a.cookMinutes, 65);
  assert.equal(a.totalMinutes, null);
  assert.equal(a.servings, 4);
  assert.equal(a.source, "Grandma Rose");
  assert.equal(a.category, null);
  assert.deepEqual(a.ingredients, ["2 chicken breasts", "1 cup breadcrumbs", "1 cup marinara sauce"]);
  assert.equal(a.instructions.length, 2);
  assert.match(a.instructions[1]!, /sauce & cheese/);
  assert.equal(a.notes, "Freezes well.");
  assert.equal(b.servings, 24);
  assert.deepEqual(b.ingredients, ["2 1/4 cups flour", "1 cup butter", "2 cups chocolate chips"]);
  assert.match(b.instructions[0]!, /^Cream the butter/);
  assert.equal(c.category, "Soup");
  assert.deepEqual(c.ingredients, ["4 cups broth", "2 carrots, diced"]);
  assert.equal(c.instructions.length, 1);
});

test("durations", () => {
  assert.equal(parseDuration("1 hr 20 min"), 80);
  assert.equal(parseDuration("1 1/2 hours"), 90);
  assert.equal(parseDuration("45 minutes"), 45);
  assert.equal(parseDuration("1h30m"), 90);
  assert.equal(parseDuration("overnight"), null);
});

test("not a docx", () => {
  assert.throws(() => recipesFromDocx(Buffer.from("hello")), /Word/);
});
