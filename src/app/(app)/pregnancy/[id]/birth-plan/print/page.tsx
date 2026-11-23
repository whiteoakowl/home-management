import type { Metadata } from "next";
import { PrintButton } from "@/components/binder/print-button";
import { formatShortDate } from "@/lib/dates";
import { BIRTH_PLAN_SECTIONS } from "@/lib/pregnancy/catalog";
import { memberOptions } from "@/lib/queries";
import { pregnancyContext } from "../../../shared";

export const metadata: Metadata = { title: "Birth Preferences Plan" };

export default async function BirthPlanPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, p } = await pregnancyContext(id);
  const name = (await memberOptions(viewer)).find((m) => m.id === p.memberId)?.displayName;
  const filled = BIRTH_PLAN_SECTIONS.filter((s) => p.birthPlan[s.key]);
  return (
    <article className="mx-auto max-w-2xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <h1 className="text-2xl font-semibold">Birth Preferences</h1>
      <p className="mt-1 text-sm">{[name, p.dueDate && `Estimated due date ${formatShortDate(p.dueDate)}`, p.provider && `Provider: ${p.provider}`, p.hospital && `Hospital: ${p.hospital}`].filter(Boolean).join(" · ")}</p>
      <p className="mt-2 border-y border-gray-300 py-2 text-xs">These are my preferences, to discuss with my care team. I understand plans may need to change for my or my baby&apos;s safety. This is not a guarantee or a medical document.</p>
      {filled.length ? (
        filled.map((s) => (
          <section key={s.key} className="mt-4 break-inside-avoid">
            <h2 className="text-base font-semibold">{s.label}</h2>
            <p className="text-sm whitespace-pre-line">{p.birthPlan[s.key]}</p>
          </section>
        ))
      ) : (
        <p className="mt-4 text-sm">No preferences filled in yet.</p>
      )}
    </article>
  );
}
