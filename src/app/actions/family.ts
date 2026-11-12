"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import {
  ACCESS_LEVELS,
  announcements,
  categories,
  families,
  familyMembers,
  goals,
  MODULES,
  rooms,
  type AccessLevel,
  type Module,
} from "@/db/schema";
import { fieldErrors, type ActionState } from "@/lib/action-state";
import { MEMBER_COLOR_KEYS } from "@/lib/colors";
import { getFamilyMember, getMembership, requireParent, getViewer } from "@/lib/dal";
import {
  addMember,
  createFamilyForUser,
  grantLogin,
  logActivity,
  MemberError,
  setMemberPermissions,
} from "@/lib/family";
import { LAST_STEP, ONBOARDING_STEPS, TIMEZONES } from "@/lib/onboarding";

// ─── Family ──────────────────────────────────────────────────────────────────

const FamilySchema = z.object({
  familyName: z.string().trim().min(1, "Please name your family.").max(80),
  timezone: z.enum(TIMEZONES as [string, ...string[]]),
  locationName: z.string().trim().max(120).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal("").transform(() => undefined)),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal("").transform(() => undefined)),
});

export async function createFamily(_: ActionState, formData: FormData): Promise<ActionState> {
  const { user, member } = await getMembership();
  if (member) redirect("/onboarding?step=2");
  const parsed = FamilySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  await createFamilyForUser({
    userId: user.id,
    userName: user.name,
    familyName: parsed.data.familyName,
    timezone: parsed.data.timezone,
    locationName: parsed.data.locationName,
  });
  redirect("/onboarding?step=2");
}

export async function updateFamily(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = FamilySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const { familyName, timezone, locationName, latitude, longitude } = parsed.data;
  await db
    .update(families)
    .set({ name: familyName, timezone, locationName: locationName || null, latitude: latitude ?? null, longitude: longitude ?? null })
    .where(eq(families.id, viewer.family.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Family details saved." };
}

export async function updateEnabledModules(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const enabled = MODULES.filter((m) => formData.get(`module:${m}`) === "on");
  await db.update(families).set({ enabledModules: enabled }).where(eq(families.id, viewer.family.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Areas updated." };
}

// ─── Members ─────────────────────────────────────────────────────────────────

const MemberSchema = z
  .object({
    displayName: z.string().trim().min(1, "Please enter a name.").max(60),
    role: z.enum(["parent", "member"]),
    color: z.preprocess((v) => (v === "" ? undefined : v), z.enum(MEMBER_COLOR_KEYS as [string, ...string[]]).optional()),
    birthday: z.string().optional(),
    email: z.string().trim().toLowerCase().optional(),
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.email) {
      if (!z.email().safeParse(v.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "Please enter a valid email." });
      if (!v.password || v.password.length < 8) ctx.addIssue({ code: "custom", path: ["password"], message: "Use at least 8 characters." });
    }
  });

export async function createMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = MemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  try {
    await addMember({
      familyId: viewer.family.id,
      actorMemberId: viewer.member.id,
      displayName: d.displayName,
      role: d.role as "parent" | "member",
      color: d.color,
      birthday: d.birthday || null,
      login: d.email ? { email: d.email, password: d.password! } : null,
    });
  } catch (e) {
    if (e instanceof MemberError) return { ok: false, errors: { email: [e.message] } };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${d.displayName} was added.` };
}

const UpdateMemberSchema = z.object({
  memberId: z.uuid(),
  displayName: z.string().trim().min(1, "Please enter a name.").max(60),
  role: z.enum(["parent", "member"]),
  color: z.enum(MEMBER_COLOR_KEYS as [string, ...string[]]),
  birthday: z.string().optional(),
});

export async function updateMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = UpdateMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const target = await getFamilyMember(viewer, d.memberId);
  if (!target) return { ok: false, message: "Member not found." };
  if (target.id === viewer.family.ownerMemberId && d.role !== "parent") {
    return { ok: false, errors: { role: ["The family owner must stay a parent."] } };
  }
  await db
    .update(familyMembers)
    .set({ displayName: d.displayName, role: d.role, color: d.color, birthday: d.birthday || null })
    .where(and(eq(familyMembers.id, target.id), eq(familyMembers.familyId, viewer.family.id)));
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function removeMember(formData: FormData) {
  const viewer = await requireParent();
  const memberId = String(formData.get("memberId"));
  const target = await getFamilyMember(viewer, memberId);
  if (!target || target.id === viewer.family.ownerMemberId || target.id === viewer.member.id) return;
  // Soft-remove: keeps their history (completed chores, journal…) intact.
  await db.update(familyMembers).set({ isActive: false, userId: null }).where(eq(familyMembers.id, target.id));
  await logActivity(db, viewer.family.id, viewer.member.id, "member.removed", `removed ${target.displayName} from the family`);
  revalidatePath("/", "layout");
  redirect("/family");
}

const LoginSchema = z.object({
  memberId: z.uuid(),
  email: z.email("Please enter a valid email.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function createMemberLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  try {
    await grantLogin({ familyId: viewer.family.id, ...parsed.data });
  } catch (e) {
    if (e instanceof MemberError) return { ok: false, errors: { email: [e.message] } };
    throw e;
  }
  revalidatePath("/family");
  return { ok: true, message: "Login created. Share the email and password with them." };
}

/** Form fields: perm:<memberId>:<module> = none|view|edit */
function parsePermissionForm(formData: FormData) {
  const byMember = new Map<string, Partial<Record<Module, AccessLevel>>>();
  for (const [key, value] of formData.entries()) {
    const [prefix, memberId, mod] = key.split(":");
    if (prefix !== "perm" || !memberId || !mod) continue;
    if (!MODULES.includes(mod as Module) || !ACCESS_LEVELS.includes(value as AccessLevel)) continue;
    const entry = byMember.get(memberId) ?? {};
    entry[mod as Module] = value as AccessLevel;
    byMember.set(memberId, entry);
  }
  return byMember;
}

async function savePermissionsFromForm(formData: FormData) {
  const viewer = await requireParent();
  for (const [memberId, perms] of parsePermissionForm(formData)) {
    const target = await getFamilyMember(viewer, memberId);
    if (!target || target.role === "parent") continue; // parents always have full access
    await setMemberPermissions(target.id, perms);
  }
}

export async function savePermissions(_: ActionState, formData: FormData): Promise<ActionState> {
  await savePermissionsFromForm(formData);
  revalidatePath("/", "layout");
  return { ok: true, message: "Permissions saved." };
}

// ─── Onboarding ──────────────────────────────────────────────────────────────

async function advance(familyId: string, from: number) {
  const next = from + 1;
  if (next > LAST_STEP) {
    await db.update(families).set({ onboardingStep: LAST_STEP, onboardingCompletedAt: new Date() }).where(eq(families.id, familyId));
    revalidatePath("/", "layout");
    redirect("/?welcome=1");
  }
  await db.update(families).set({ onboardingStep: next }).where(eq(families.id, familyId));
  redirect(`/onboarding?step=${next}`);
}

export async function skipOnboardingStep(formData: FormData) {
  const viewer = await requireParent();
  await advance(viewer.family.id, Number(formData.get("step")));
}

export async function finishOnboardingLater() {
  const viewer = await requireParent();
  await db.update(families).set({ onboardingCompletedAt: new Date() }).where(eq(families.id, viewer.family.id));
  revalidatePath("/", "layout");
  redirect("/");
}

export async function onboardingPermissions(formData: FormData) {
  const viewer = await requireParent();
  await savePermissionsFromForm(formData);
  await advance(viewer.family.id, 4);
}

/** Steps 5–10: module toggles + quick-pick rooms/categories (+ optional first goal). */
export async function onboardingConfigure(formData: FormData) {
  const viewer = await requireParent();
  const n = Number(formData.get("step"));
  const step = ONBOARDING_STEPS.find((s) => s.n === n);
  if (!step) return;
  const familyId = viewer.family.id;

  if (step.modules) {
    const current = new Set(viewer.family.enabledModules);
    for (const { module } of step.modules) {
      if (formData.get(`module:${module}`) === "on") current.add(module);
      else current.delete(module);
    }
    await db.update(families).set({ enabledModules: [...current] }).where(eq(families.id, familyId));
  }

  if (step.picks) {
    const chosen = [
      ...formData.getAll("pick").map(String),
      ...String(formData.get("custom") ?? "")
        .split(",")
        .map((s) => s.trim()),
    ]
      .filter((s) => s && s.length <= 60)
      .slice(0, 40);
    const unique = [...new Set(chosen)];
    if (unique.length) {
      if (step.picks.target === "rooms") {
        const existing = new Set(
          (await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.familyId, familyId))).map((r) => r.name),
        );
        const rows = unique.filter((name) => !existing.has(name)).map((name, i) => ({ familyId, name, sortOrder: i }));
        if (rows.length) await db.insert(rooms).values(rows);
      } else {
        const domain = step.picks.target;
        const existing = new Set(
          (
            await db
              .select({ name: categories.name })
              .from(categories)
              .where(and(eq(categories.familyId, familyId), eq(categories.domain, domain)))
          ).map((r) => r.name),
        );
        const rows = unique.filter((name) => !existing.has(name)).map((name, i) => ({ familyId, domain, name, sortOrder: i }));
        if (rows.length) await db.insert(categories).values(rows);
      }
    }
  }

  if (step.key === "goals") {
    const name = String(formData.get("goalName") ?? "").trim();
    const target = Number(formData.get("goalTarget") ?? 0);
    if (name) {
      await db.insert(goals).values({
        familyId,
        kind: target > 0 ? "savings" : "family",
        horizon: (String(formData.get("goalHorizon") || "1y") as "6m" | "1y" | "5y" | "10y" | "20y"),
        name: name.slice(0, 120),
        targetCents: target > 0 ? Math.round(target * 100) : null,
      });
      await logActivity(db, familyId, viewer.member.id, "goal.created", `set a family goal: ${name}`, { module: "goals" });
    }
  }

  await advance(familyId, n);
}

// ─── Announcements ───────────────────────────────────────────────────────────

const AnnouncementSchema = z.object({
  body: z.string().trim().min(1, "Write something to share.").max(500),
  pinned: z.literal("on").optional(),
});

export async function postAnnouncement(_: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireParent();
  const parsed = AnnouncementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  await db.insert(announcements).values({
    familyId: viewer.family.id,
    authorMemberId: viewer.member.id,
    body: parsed.data.body,
    pinned: parsed.data.pinned === "on",
  });
  await logActivity(db, viewer.family.id, viewer.member.id, "announcement.posted", "posted an announcement");
  revalidatePath("/");
  return { ok: true, message: "Announcement posted." };
}

export async function deleteAnnouncement(formData: FormData) {
  const viewer = await requireParent();
  const id = String(formData.get("id"));
  await db.delete(announcements).where(and(eq(announcements.id, id), eq(announcements.familyId, viewer.family.id)));
  revalidatePath("/");
}

export { getViewer };
