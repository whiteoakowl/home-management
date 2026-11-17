"use client";

import { Gauge, Landmark, Package, Pencil, Plus, Wrench } from "lucide-react";
import { logMileage, saveLoan, savePart, saveScheduleItem, saveService, saveVehicle } from "@/app/actions/vehicles";
import { FormModal } from "@/components/forms/action-form";
import { CheckboxField, DateField, FormRow, ImageField, MemberSelect, NumberField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";

const editIcon = <Pencil className="mx-auto size-4" />;
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";

export type VehicleDefaults = {
  id: string; nickname: string; year: number | null; make: string | null; model: string | null; trim: string | null; color: string | null; vin: string | null; plate: string | null;
  driverMemberId: string | null; imageUrl: string | null; purchaseDate: string | null; purchasePrice: number | null; oilType: string | null; tireSize: string | null;
  insuranceCompany: string | null; insurancePolicy: string | null; insuranceRenewsOn: string | null; registrationExpiresOn: string | null; inspectionDueOn: string | null; active: boolean; notes: string | null;
};

export function VehicleModal({ members, item, defaultOpen }: { members: MemberOption[]; item?: VehicleDefaults; defaultOpen?: boolean }) {
  return (
    <FormModal title={item ? `Edit ${item.nickname}` : "Add a vehicle"} triggerLabel={item ? "Edit" : "Add vehicle"} triggerVariant={item ? "secondary" : "primary"} triggerIcon={item ? <Pencil className="size-4" /> : <Plus className="size-4" />} action={saveVehicle} submitLabel={item ? "Save" : "Add"} size="lg" defaultOpen={defaultOpen}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="nickname" label="Name" required defaultValue={item?.nickname} placeholder="Mom's SUV" />
        <MemberSelect name="driverMemberId" label="Main driver" members={members} defaultValue={item?.driverMemberId} placeholder="Shared" />
      </FormRow>
      <FormRow cols={3}>
        <NumberField name="year" label="Year" min={1900} defaultValue={item?.year ?? ""} />
        <TextField name="make" label="Make" defaultValue={item?.make ?? ""} placeholder="Toyota" />
        <TextField name="model" label="Model" defaultValue={item?.model ?? ""} placeholder="Highlander" />
      </FormRow>
      <FormRow cols={3}>
        <TextField name="trim" label="Trim" defaultValue={item?.trim ?? ""} />
        <TextField name="color" label="Color" defaultValue={item?.color ?? ""} />
        <TextField name="plate" label="Plate" defaultValue={item?.plate ?? ""} />
      </FormRow>
      <FormRow>
        <TextField name="vin" label="VIN" defaultValue={item?.vin ?? ""} maxLength={17} />
        {!item && <NumberField name="miles" label="Current odometer (mi)" min={0} />}
      </FormRow>
      <ImageField currentUrl={item?.imageUrl} />
      <FormRow>
        <TextField name="oilType" label="Oil" defaultValue={item?.oilType ?? ""} placeholder="0W-20 full synthetic, 5.7 qt" />
        <TextField name="tireSize" label="Tire size" defaultValue={item?.tireSize ?? ""} placeholder="245/60R18" />
      </FormRow>
      <FormRow>
        <TextField name="insuranceCompany" label="Insurance" defaultValue={item?.insuranceCompany ?? ""} />
        <TextField name="insurancePolicy" label="Policy #" defaultValue={item?.insurancePolicy ?? ""} />
      </FormRow>
      <FormRow cols={3}>
        <DateField name="insuranceRenewsOn" label="Insurance renews" defaultValue={item?.insuranceRenewsOn ?? ""} />
        <DateField name="registrationExpiresOn" label="Registration expires" defaultValue={item?.registrationExpiresOn ?? ""} />
        <DateField name="inspectionDueOn" label="Inspection due" defaultValue={item?.inspectionDueOn ?? ""} />
      </FormRow>
      <FormRow>
        <DateField name="purchaseDate" label="Purchased" defaultValue={item?.purchaseDate ?? ""} />
        <NumberField name="purchasePrice" label="Price ($)" min={0} step="0.01" defaultValue={item?.purchasePrice ?? ""} />
      </FormRow>
      {item && <SelectField name="active" label="Status" defaultValue={item.active ? "yes" : "no"} options={[{ value: "yes", label: "In the family" }, { value: "no", label: "Sold / retired" }]} />}
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="Spare key in the kitchen drawer…" />
    </FormModal>
  );
}

export function MileageModal({ vehicleId, today, current }: { vehicleId: string; today: string; current: number | null }) {
  return (
    <FormModal title="Update mileage" triggerLabel="Mileage" triggerVariant="secondary" triggerIcon={<Gauge className="size-4" />} action={logMileage} size="sm" submitLabel="Save">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <FormRow>
        <NumberField name="miles" label="Odometer (mi)" required min={0} placeholder={current ? String(current) : ""} inputMode="numeric" />
        <DateField name="date" label="Date" defaultValue={today} />
      </FormRow>
    </FormModal>
  );
}

export type ServiceDefaults = { id: string; scheduleId: string | null; date: string; miles: number | null; kind: string; title: string; shop: string | null; parts: string | null; cost: number | null; notes: string | null };

export function ServiceModal({ vehicleId, today, schedule, canBudget, item, preset, label, triggerVariant = "primary", currentMiles }: { vehicleId: string; today: string; schedule: { id: string; title: string }[]; canBudget: boolean; item?: ServiceDefaults; preset?: { scheduleId: string; title: string }; label?: string; triggerVariant?: "primary" | "secondary" | "soft" | "ghost"; currentMiles?: number | null }) {
  return (
    <FormModal
      title={item ? "Edit work" : preset ? `Done: ${preset.title}` : "Log work done"}
      triggerLabel={label ?? "Log work"}
      triggerVariant={triggerVariant}
      triggerSize={label ? "sm" : "md"}
      triggerIcon={<Wrench className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? "Edit" : undefined}
      triggerClassName={iconBtn}
      action={saveService}
    >
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="title" label="What was done" required={!preset} defaultValue={item?.title ?? preset?.title ?? ""} placeholder="Oil change, new brake pads…" />
        <SelectField name="kind" label="Type" defaultValue={item?.kind ?? "maintenance"} options={[{ value: "maintenance", label: "Maintenance" }, { value: "repair", label: "Repair" }, { value: "inspection", label: "Inspection" }, { value: "tires", label: "Tires" }, { value: "upgrade", label: "Upgrade / accessory" }, { value: "other", label: "Other" }]} />
      </FormRow>
      <SelectField name="scheduleId" label="Counts as (maintenance plan)" defaultValue={item?.scheduleId ?? preset?.scheduleId ?? ""} placeholder="Nothing on the plan" options={schedule.map((s) => ({ value: s.id, label: s.title }))} hint="Marks that item done, so the next due date resets." />
      <FormRow>
        <DateField name="date" label="Date" defaultValue={item?.date ?? today} />
        <NumberField name="miles" label="Odometer (mi)" min={0} defaultValue={item?.miles ?? ""} placeholder={currentMiles ? String(currentMiles) : ""} inputMode="numeric" />
      </FormRow>
      <FormRow>
        <TextField name="shop" label="Shop / who did it" defaultValue={item?.shop ?? ""} placeholder="Dealer, Jiffy Lube, DIY" />
        <NumberField name="cost" label="Cost ($)" min={0} step="0.01" defaultValue={item?.cost ?? ""} />
      </FormRow>
      <TextAreaField name="parts" label="Parts used (one per line)" rows={3} defaultValue={item?.parts ?? ""} placeholder={"Oil filter: Fram PH7317\n5 qt 0W-20 synthetic"} />
      <ImageField name="receipt" label="Receipt photo (optional)" />
      {canBudget && !item && <CheckboxField name="addToBudget" label="Also record the cost in the family budget (Car)" />}
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} placeholder="Mechanic said rear brakes have ~5k miles left" />
    </FormModal>
  );
}

export function ScheduleModal({ vehicleId, item }: { vehicleId: string; item?: { id: string; title: string; everyMiles: number | null; everyMonths: number | null; lastDate: string | null; lastMiles: number | null; notes: string | null } }) {
  return (
    <FormModal title={item ? `Edit ${item.title}` : "Add to the maintenance plan"} triggerLabel="Add" triggerVariant="ghost" triggerSize="sm" triggerIcon={<Plus className="size-4" />} triggerContent={item ? editIcon : undefined} triggerAriaLabel={item ? `Edit ${item.title}` : undefined} triggerClassName={iconBtn} action={saveScheduleItem} size="sm">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <TextField name="title" label="Item" required defaultValue={item?.title} placeholder="Oil & filter change" />
      <FormRow>
        <NumberField name="everyMiles" label="Every (miles)" min={0} defaultValue={item?.everyMiles ?? ""} placeholder="5000" />
        <NumberField name="everyMonths" label="Or every (months)" min={0} defaultValue={item?.everyMonths ?? ""} placeholder="6" />
      </FormRow>
      <FormRow>
        <DateField name="lastDate" label="Last done" defaultValue={item?.lastDate ?? ""} />
        <NumberField name="lastMiles" label="At (miles)" min={0} defaultValue={item?.lastMiles ?? ""} />
      </FormRow>
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} />
    </FormModal>
  );
}

export function PartModal({ vehicleId, item }: { vehicleId: string; item?: { id: string; name: string; partNumber: string | null; brand: string | null; whereToBuy: string | null; lastReplacedOn: string | null; notes: string | null } }) {
  return (
    <FormModal title={item ? `Edit ${item.name}` : "Add a part or spec"} triggerLabel="Add" triggerVariant="ghost" triggerSize="sm" triggerIcon={<Package className="size-4" />} triggerContent={item ? editIcon : undefined} triggerAriaLabel={item ? `Edit ${item.name}` : undefined} triggerClassName={iconBtn} action={savePart} size="sm">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <TextField name="name" label="Part" required defaultValue={item?.name} placeholder="Wiper blades (front)" />
        <TextField name="partNumber" label="Part # / size" defaultValue={item?.partNumber ?? ""} placeholder='26" + 16"' />
      </FormRow>
      <FormRow>
        <TextField name="brand" label="Brand" defaultValue={item?.brand ?? ""} />
        <TextField name="whereToBuy" label="Where to buy" defaultValue={item?.whereToBuy ?? ""} />
      </FormRow>
      <DateField name="lastReplacedOn" label="Last replaced" defaultValue={item?.lastReplacedOn ?? ""} />
      <TextField name="notes" label="Notes" defaultValue={item?.notes ?? ""} />
    </FormModal>
  );
}

export function LoanModal({ vehicleId, loan }: { vehicleId: string; loan?: { lender: string | null; amount: number; apr: number; payment: number; startDate: string; termMonths: number } }) {
  return (
    <FormModal title={loan ? "Edit loan" : "Add a car loan"} triggerLabel={loan ? "Edit loan" : "Add loan"} triggerVariant="ghost" triggerSize="sm" triggerIcon={<Landmark className="size-4" />} action={saveLoan} size="sm" description="Leave the monthly payment blank and we'll work it out.">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <TextField name="lender" label="Lender" defaultValue={loan?.lender ?? ""} placeholder="Credit union" />
      <FormRow>
        <NumberField name="amount" label="Amount financed ($)" required min={0} step="0.01" defaultValue={loan?.amount ?? ""} />
        <NumberField name="apr" label="APR (%)" min={0} step="0.01" defaultValue={loan?.apr ?? ""} placeholder="6.9" />
      </FormRow>
      <FormRow>
        <NumberField name="termMonths" label="Term (months)" required min={1} defaultValue={loan?.termMonths ?? ""} placeholder="60" />
        <DateField name="startDate" label="Loan start" required defaultValue={loan?.startDate ?? ""} />
      </FormRow>
      <NumberField name="payment" label="Monthly payment ($)" min={0} step="0.01" defaultValue={loan?.payment ?? ""} hint="Include any extra you pay each month." />
    </FormModal>
  );
}
