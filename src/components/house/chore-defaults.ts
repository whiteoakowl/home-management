import type { ChoreTemplate } from "@/lib/chores";
import type { ChoreDefaults } from "./chore-form";

/** Template row → form defaults for ChoreFormModal. */
export function toChoreDefaults(t: ChoreTemplate): ChoreDefaults {
  const c = t.chore;
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    instructions: c.instructions,
    roomId: c.roomId,
    categoryId: c.categoryId,
    cleaningCadence: c.cleaningCadence,
    priority: c.priority,
    estimatedMinutes: c.estimatedMinutes,
    defaultAssigneeId: c.defaultAssigneeId,
    dueDate: c.dueDate,
    notes: c.notes,
    rule: t.rule
      ? {
          freq: t.rule.freq,
          interval: t.rule.interval,
          byWeekday: t.rule.byWeekday ?? null,
          byMonthDay: t.rule.byMonthDay ?? null,
          byMonth: t.rule.byMonth ?? null,
          until: t.rule.until ?? null,
          startsOn: t.rule.startsOn,
        }
      : null,
    checklist: t.checklist.map((i) => ({ text: i.text, assigneeId: i.assigneeId })),
  };
}
