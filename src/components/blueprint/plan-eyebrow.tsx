import { Lock, Users } from "lucide-react";

const LABEL: Record<string, string> = { private: "Only me", parents: "Parents & me" };

/** Plan eyebrow with a small "who sees it" note when it isn't shared with the whole family. */
export function PlanEyebrow({ label, visibility, shared }: { label: string; visibility: string; shared: number }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {label}
      {visibility === "selected" ? (
        <span className="inline-flex items-center gap-1 text-muted">
          <Users className="size-3.5" aria-hidden /> {shared} {shared === 1 ? "person" : "people"}
        </span>
      ) : LABEL[visibility] ? (
        <span className="inline-flex items-center gap-1 text-muted">
          <Lock className="size-3.5" aria-hidden /> {LABEL[visibility]}
        </span>
      ) : null}
    </span>
  );
}
