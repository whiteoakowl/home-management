"use client";

import { savePeriodSettings } from "@/app/actions/health";
import { ActionForm } from "@/components/forms/action-form";
import { FormRow, NumberField, TextField } from "@/components/forms/fields";

/** Typical lengths (used until enough cycles are recorded) and the person's own symptoms & feelings. */
export function PeriodSettingsForm({ memberId, cycle, period, customSymptoms, customFeelings, enabled, showOvulation = false, canChooseOvulation = false }: { memberId: string; cycle: number; period: number; customSymptoms: string[]; customFeelings: string[]; enabled?: boolean; showOvulation?: boolean; canChooseOvulation?: boolean }) {
  return (
    <ActionForm action={savePeriodSettings} submitLabel={enabled === false ? "Turn on Period Tracker" : "Save settings"} resetOnSuccess={false} showSuccess>
      <input type="hidden" name="memberId" value={memberId} />
      {enabled === false && <input type="hidden" name="periodEnabled" value="true" />}
      <FormRow>
        <NumberField name="typicalCycleLength" label="Typical cycle length (days)" min={15} max={60} defaultValue={cycle} hint="Used until you've recorded a couple of cycles." />
        <NumberField name="typicalPeriodLength" label="Typical period length (days)" min={1} max={14} defaultValue={period} />
      </FormRow>
      <TextField name="customSymptoms" label="My own symptoms" defaultValue={customSymptoms.join(", ")} placeholder="Leg cramps, Cravings" hint="Comma separated" />
      {canChooseOvulation ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="hidden" name="showOvulationSet" value="1" />
          <input type="checkbox" name="showOvulation" defaultChecked={showOvulation} className="mt-0.5 size-4 accent-[var(--color-primary-600)]" />
          <span>
            Show ovulation estimates
            <span className="block text-xs text-muted">Off = simple period tracking (periods only).</span>
          </span>
        </label>
      ) : (
        enabled !== false && <p className="text-sm text-muted">{showOvulation ? "Ovulation estimates are on (set by your parents)." : "Simple period tracking. Ovulation estimates are off (your parents can change this)."}</p>
      )}
      <TextField name="customFeelings" label="My own feelings" defaultValue={customFeelings.join(", ")} placeholder="Restless, Focused" hint="Comma separated" />
    </ActionForm>
  );
}
