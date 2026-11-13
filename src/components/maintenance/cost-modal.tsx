import { Pencil } from "lucide-react";
import { logMaintenanceCost } from "@/app/actions/maintenance";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, NumberField } from "@/components/forms/fields";

export function MaintenanceCostModal({ occurrenceId, current, canBudget }: { occurrenceId: string; current: number | null; canBudget: boolean }) {
  return (
    <FormModal
      title="Actual cost"
      action={logMaintenanceCost}
      size="sm"
      triggerContent={<Pencil className="mx-auto size-3.5" />}
      triggerAriaLabel="Record actual cost"
      triggerClassName="size-7 rounded-full text-muted hover:bg-sunken"
    >
      <input type="hidden" name="id" value={occurrenceId} />
      <NumberField name="cost" label="Actual cost ($)" step="0.01" min={0} defaultValue={current !== null ? current / 100 : ""} />
      {canBudget && current === null && <CheckboxField name="addToBudget" label="Also record it in the budget (Home maintenance)" />}
    </FormModal>
  );
}
