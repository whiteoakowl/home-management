import Link from "next/link";
import { Lock } from "lucide-react";
import { setShareFood } from "@/app/actions/family";
import { ActionButton } from "@/components/forms/inline";
import type { Viewer } from "@/lib/dal";
import { FOOD_LABELS, type FoodSpace } from "@/lib/food-space";
import { cn } from "@/lib/utils";

type FoodModule = keyof typeof FOOD_LABELS;
const ORDER: FoodModule[] = ["kitchen", "recipes", "meals", "shopping"];

/**
 * The Family Pantry switcher: FAMILY (shared, per the member's permissions)
 * and MY PRIVATE (only when a parent enabled it for this member). The two are
 * always visibly separate so nobody confuses private food with the family's.
 */
export function FoodSpaceNav({ viewer, active, space, others = [] }: { viewer: Viewer; active: FoodModule; space: FoodSpace; others?: { id: string; displayName: string }[] }) {
  const family = ORDER.filter((m) => viewer.can(m));
  const mine = viewer.member.privateFood;
  const link = (m: FoodModule, sp: string, label: string, on: boolean) => (
    <Link
      key={`${m}-${sp}`}
      href={`${FOOD_LABELS[m].href}${sp ? `?space=${sp}` : ""}`}
      aria-current={on ? "page" : undefined}
      className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors", on ? "bg-ink text-white" : "text-ink-soft hover:bg-sunken")}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Family Pantry" className="mb-6 flex flex-col gap-2">
      {family.length > 0 && (
        <div className={cn("flex min-w-0 items-center gap-2 self-start rounded-2xl border px-2 py-1.5 max-w-full", space.kind === "family" ? "border-primary-200 bg-primary-50/60" : "border-line bg-surface")}>
          <div className="flex min-w-0 gap-1 overflow-x-auto">{family.map((m) => link(m, "", FOOD_LABELS[m].family, space.kind === "family" && active === m))}</div>
        </div>
      )}
      {mine && (
        <div className={cn("flex min-w-0 max-w-full items-center gap-2 self-start rounded-2xl border border-dashed px-2 py-1.5", space.kind === "private" && space.own ? "border-olive-400 bg-olive-50" : "border-line-strong bg-surface")}>
          <span className="flex shrink-0 items-center gap-1.5 pl-1.5 text-[11px] font-semibold tracking-[0.12em] text-olive-700 uppercase">
            <Lock className="size-3.5" aria-hidden /> My private
          </span>
          <div className="flex min-w-0 gap-1 overflow-x-auto">{ORDER.map((m) => link(m, "mine", FOOD_LABELS[m].mine, space.kind === "private" && space.own && active === m))}</div>
        </div>
      )}
      {others.length > 0 && (
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface px-2 py-1.5">
          <span className="shrink-0 pl-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Members&apos; private</span>
          <div className="flex min-w-0 gap-1 overflow-x-auto">
            {others.map((o) => link(active, o.id, o.displayName, space.kind === "private" && !space.own && space.memberId === o.id))}
          </div>
        </div>
      )}
    </nav>
  );
}

/** Banner on private pages so it's always obvious whose food this is, with the owner's share-with-parents choice. */
export function PrivateSpaceNote({ space, viewer }: { space: FoodSpace; viewer: Viewer }) {
  if (space.kind !== "private") return null;
  const shared = viewer.member.shareFoodWithParents;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-olive-400 bg-olive-50 px-4 py-2.5 text-sm text-olive-700">
      <Lock className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">
        {space.own
          ? shared
            ? "Parents can see (not change) your private food space. Nobody else can."
            : "Only you can see your private food space, parents included. Nothing here appears in the family's pantry, lists or dashboards."
          : `${space.memberName}'s private food space (read-only). They chose to share it with parents.`}
      </span>
      {space.own && !viewer.isParent && (
        <ActionButton action={setShareFood} fields={{ share: String(!shared) }} className="h-8 rounded-full border border-olive-400 bg-surface px-3 text-sm font-medium hover:bg-olive-100">
          {shared ? "Stop sharing with parents" : "Share with parents"}
        </ActionButton>
      )}
    </div>
  );
}
