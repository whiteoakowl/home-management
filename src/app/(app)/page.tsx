import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dashboardLayouts } from "@/db/schema";
import { DashboardCustomizer } from "@/components/dashboard/customizer";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { InstallBanner } from "@/components/pwa/install-app";
import { getViewer } from "@/lib/dal";
import { makeScope } from "@/lib/dashboard-data";
import { resolveLayout, WIDGETS, widgetDef } from "@/lib/widgets";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const viewer = await getViewer();
  const { welcome } = await searchParams;
  const [saved] = await db.select().from(dashboardLayouts).where(eq(dashboardLayouts.memberId, viewer.member.id));

  // Only widgets this member may see (module enabled + permitted).
  const allowed = (id: string) => {
    const def = widgetDef(id);
    return !!def && (def.module === null || viewer.can(def.module));
  };
  const layout = resolveLayout(saved?.widgets).filter((w) => allowed(w.id));
  const titles = Object.fromEntries(WIDGETS.map((w) => [w.id, w.title]));

  return (
    <div className="flex flex-col gap-6">
      {welcome && (
        <div className="rounded-[var(--radius-card)] border border-primary-200 bg-primary-50 px-5 py-4 text-[15px] text-primary-800">
          <strong>Welcome to the {viewer.family.name} Family!</strong> Your family is set up. Each area fills in as you
          start using it; use <strong>+ Add</strong> anytime.
        </div>
      )}
      <InstallBanner />
      <div className="flex items-center justify-between gap-3">
        <h1 className="sr-only">Dashboard</h1>
        <p className="text-sm font-medium text-muted">The {viewer.family.name} Family</p>
        <DashboardCustomizer layout={layout} titles={titles} />
      </div>
      <WidgetGrid
        widgets={layout.filter((w) => w.visible)}
        scope={makeScope(viewer)}
        name={viewer.member.displayName.split(" ")[0]!}
      />
    </div>
  );
}
