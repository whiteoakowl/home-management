"use client";

import { Fragment, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import type { FormAction } from "./action-form";
import { FormModal } from "./action-form";
import {
  CheckboxField,
  DateField,
  ImageField,
  MemberSelect,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  VisibilityField,
  type MemberOption,
} from "./fields";
import { Field } from "@/components/ui/form";
import { useFieldError } from "./action-form";
import type { FieldDef, FieldValue } from "@/lib/record-fields";

function FileInput({ name, label }: { name: string; label: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={`f-${name}`} error={error}>
      <input id={`f-${name}`} name={name} type="file" accept="application/pdf,image/*" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700" />
    </Field>
  );
}

/** Renders inputs for a list of FieldDefs (inside any ActionForm/FormModal). */
export function ConfigFields({
  fields,
  defaults = {},
  members = [],
  imageUrls = {},
}: {
  fields: FieldDef[];
  defaults?: Record<string, FieldValue | undefined>;
  members?: MemberOption[];
  imageUrls?: Record<string, string | null>;
}) {
  const d = (k: string) => defaults[k];
  const str = (k: string) => {
    const v = d(k);
    return Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v);
  };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const full = f.full || f.type === "textarea" || f.type === "image" || f.type === "file" || f.type === "checkbox";
        let input: ReactNode;
        switch (f.type) {
          case "textarea":
            input = <TextAreaField name={f.name} label={f.label} rows={f.rows ?? 3} defaultValue={str(f.name)} placeholder={f.placeholder} hint={f.hint} required={f.required} />;
            break;
          case "date":
            input = <DateField name={f.name} label={f.label} defaultValue={str(f.name)} hint={f.hint} required={f.required} />;
            break;
          case "number":
            input = <NumberField name={f.name} label={f.label} defaultValue={str(f.name)} placeholder={f.placeholder} hint={f.hint} />;
            break;
          case "money": {
            const v = d(f.name);
            input = <NumberField name={f.name} label={f.label} step="0.01" min={0} defaultValue={typeof v === "number" ? v / 100 : ""} hint={f.hint} />;
            break;
          }
          case "select":
            input = <SelectField name={f.name} label={f.label} defaultValue={str(f.name) || (f.required ? f.options?.[0]?.value : "")} placeholder={f.required ? undefined : "—"} options={f.options ?? []} hint={f.hint} />;
            break;
          case "member":
            input = <MemberSelect name={f.name} label={f.label} members={members} defaultValue={(d(f.name) as string) ?? null} placeholder={f.required ? "Choose…" : "—"} />;
            break;
          case "checkbox":
            input = <CheckboxField name={f.name} label={f.label} description={f.hint} defaultChecked={!!d(f.name)} />;
            break;
          case "image":
            input = <ImageField name={f.name} label={f.label} currentUrl={imageUrls[f.name] ?? null} />;
            break;
          case "file":
            input = <FileInput name={f.name} label={f.label} />;
            break;
          case "tags":
            input = <TextField name={f.name} label={f.label} defaultValue={str(f.name)} placeholder={f.placeholder} hint={f.hint ?? "Comma separated"} />;
            break;
          case "url":
            input = <TextField name={f.name} label={f.label} type="url" defaultValue={str(f.name)} placeholder={f.placeholder ?? "https://"} hint={f.hint} />;
            break;
          default:
            input = <TextField name={f.name} label={f.label} defaultValue={str(f.name)} placeholder={f.placeholder} hint={f.hint} required={f.required} />;
        }
        return (
          <Fragment key={f.name}>
            {f.section && <p className="mt-2 border-t border-line pt-3 text-xs font-semibold tracking-[0.12em] text-muted uppercase sm:col-span-2">{f.section}</p>}
            <div className={full ? "sm:col-span-2" : undefined}>{input}</div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Create/edit modal for a config-driven record. */
export function RecordModal({
  title,
  action,
  fields,
  defaults,
  hidden = {},
  members,
  imageUrls,
  visibility,
  triggerLabel,
  edit,
  size = "lg",
  defaultOpen,
  triggerVariant,
}: {
  title: string;
  action: FormAction;
  fields: FieldDef[];
  defaults?: Record<string, FieldValue | undefined>;
  hidden?: Record<string, string>;
  members?: MemberOption[];
  imageUrls?: Record<string, string | null>;
  /** Show a who-can-see picker (posts visibility + visibleTo). */
  visibility?: { defaultValue?: "family" | "private" | "selected"; selected?: string[]; privateLabel?: string };
  triggerLabel?: string;
  /** Render as a small pencil button (edit mode). */
  edit?: boolean;
  size?: "sm" | "md" | "lg";
  defaultOpen?: boolean;
  triggerVariant?: "primary" | "secondary" | "soft" | "ghost";
}) {
  return (
    <FormModal
      title={title}
      action={action}
      submitLabel={edit ? "Save" : "Add"}
      size={size}
      defaultOpen={defaultOpen}
      triggerLabel={triggerLabel ?? title}
      triggerVariant={triggerVariant}
      triggerSize={triggerVariant === "ghost" || triggerVariant === "soft" ? "sm" : "md"}
      triggerContent={edit ? <Pencil className="mx-auto size-4" /> : undefined}
      triggerAriaLabel={edit ? title : undefined}
      triggerClassName={edit ? "size-9 rounded-full text-muted hover:bg-sunken" : undefined}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <ConfigFields fields={fields} defaults={defaults} members={members} imageUrls={imageUrls} />
      {visibility && members && <VisibilityField members={members} defaultValue={visibility.defaultValue} defaultSelected={visibility.selected} privateLabel={visibility.privateLabel} />}
    </FormModal>
  );
}
