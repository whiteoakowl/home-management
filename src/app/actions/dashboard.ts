"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { db } from "@/db";
import { dashboardLayouts } from "@/db/schema";
import { getViewer } from "@/lib/dal";
import { WIDGET_IDS } from "@/lib/widgets";

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
