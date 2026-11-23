import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { BirthPlanForm } from "@/components/pregnancy/forms";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { PremiumLocked, PregnancyHeader, pregnancyContext } from "../../shared";

export const metadata: Metadata = { title: "Birth Preferences Plan" };

export default async function BirthPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await pregnancyContext(id);
  const { p, can, has } = ctx;
  return (
    <>
      <PregnancyHeader ctx={ctx} active="birth-plan" />
      {!has("birthPlan") && <PremiumLocked f="birthPlan" />}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Your wishes for labor, birth and the first hours, to talk through with your provider. Births don&apos;t always go to plan; this is a guide for your care team, not a guarantee.</p>
        <Link href={`/pregnancy/${p.id}/birth-plan/print`} className={buttonClasses({ variant: "secondary" })}>
          <Printer className="size-4" /> Print / save PDF
        </Link>
      </div>
      <Card className="max-w-3xl">
        <BirthPlanForm pregnancyId={p.id} plan={p.birthPlan} readOnly={!can("birthPlan")} />
      </Card>
    </>
  );
}
