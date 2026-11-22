"use client";

import Link from "next/link";
import { CloudOff } from "lucide-react";
import { EmptyState } from "@/components/ui/display";

/** Help failed to load (offline or a hiccup). No technical details are shown. */
export default function HelpError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <EmptyState
        icon={<CloudOff />}
        title="Help didn't load"
        description="Check your internet connection, then try again."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => retry()} className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-primary-600 px-5 font-medium text-white hover:bg-primary-700">
              Try again
            </button>
            <Link href="/" className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-line-strong px-5 font-medium hover:bg-sunken">
              Home
            </Link>
          </div>
        }
      />
    </div>
  );
}
