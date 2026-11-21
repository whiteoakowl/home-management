import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MODULES, type Module } from "../src/db/schema/_shared";
import { ARTICLES, CATEGORIES, FAQS, helpFor, searchDocs, searchHelp, type HelpViewer } from "../src/lib/help";

const all = (allowed: Module[] | "all") => (m: Module) => allowed === "all" || allowed.includes(m);
const parent: HelpViewer = { isParent: true, isOwner: true, enabledModules: [...MODULES], can: all("all"), hasFaithPaths: true };
const kid: HelpViewer = { isParent: false, isOwner: false, enabledModules: [...MODULES], can: all(["calendar", "chores", "lists", "messages", "photos"]) };

test("every article has a unique slug, a real category, and text", () => {
  const slugs = ARTICLES.map((a) => a.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug");
  for (const a of ARTICLES) {
    assert.ok(CATEGORIES.some((c) => c.key === a.category), `${a.slug}: unknown category`);
    assert.ok(a.steps?.length || a.sections?.length, `${a.slug}: no content`);
    for (const m of a.modules ?? []) assert.ok((MODULES as readonly string[]).includes(m), `${a.slug}: unknown module ${m}`);
  }
  for (const c of CATEGORIES) assert.ok(ARTICLES.some((a) => a.category === c.key), `${c.key}: empty category`);
});

test("related articles and FAQ links point at real articles", () => {
  const slugs = new Set(ARTICLES.map((a) => a.slug));
  for (const a of ARTICLES) for (const r of a.related ?? []) assert.ok(slugs.has(r), `${a.slug} → ${r}`);
  for (const f of FAQS) if (f.slug) assert.ok(slugs.has(f.slug), `FAQ ${f.q} → ${f.slug}`);
});

/** Does an app route exist for this href? (matches [dynamic] folders too) */
function routeExists(href: string) {
  const path = href.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const roots = ["src/app"];
  const walk = (dir: string, rest: string[]): boolean => {
    // Route groups like (app) are transparent.
    const groups = readdirSync(dir).filter((d) => /^\(.+\)$/.test(d) && statSync(join(dir, d)).isDirectory());
    if (!rest.length) return existsSync(join(dir, "page.tsx")) || groups.some((g) => walk(join(dir, g), rest));
    const [seg, ...more] = rest;
    const kids = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory());
    return kids.some((k) => (k === seg || /^\[[^.].*\]$/.test(k)) && walk(join(dir, k), more)) || groups.some((g) => walk(join(dir, g), rest));
  };
  return roots.some((r) => walk(r, path));
}

test("every 'Open in app' button goes to a page that exists", () => {
  for (const a of ARTICLES) if (a.openIn) assert.ok(routeExists(a.openIn.href), `${a.slug}: ${a.openIn.href}`);
  assert.ok(routeExists("/help/calendar/create-event"));
  assert.ok(!routeExists("/no-such-page"));
});

test("help never mentions internal systems", () => {
  // "Plant database" is the name of a Garden tab, not a system.
  const text = JSON.stringify([ARTICLES, FAQS, CATEGORIES]).replace(/Plant database/g, "");
  for (const bad of [/supabase/i, /stripe/i, /postgres/i, /drizzle/i, /api key/i, /\/api\//, /\/admin/, /main admin/i, /developer/i, /database/i, /netlify/i, /env(ironment)? var/i, /localhost/i, /debug/i]) {
    assert.equal(text.match(bad)?.[0], undefined, String(bad));
  }
});

test("parents see parent and owner help; kids don't", () => {
  const p = helpFor(parent);
  const k = helpFor(kid);
  assert.ok(p.articles.some((a) => a.slug === "permissions"));
  assert.ok(p.articles.some((a) => a.slug === "cancel-subscription"));
  assert.ok(!k.articles.some((a) => a.audience === "parents" || a.audience === "owner"));
  assert.ok(!k.categories.some((c) => c.key === "billing"));
  assert.ok(!helpFor({ ...parent, isOwner: false }).articles.some((a) => a.audience === "owner"));
});

test("help about sections someone can't open is hidden", () => {
  const k = helpFor(kid);
  assert.ok(k.articles.some((a) => a.slug === "create-event"));
  assert.ok(!k.articles.some((a) => a.slug === "budget"));
  assert.ok(!k.articles.some((a) => a.slug === "medical"));
  assert.ok(!k.articles.some((a) => a.slug === "spiritual"));
  // Personal areas are everyone's.
  assert.ok(k.articles.some((a) => a.slug === "period-tracker"));
  // Important Info is open to every member when the family uses it.
  assert.ok(k.articles.some((a) => a.slug === "important-info"));
  assert.ok(!helpFor({ ...kid, enabledModules: ["calendar"] }).articles.some((a) => a.slug === "important-info"));
  // A private budget brings "My Budget" help.
  assert.ok(helpFor({ ...kid, privateFinance: true }).articles.some((a) => a.slug === "budget"));
  // FAQs follow the same rules.
  assert.ok(!k.faqs.some((f) => f.slug === "download-data"));
});

test("search finds the right article and handles no results", () => {
  const docs = searchDocs(ARTICLES);
  assert.equal(searchHelp(docs, "repeat event")[0]?.slug, "recurring-events");
  assert.equal(searchHelp(docs, "wifi password")[0]?.slug, "important-info");
  assert.ok(searchHelp(docs, "chores").some((d) => d.slug === "create-chore"));
  assert.ok(searchHelp(docs, "Forgot my password").some((d) => d.slug === "cant-sign-in"));
  assert.deepEqual(searchHelp(docs, "zzqxv"), []);
  assert.deepEqual(searchHelp(docs, "   "), []);
  // Search only ever sees what the person may read.
  const kidDocs = searchDocs(helpFor(kid).articles);
  assert.ok(!searchHelp(kidDocs, "cancel subscription").some((d) => d.slug === "cancel-subscription"));
});
