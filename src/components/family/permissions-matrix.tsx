import type { AccessLevel, Module } from "@/db/schema/_shared";
import { Avatar } from "@/components/ui/display";
import { Icon } from "@/components/icons";
import { MODULE_META } from "@/lib/modules";
import { ADD_LEVEL_MODULES, PARENT_ONLY_MODULES } from "@/lib/permissions";

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View only" },
  { value: "use", label: "Use" },
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
      <div><dt className="inline font-semibold text-ink">View only:</dt> <dd className="inline">can open the tab and see what&apos;s shared with the family, but can&apos;t check anything off, add or change anything.</dd></div>
      <div><dt className="inline font-semibold text-ink">Use:</dt> <dd className="inline">can check off chores and list items, mark things done and earn and spend points, but can&apos;t add to or edit the lists.</dd></div>
      <div><dt className="inline font-semibold text-ink">Add own</dt> <dd className="inline">(Family Pantry areas): everything in Use, plus add new things and change only what they added.</dd></div>
      <div><dt className="inline font-semibold text-ink">Add &amp; edit:</dt> <dd className="inline">everything in Use, plus create new things (lists, events, goals…) and change or delete the things they added. Only parents can change what someone else added, and nobody sees someone else&apos;s &ldquo;Only me&rdquo; items.</dd></div>
    </dl>
  );
}

/**
 * One member's module → access selects, named perm:<memberId>:<module> so
 * they post with any server-action form. Shared by onboarding and Family.
 */
export type PeriodSetting = "hide" | "basic" | "ovulation" | "fertility";
export const PERIOD_OPTIONS: { value: PeriodSetting; label: string; hint: string }[] = [
  { value: "hide", label: "No access", hint: "not on their profile at all (records are kept)" },
  { value: "basic", label: "Basic", hint: "periods, symptoms, feelings and the next period" },
  { value: "ovulation", label: "Ovulation", hint: "adds the estimated ovulation window and day" },
  { value: "fertility", label: "Fertility", hint: "the same estimates, labelled as a fertile window" },
];
/** Personal areas set in the same list: Period Tracker (its own choices) and Mental Wellness (No access / Use). */
export type PersonalAreas = { period: PeriodSetting; wellness: boolean; finance: boolean; info: boolean; projects: boolean; vehicles: boolean };

/** A member's own private spaces: only they ever see them (parents can't). */
const PRIVATE_SPACES = [
  { key: "finance", field: "finance", icon: "Wallet", label: "My Budget" },
  { key: "info", field: "pinfo", icon: "KeyRound", label: "My Important Info" },
  { key: "projects", field: "pprojects", icon: "Hammer", label: "My Home Projects" },
  { key: "vehicles", field: "pvehicles", icon: "Car", label: "My Vehicles" },
] as const;

const selectCls = "h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm focus:border-primary-500 focus:outline-none";

export function PermissionRows({
  memberId,
  access,
  modules,
  personal,
}: {
  memberId: string;
  access: Partial<Record<Module, AccessLevel>>;
  modules: Module[];
  /** Personal areas on this member's profile, shown as rows in the same list. */
  personal?: PersonalAreas;
}) {
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      {personal && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5">
            <label htmlFor={`period-${memberId}`} className="flex items-center gap-2.5 text-[15px]">
              <Icon name="CalendarHeart" className="size-4 text-muted" />
              Period Tracker
            </label>
            <select id={`period-${memberId}`} name={`period:${memberId}`} defaultValue={personal.period} className={selectCls}>
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5">
            <label htmlFor={`wellness-${memberId}`} className="flex items-center gap-2.5 text-[15px]">
              <Icon name="Smile" className="size-4 text-muted" />
              Mental Wellness
            </label>
            <select id={`wellness-${memberId}`} name={`area:${memberId}:wellness`} defaultValue={personal.wellness ? "use" : "none"} className={selectCls}>
              <option value="none">No access</option>
              <option value="use">Use</option>
            </select>
          </div>
          {PRIVATE_SPACES.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5">
              <label htmlFor={`${p.field}-${memberId}`} className="flex items-center gap-2.5 text-[15px]">
                <Icon name={p.icon} className="size-4 text-muted" />
                <span>
                  {p.label} <span className="text-sm text-muted">(private)</span>
                </span>
              </label>
              <select id={`${p.field}-${memberId}`} name={`${p.field}:${memberId}`} defaultValue={personal[p.key] ? "on" : "off"} className={selectCls}>
                <option value="off">No access</option>
                <option value="on">Use</option>
              </select>
            </div>
          ))}
        </>
      )}
      {modules.filter((m) => !PARENT_ONLY_MODULES.includes(m)).map((mod) => {
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
