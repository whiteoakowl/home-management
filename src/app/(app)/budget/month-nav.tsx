import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthLabel } from "@/lib/dates";

export function MonthNav({ month, base }: { month: string; base: string }) {
  const m = `${month.slice(0, 7)}-01`;
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link href={`${base}?month=${addMonths(m, -1).slice(0, 7)}`} aria-label="Previous month" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
        <ChevronLeft className="size-5" />
      </Link>
      <Link href={`${base}?month=${addMonths(m, 1).slice(0, 7)}`} aria-label="Next month" className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface hover:bg-sunken">
        <ChevronRight className="size-5" />
      </Link>
      <h2 className="ml-2 text-xl font-semibold">{monthLabel(m)}</h2>
    </div>
  );
}
