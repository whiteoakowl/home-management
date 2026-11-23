/**
 * Pregnancy Tracker isolation against a real database (`npm run test:db`).
 * Checks household isolation, each sharing option, who may edit, and that
 * private photos/documents are only served to people who can see the pregnancy.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { families, familyMembers, files, pregnancies, pregnancyEntries, recordAccess } from "../../src/db/schema";
import type { Viewer } from "../../src/lib/dal";
import { canEditPregnancy, canReadPregnancyFile, editablePregnancy, getPregnancy, listPregnancies } from "../../src/lib/pregnancy/data";

const viewer = (familyId: string, memberId: string, isParent = false, can = true) =>
  ({ family: { id: familyId, timezone: "America/New_York" }, member: { id: memberId }, isParent, can: () => can, premium: true }) as unknown as Viewer;

let famA = "";
let mom = "";
let dad = "";
let kid = "";
let famB = "";
let zoe = "";
let preg = "";
let teenPreg = "";
let fileA = "";

before(async () => {
  const [a] = await db.select().from(families).limit(1);
  if (!a) throw new Error("Seed the database first.");
  famA = a.id;
  const members = await db.select().from(familyMembers).where(eq(familyMembers.familyId, famA));
  const parents = members.filter((m) => m.role === "parent");
  mom = parents[0]!.id;
  dad = parents[1]!.id;
  kid = members.find((m) => m.role === "member")!.id;
  const [b] = await db.insert(families).values({ name: "ZZTEST Pregnancy other household" }).returning();
  famB = b!.id;
  zoe = (await db.insert(familyMembers).values({ familyId: famB, displayName: "Zoe", role: "parent" }).returning())[0]!.id;
  preg = (await db.insert(pregnancies).values({ familyId: famA, memberId: mom, createdByMemberId: mom, nickname: "ZZTEST", dueDate: "2027-03-01", visibility: "private" }).returning())[0]!.id;
  teenPreg = (await db.insert(pregnancies).values({ familyId: famA, memberId: kid, createdByMemberId: kid, nickname: "ZZTEST", dueDate: "2027-05-01", visibility: "parents" }).returning())[0]!.id;
  fileA = (await db.insert(files).values({ familyId: famA, uploadedByMemberId: mom, storageKey: "zztest/preg", originalName: "scan.jpg", mimeType: "image/jpeg", sizeBytes: 1 }).returning())[0]!.id;
  await db.insert(pregnancyEntries).values({ familyId: famA, pregnancyId: preg, kind: "photo", date: "2026-11-20", fileId: fileA });
});

after(async () => {
  await db.delete(recordAccess).where(eq(recordAccess.entityId, preg));
  await db.delete(pregnancies).where(eq(pregnancies.nickname, "ZZTEST"));
  await db.delete(files).where(eq(files.storageKey, "zztest/preg"));
  await db.delete(families).where(eq(families.id, famB));
  process.exit(0);
});

test("another household can't see a pregnancy, even with its ID", async () => {
  assert.equal(await getPregnancy(viewer(famB, zoe, true), preg), null);
  assert.equal((await listPregnancies(viewer(famB, zoe, true))).length, 0);
  await assert.rejects(editablePregnancy(viewer(famB, zoe, true), preg));
  assert.equal(await canReadPregnancyFile(viewer(famB, zoe, true), fileA), true, "a file not linked in that household isn't a pregnancy file there");
});

test("Only me: other parents and members can't see it or its photos", async () => {
  assert.ok(await getPregnancy(viewer(famA, mom, true), preg));
  assert.equal(await getPregnancy(viewer(famA, dad, true), preg), null);
  assert.equal(await getPregnancy(viewer(famA, kid), preg), null);
  assert.equal(await canReadPregnancyFile(viewer(famA, dad, true), fileA), false);
  assert.equal(await canReadPregnancyFile(viewer(famA, kid), fileA), false);
  assert.equal(await canReadPregnancyFile(viewer(famA, mom, true), fileA), true);
});

test("Selected people see it; only those allowed can edit", async () => {
  await db.update(pregnancies).set({ visibility: "selected" }).where(eq(pregnancies.id, preg));
  await db.insert(recordAccess).values({ familyId: famA, entityType: "pregnancy", entityId: preg, memberId: dad, canEdit: false });
  const p = await getPregnancy(viewer(famA, dad, true), preg);
  assert.ok(p, "partner sees it");
  assert.equal(await canEditPregnancy(viewer(famA, dad, true), p!), false, "view-only partner can't edit");
  await assert.rejects(editablePregnancy(viewer(famA, dad, true), preg));
  assert.equal(await getPregnancy(viewer(famA, kid), preg), null, "not selected");
  await db.update(recordAccess).set({ canEdit: true }).where(eq(recordAccess.entityId, preg));
  assert.ok(await editablePregnancy(viewer(famA, dad, true), preg), "partner allowed to edit");
  assert.equal(await canReadPregnancyFile(viewer(famA, dad, true), fileA), true);
});

test("Parents & me: parents see a member's pregnancy, other members don't; parents can't edit unless allowed", async () => {
  const p = await getPregnancy(viewer(famA, dad, true), teenPreg);
  assert.ok(p);
  assert.equal(await canEditPregnancy(viewer(famA, dad, true), p!), false);
  assert.ok(await editablePregnancy(viewer(famA, kid), teenPreg));
});

test("no module access means no pregnancies", async () => {
  assert.equal(await getPregnancy(viewer(famA, mom, true, false), preg), null);
  assert.equal((await listPregnancies(viewer(famA, mom, true, false))).length, 0);
});

test("bad IDs are rejected before the database", async () => {
  assert.equal(await getPregnancy(viewer(famA, mom, true), "1 or 1=1"), null);
  await assert.rejects(editablePregnancy(viewer(famA, mom, true), "../x"));
});
