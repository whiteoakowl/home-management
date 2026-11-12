import { Suspense } from "react";
import type { WidgetPref } from "@/db/schema/core";
import { renderWidget } from "./widgets";
import type { Scope } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

const SPAN: Record<WidgetPref["size"], string> = {
  sm: "col-span-1",
  md: "col-span-1 md:col-span-2",
  lg: "col-span-1 md:col-span-2 xl:col-span-3",
};

function WidgetSkeleton() {
  return <div className="h-44 animate-pulse rounded-[var(--radius-card)] border border-line bg-surface" aria-hidden />;
}

/** Responsive widget grid; each widget streams independently. */
export function WidgetGrid({ widgets, scope, name }: { widgets: WidgetPref[]; scope: Scope; name: string }) {
  return (
    <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
      {widgets.map((w) => (
        <div key={w.id} className={cn(SPAN[w.size])}>
          <Suspense fallback={<WidgetSkeleton />}>{renderWidget(w.id, scope, name)}</Suspense>
        </div>
      ))}
    </div>
  );
}
