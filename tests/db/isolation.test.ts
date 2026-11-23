/**
 * Household and member isolation against a real database (run with
 * `npm run test:db`; needs DATABASE_URL and the seed data). Creates a second
 * household, then checks that nothing in Sleep Sounds, the Baby tracker or
 * private journal files leaks across households or to the wrong member.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "../../src/db";
import { babies, babyLogs, babySupplies, families, familyMembers, files, journalEntries, journalEntryFiles, soundMixes, soundPreferences } from "../../src/db/schema";
import type { Viewer } from "../../src/lib/dal";
import { getBaby, suppliesFor } from "../../src/lib/baby";
import { visibleMix, visibleMixes } from "../../src/lib/sounds/data";
import { canReadJournalFile } from "../../src/lib/wellness-data";

const viewer = (familyId: string, memberId: string, isParent = false) =>
  ({ family: { id: familyId }, member: { id: memberId }, isParent, can: () => true, premium: true }) as unknown as Viewer;

let famA = "";
let sara = "";
let jack = "";
let famB = "";
let zoe = "";
let privateMix = "";
let sharedMix = "";
let babyA = "";
let fileA = "";

before(async () => {
  const [a] = await db.select().from(families).limit(1);
  if (!a) throw new Error("Seed the database first.");
  famA = a.id;
  const members = await db.select().from(familyMembers).where(eq(familyMembers.familyId, famA));
  sara = members.find((m) => m.role === "parent")!.id;
  jack = members.find((m) => m.role === "member")!.id;
  const [b] = await db.insert(families).values({ name: "ZZTEST Other household" }).returning();
  famB = b!.id;
  const [z] = await db.insert(familyMembers).values({ familyId: famB, displayName: "Zoe", role: "parent" }).returning();
  zoe = z!.id;
  privateMix = (await db.insert(soundMixes).values({ familyId: famA, memberId: sara, name: "ZZTEST private", items: [{ soundId: "rain", volume: 50 }] }).returning())[0]!.id;
  sharedMix = (await db.insert(soundMixes).values({ familyId: famA, memberId: sara, name: "ZZTEST shared", items: [{ soundId: "ocean", volume: 50 }], isShared: true }).returning())[0]!.id;
  babyA = (await db.insert(babies).values({ familyId: famA, name: "ZZTEST baby", createdByMemberId: sara }).returning())[0]!.id;
  await db.insert(babySupplies).values({ familyId: famA, babyId: babyA, kind: "diapers", name: "ZZTEST diapers", quantity: "10" });
  fileA = (await db.insert(files).values({ familyId: famA, uploadedByMemberId: sara, storageKey: "zztest/none", originalName: "voice.webm", mimeType: "audio/webm", sizeBytes: 1 }).returning())[0]!.id;
  const [entry] = await db.insert(journalEntries).values({ familyId: famA, authorMemberId: sara, date: "2026-11-22", body: "ZZTEST private", book: "wellness", visibility: "private" }).returning();
  await db.insert(journalEntryFiles).values({ entryId: entry!.id, fileId: fileA });
});

after(async () => {
  await db.delete(journalEntries).where(eq(journalEntries.body, "ZZTEST private"));
  await db.delete(files).where(eq(files.storageKey, "zztest/none"));
  await db.delete(babies).where(eq(babies.name, "ZZTEST baby"));
  await db.delete(soundMixes).where(and(eq(soundMixes.familyId, famA), eq(soundMixes.memberId, sara)));
  await db.delete(soundPreferences).where(eq(soundPreferences.familyId, famB));
  await db.delete(families).where(eq(families.id, famB));
  process.exit(0); // close the pool
});

test("another household can't see or fetch Sleep Sounds mixes, even with the right ID", async () => {
  const z = viewer(famB, zoe, true);
  assert.equal(await visibleMix(z, privateMix), null);
  assert.equal(await visibleMix(z, sharedMix), null);
  assert.equal((await visibleMixes(z)).length, 0);
});

test("other members see only shared mixes, and can't edit them", async () => {
  const j = viewer(famA, jack);
  assert.equal(await visibleMix(j, privateMix), null);
  const shared = await visibleMix(j, sharedMix);
  assert.ok(shared);
  const list = await visibleMixes(j);
  assert.ok(!list.some((m) => m.id === privateMix));
  const s = list.find((m) => m.id === sharedMix)!;
  assert.equal(s.canEdit, false);
  assert.equal(s.mine, false);
  assert.equal(s.ownerName !== null, true);
});

test("bad IDs are rejected before touching the database", async () => {
  const s = viewer(famA, sara, true);
  for (const bad of ["", "1 or 1=1", "../../etc", "00000000-0000-0000-0000-00000000000z", null, 42]) assert.equal(await visibleMix(s, bad), null);
});

test("Baby tracker data stays in its household", async () => {
  const z = viewer(famB, zoe, true);
  assert.equal(await getBaby(z, babyA), null);
  assert.equal((await suppliesFor(z, babyA)).length, 0);
  assert.ok(await getBaby(viewer(famA, sara, true), babyA));
});

test("a private journal voice note is served only to its author", async () => {
  assert.equal(await canReadJournalFile(viewer(famA, sara, true), fileA), true);
  assert.equal(await canReadJournalFile(viewer(famA, jack), fileA), false);
});

test("deleting a household removes its Sleep Sounds and baby data (cascade)", async () => {
  const [tmpFam] = await db.insert(families).values({ name: "ZZTEST cascade" }).returning();
  const [m] = await db.insert(familyMembers).values({ familyId: tmpFam!.id, displayName: "Tmp", role: "parent" }).returning();
  await db.insert(soundPreferences).values({ familyId: tmpFam!.id, memberId: m!.id, favoriteSounds: ["rain"] });
  const [mix] = await db.insert(soundMixes).values({ familyId: tmpFam!.id, memberId: m!.id, name: "x", items: [] }).returning();
  const [bb] = await db.insert(babies).values({ familyId: tmpFam!.id, name: "x" }).returning();
  await db.insert(babyLogs).values({ familyId: tmpFam!.id, babyId: bb!.id, kind: "diaper", startedAt: new Date() });
  await db.delete(families).where(eq(families.id, tmpFam!.id));
  assert.equal((await db.select().from(soundMixes).where(eq(soundMixes.id, mix!.id))).length, 0);
  assert.equal((await db.select().from(soundPreferences).where(eq(soundPreferences.memberId, m!.id))).length, 0);
  assert.equal((await db.select().from(babyLogs).where(eq(babyLogs.babyId, bb!.id))).length, 0);
});
