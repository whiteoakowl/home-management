"use client";

import { savePeriodSettings } from "@/app/actions/health";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, FormRow, NumberField, TextField } from "@/components/forms/fields";

/** Typical lengths (used until enough cycles are recorded) and the person's own symptoms & feelings. */
const MODE_TEXT = {
  basic: "Basic: periods, symptoms, feelings and the next period",
  ovulation: "Ovulation: also the estimated ovulation window and day",
  fertility: "Fertility: the same estimates, shown as a fertile window",
} as const;

export function PeriodSettingsForm({ memberId, cycle, period, customSymptoms, customFeelings, enabled, mode = "basic", canChooseMode = false }: { memberId: string; cycle: number; period: number; customSymptoms: string[]; customFeelings: string[]; enabled?: boolean; mode?: "basic" | "ovulation" | "fertility"; canChooseMode?: boolean }) {
  return (
    <ActionForm action={savePeriodSettings} submitLabel={enabled === false ? "Turn on Period Tracker" : "Save settings"} resetOnSuccess={false} showSuccess>
      <input type="hidden" name="memberId" value={memberId} />
      {enabled === false && <input type="hidden" name="periodEnabled" value="true" />}
      <FormRow>
        <NumberField name="typicalCycleLength" label="Typical cycle length (days)" min={15} max={60} defaultValue={cycle} hint="Used until you've recorded a couple of cycles." />
        <NumberField name="typicalPeriodLength" label="Typical period length (days)" min={1} max={14} defaultValue={period} />
      </FormRow>
      <TextField name="customSymptoms" label="My own symptoms" defaultValue={customSymptoms.join(", ")} placeholder="Leg cramps, Cravings" hint="Comma separated" />
      {canChooseMode ? (
        <SelectField name="periodMode" label="What the tracker shows" defaultValue={mode} options={(Object.keys(MODE_TEXT) as (keyof typeof MODE_TEXT)[]).map((k) => ({ value: k, label: MODE_TEXT[k] }))} />
      ) : (
        enabled !== false && <p className="text-sm text-muted">{MODE_TEXT[mode]} (set by your parents).</p>
      )}
      <TextField name="customFeelings" label="My own feelings" defaultValue={customFeelings.join(", ")} placeholder="Restless, Focused" hint="Comma separated" />
    </ActionForm>
  );
}
