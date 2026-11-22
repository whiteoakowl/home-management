"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 print:hidden">
      <Printer className="size-4" /> {label}
    </button>
  );
}
