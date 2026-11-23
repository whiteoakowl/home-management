import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { KickCounter } from "@/components/pregnancy/timers";
import { logsOf } from "@/lib/pregnancy/queries";
import { PLogList } from "../../logs";
import { PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Kick counter" };

export default async function KicksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { p, g, can } = ctx;
  const sessions = await logsOf(p.id, ["kicks"], { limit: 30 });
  return (
    <>
      <PregnancyHeader ctx={ctx} active="kicks" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <KickCounter pregnancyId={p.id} canSave={can("kicks") && p.status === "active"} />
          <p className="mt-4 text-xs text-muted">
            {g && g.week < 28 ? "Many providers suggest starting daily kick counts around week 28. Ask yours what they recommend. " : ""}
            Pick a time your baby is usually active, get comfortable and count every movement. Your session stays on this device until you save it. If you notice fewer movements than usual, call your provider or labor &amp; delivery right away. Don&apos;t wait.
          </p>
        </Card>
        <Card>
          <CardHeader title="Past sessions" />
          <PLogList ctx={ctx} logs={sessions} empty="Saved kick counts show here so you can see your baby's pattern." canChange={ctx.canEdit} />
        </Card>
      </div>
    </>
  );
}
