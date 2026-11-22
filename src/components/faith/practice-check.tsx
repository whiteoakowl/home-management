import { Check } from "lucide-react";
import { togglePractice } from "@/app/actions/faith";
import { ActionButton } from "@/components/forms/inline";
import { cn } from "@/lib/utils";

/** A tap-to-check practice for one day. */
export function PracticeCheck({ id, date, done, name, emoji, sub }: { id: string; date: string; done: boolean; name: string; emoji?: string | null; sub?: string }) {
  return (
    <ActionButton
      action={togglePractice}
      fields={{ id, date }}
      label={done ? `Un-check ${name}` : `Check off ${name}`}
      className={cn("flex w-full items-center justify-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", done ? "border-olive-300 bg-olive-50" : "border-line hover:border-primary-300")}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2", done ? "border-olive-600 bg-olive-600 text-white" : "border-line-strong")}>{done && <Check className="size-4" />}</span>
      <span className="text-lg" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </ActionButton>
  );
}
