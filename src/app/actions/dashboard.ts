"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { dashboardLayouts, sectionLayouts } from "@/db/schema";
import { getViewer } from "@/lib/dal";
import { isSection, SECTION_WIDGETS, WIDGET_IDS, type Section } from "@/lib/widgets";

const LayoutSchema = z
  .array(
    z.object({
      id: z.string().refine((id) => WIDGET_IDS.includes(id)),
      visible: z.boolean(),
      size: z.enum(["sm", "md", "lg"]),
    }),
  )
  .max(WIDGET_IDS.length);

/** Saves the signed-in member's own dashboard layout. */
export async function saveDashboardLayout(layout: unknown) {
  const viewer = await getViewer();
  const parsed = LayoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false };
  await db
    .insert(dashboardLayouts)
    .values({ memberId: viewer.member.id, widgets: parsed.data })
    .onConflictDoUpdate({ target: dashboardLayouts.memberId, set: { widgets: parsed.data, updatedAt: new Date() } });
  revalidatePath("/");
  return { ok: true };
}

export async function resetDashboardLayout() {
  const viewer = await getViewer();
  await db.delete(dashboardLayouts).where(eq(dashboardLayouts.memberId, viewer.member.id));
  revalidatePath("/");
  return { ok: true };
}

/** Saves the signed-in member's card layout for a section dashboard. */
export async function saveSectionLayout(section: string, layout: unknown) {
  const viewer = await getViewer();
  if (!isSection(section)) return { ok: false };
  const ids: string[] = SECTION_WIDGETS[section].map((w) => w.id);
  const parsed = z
    .array(z.object({ id: z.string().refine((id) => ids.includes(id)), visible: z.boolean(), size: z.enum(["sm", "md", "lg"]) }))
    .max(ids.length)
    .safeParse(layout);
  if (!parsed.success) return { ok: false };
  await db
    .insert(sectionLayouts)
    .values({ memberId: viewer.member.id, section, widgets: parsed.data })
    .onConflictDoUpdate({ target: [sectionLayouts.memberId, sectionLayouts.section], set: { widgets: parsed.data, updatedAt: new Date() } });
  revalidatePath(SECTION_PATH[section]);
  return { ok: true };
}

export async function resetSectionLayout(section: string) {
  const viewer = await getViewer();
  if (!isSection(section)) return { ok: false };
  await db.delete(sectionLayouts).where(and(eq(sectionLayouts.memberId, viewer.member.id), eq(sectionLayouts.section, section)));
  revalidatePath(SECTION_PATH[section]);
  return { ok: true };
}

const SECTION_PATH: Record<Section, string> = { spiritual: "/spiritual", library: "/library" };
