import type { AccessLevel, Module } from "@/db/schema/_shared";
import { Avatar } from "@/components/ui/display";
import { Icon } from "@/components/icons";
import { MODULE_META } from "@/lib/modules";
import { ADD_LEVEL_MODULES } from "@/lib/permissions";

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View only" },
  { value: "add", label: "Add own" },
  { value: "edit", label: "Add & edit" },
];
/** "Add" (add new things, change only their own) is offered for the Family Pantry areas. */
const levelsFor = (m: Module) => LEVELS.filter((l) => l.value !== "add" || ADD_LEVEL_MODULES.includes(m));

/** Plain-language meaning of each access level, shown under the permission selects. */
export function PermissionLegend() {
  return (
    <dl className="grid gap-1.5 rounded-xl bg-sunken/60 px-3.5 py-3 text-sm text-ink-soft">
      <div><dt className="inline font-semibold text-ink">No access:</dt> <dd className="inline">the area is hidden.</dd></div>
      <div><dt className="inline font-semibold text-ink">View only:</dt> <dd className="inline">can look, but can&apos;t add or change anything.</dd></div>
      <div><dt className="inline font-semibold text-ink">Add own</dt> <dd className="inline">(Family Pantry areas): can add new things and change only what they added.</dd></div>
      <div><dt className="inline font-semibold text-ink">Add &amp; edit:</dt> <dd className="inline">can create new things (lists, events, goals…) and change or delete the things they added. Only parents can change what someone else added, and nobody sees someone else&apos;s &ldquo;Only me&rdquo; items.</dd></div>
    </dl>
  );
}

/**
 * One member's module → access selects, named perm:<memberId>:<module> so
 * they post with any server-action form. Shared by onboarding and Family.
 */
export function PermissionRows({
  memberId,
  access,
  modules,
}: {
  memberId: string;
  access: Partial<Record<Module, AccessLevel>>;
  modules: Module[];
}) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {modules.map((mod) => {
        const meta = MODULE_META[mod];
        const id = `perm-${memberId}-${mod}`;
        return (
          <div key={mod} className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5">
            <label htmlFor={id} className="flex items-center gap-2.5 text-[15px]">
              <Icon name={meta.icon} className="size-4 text-muted" />
              {meta.label}
            </label>
            <select
              id={id}
              name={`perm:${memberId}:${mod}`}
              defaultValue={access[mod] ?? meta.defaultMemberAccess}
              className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              {levelsFor(mod).map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

type MemberRow = { id: string; displayName: string; color: string; access: Partial<Record<Module, AccessLevel>> };

/** Several members at once (used in onboarding). */
export function PermissionsMatrix({ members, modules }: { members: MemberRow[]; modules: Module[] }) {
  return (
    <div className="flex flex-col gap-4">
      <PermissionLegend />
      {members.map((m) => (
        <fieldset key={m.id} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 pb-1">
          <legend className="sr-only">{m.displayName}&apos;s access</legend>
          <div className="flex items-center gap-3 border-b border-line py-3">
            <Avatar name={m.displayName} color={m.color} size="sm" />
            <span className="font-semibold">{m.displayName}</span>
          </div>
          <PermissionRows memberId={m.id} access={m.access} modules={modules} />
        </fieldset>
      ))}
    </div>
  );
}
