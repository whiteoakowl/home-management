"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Camera, ImagePlus, Lock, ShieldCheck, Upload, Users, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useFieldError } from "./action-form";

export type MemberOption = { id: string; displayName: string; color: string };

type Base = { name: string; label: ReactNode; hint?: ReactNode; className?: string };

export function TextField({ name, label, hint, className, ...props }: Base & ComponentProps<"input">) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={error} className={className}>
      <Input id={`f-${name}`} name={name} aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function NumberField(props: Base & ComponentProps<"input">) {
  return <TextField type="number" inputMode="decimal" step="any" {...props} />;
}

export function DateField(props: Base & ComponentProps<"input">) {
  return <TextField type="date" {...props} />;
}

export function TextAreaField({ name, label, hint, className, ...props }: Base & ComponentProps<"textarea">) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={error} className={className}>
      <Textarea id={`f-${name}`} name={name} aria-invalid={!!error} {...props} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  className,
  options,
  placeholder,
  ...props
}: Base & ComponentProps<"select"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const error = useFieldError(name);
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={error} className={className}>
      <Select id={`f-${name}`} name={name} aria-invalid={!!error} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function MemberSelect({
  name,
  label = "Assigned to",
  members,
  defaultValue,
  placeholder = "Anyone",
  className,
}: {
  name: string;
  label?: string;
  members: MemberOption[];
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
}) {
  return (
    <SelectField
      name={name}
      label={label}
      className={className}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      options={members.map((m) => ({ value: m.id, label: m.displayName }))}
    />
  );
}

/** Toggleable avatar chips that post as repeated `name` values. */
export function MemberChips({
  name,
  members,
  defaultValue = [],
}: {
  name: string;
  members: MemberOption[];
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button
            type="button"
            key={m.id}
            aria-pressed={on}
            onClick={() => toggle(m.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1 text-sm transition-colors",
              on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong text-ink-soft hover:bg-sunken",
            )}
          >
            <Avatar name={m.displayName} color={m.color} size="sm" />
            {m.displayName}
            {on && <input type="hidden" name={name} value={m.id} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Who can see this record: whole family / selected people / parents & me / only me.
 * Posts `visibility` and repeated `visibleTo`. Parents get no automatic access:
 * they see a record only if the creator picks an option that includes them.
 */
export function VisibilityField({
  members,
  defaultValue = "family",
  defaultSelected = [],
  privateLabel = "Only me",
  parentsLabel = "Parents & me",
  privateHint = "Only you will see this. Nobody else, parents included.",
  parentsHint = "Only you and the parents will see this. Other family members won't.",
  parentsOption = true,
}: {
  members: MemberOption[];
  defaultValue?: "family" | "private" | "selected" | "parents";
  defaultSelected?: string[];
  privateLabel?: string;
  parentsLabel?: string;
  privateHint?: string;
  parentsHint?: string;
  parentsOption?: boolean;
}) {
  const [v, setV] = useState(defaultValue);
  const opts = [
    { value: "family", label: "Whole family", icon: UsersRound },
    { value: "selected", label: "Selected people", icon: Users },
    ...(parentsOption ? [{ value: "parents", label: parentsLabel, icon: ShieldCheck } as const] : []),
    { value: "private", label: privateLabel, icon: Lock },
  ] as const;
  const hint = v === "private" ? privateHint : v === "parents" ? parentsHint : v === "family" ? "Everyone in the family can see this." : null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">Who can see this</legend>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
              v === o.value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong hover:bg-sunken",
            )}
          >
            <input type="radio" name="visibility" value={o.value} checked={v === o.value} onChange={() => setV(o.value)} className="sr-only" />
            <o.icon className="size-4 shrink-0" aria-hidden />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {v === "selected" && (
        <div className="mt-1">
          <MemberChips name="visibleTo" members={members} defaultValue={defaultSelected} />
          <p className="mt-1.5 text-xs text-muted">Only the people you pick (and you) will see this. Parents too only if you pick them.</p>
        </div>
      )}
    </fieldset>
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type RuleDefaults = {
  freq?: string | null;
  interval?: number | null;
  byWeekday?: number[] | null;
  byMonthDay?: number[] | null;
  byMonth?: number[] | null;
  until?: string | null;
};

/** Repeat picker. Posts repeat, interval, weekday[], monthDay, month[], until. */
export function RecurrenceField({ defaults, label = "Repeats" }: { defaults?: RuleDefaults | null; label?: string }) {
  const [freq, setFreq] = useState(defaults?.freq ?? "none");
  const [days, setDays] = useState<number[]>(defaults?.byWeekday ?? []);
  const [months, setMonths] = useState<number[]>(defaults?.byMonth ?? []);
  const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[freq] ?? "";
  const toggle = (arr: number[], set: (x: number[]) => void, n: number) => set(arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n]);

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label={label} htmlFor="f-repeat">
          <Select id="f-repeat" name="repeat" value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly / seasonal</option>
          </Select>
        </Field>
        {freq !== "none" && (
          <Field label={`Every … ${unit}s`} htmlFor="f-interval">
            <Input id="f-interval" name="interval" type="number" min={1} max={99} defaultValue={defaults?.interval ?? 1} className="w-24" />
          </Field>
        )}
      </div>
      {freq === "weekly" && (
        <div className="flex gap-1.5" role="group" aria-label="On days">
          {WEEKDAYS.map((w, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={days.includes(i)}
              aria-label={WEEKDAY_NAMES[i]}
              onClick={() => toggle(days, setDays, i)}
              className={cn(
                "size-10 rounded-full text-sm font-semibold",
                days.includes(i) ? "bg-primary-600 text-white" : "bg-sunken text-ink-soft hover:bg-line",
              )}
            >
              {w}
              {days.includes(i) && <input type="hidden" name="weekday" value={i} />}
            </button>
          ))}
        </div>
      )}
      {freq === "monthly" && (
        <Field label="Day of month" htmlFor="f-monthDay" hint="Leave blank to use the start date's day.">
          <Input id="f-monthDay" name="monthDay" type="number" min={1} max={31} defaultValue={defaults?.byMonthDay?.[0] ?? ""} className="w-28" />
        </Field>
      )}
      {freq === "yearly" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="In months">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-pressed={months.includes(i + 1)}
              onClick={() => toggle(months, setMonths, i + 1)}
              className={cn(
                "h-9 rounded-full px-3 text-sm font-medium",
                months.includes(i + 1) ? "bg-primary-600 text-white" : "bg-sunken text-ink-soft hover:bg-line",
              )}
            >
              {m}
              {months.includes(i + 1) && <input type="hidden" name="month" value={i + 1} />}
            </button>
          ))}
          <p className="w-full text-xs text-muted">Pick several months for seasonal tasks (e.g. Mar, Jun, Sep, Dec).</p>
        </div>
      )}
      {freq !== "none" && (
        <Field label="Ends (optional)" htmlFor="f-until">
          <Input id="f-until" name="until" type="date" defaultValue={defaults?.until ?? ""} className="w-48" />
        </Field>
      )}
    </fieldset>
  );
}

/** Image picker with preview: take a photo or upload one. Posts the file under `name` (+ `removeImage`). */
export function ImageField({ name = "image", label = "Photo", currentUrl }: { name?: string; label?: string; currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [removed, setRemoved] = useState(false);
  // Only the input that was used last carries the field name, so one file is posted.
  const [source, setSource] = useState<"camera" | "upload">("upload");
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const error = useFieldError(name);
  const pick = (from: "camera" | "upload", file: File | undefined) => {
    if (!file) return;
    const other = from === "camera" ? uploadRef.current : cameraRef.current;
    if (other) other.value = "";
    setSource(from);
    setPreview(URL.createObjectURL(file));
    setRemoved(false);
  };
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-sunken";
  return (
    <Field label={label} error={error}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => uploadRef.current?.click()} aria-label={preview ? "Change photo" : "Upload a photo"} className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-sunken/60 text-muted hover:border-primary-400 hover:text-primary-600">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-7" aria-hidden />
          )}
        </button>
        <div className="flex flex-col gap-2 text-sm text-muted">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" aria-hidden /> Take photo
            </button>
            <button type="button" className={btn} onClick={() => uploadRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> Upload photo
            </button>
          </div>
          {preview && (
            <button
              type="button"
              className="w-fit text-wine-500 hover:underline"
              onClick={() => {
                setPreview(null);
                setRemoved(true);
                if (cameraRef.current) cameraRef.current.value = "";
                if (uploadRef.current) uploadRef.current.value = "";
              }}
            >
              Remove photo
            </button>
          )}
          {removed && <input type="hidden" name="removeImage" value="1" />}
        </div>
        <input ref={cameraRef} type="file" name={source === "camera" ? name : undefined} accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => pick("camera", e.target.files?.[0])} />
        <input ref={uploadRef} type="file" name={source === "upload" ? name : undefined} accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick("upload", e.target.files?.[0])} />
      </div>
    </Field>
  );
}

/**
 * Several photos at once: "Take photo" (camera, adds one each time) and "Upload photos"
 * (choose existing ones). All chosen files are posted under `name`.
 */
export function PhotosField({ name = "photos", label = "Photos", required, accept = "image/*", max = 12 }: { name?: string; label?: string; required?: boolean; accept?: string; max?: number }) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fieldRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const error = useFieldError(name);
  const sync = (next: File[]) => {
    const list = next.slice(0, max);
    setFiles(list);
    setPreviews(list.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : "")));
    // Put the files on the one named input that the form posts.
    try {
      const dt = new DataTransfer();
      list.forEach((f) => dt.items.add(f));
      if (fieldRef.current) fieldRef.current.files = dt.files;
    } catch {
      /* very old browsers: the upload input below still carries its own files */
    }
  };
  const add = (input: HTMLInputElement | null) => {
    if (!input?.files?.length) return;
    sync([...files, ...Array.from(input.files)]);
    input.value = "";
  };
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-sunken";
  return (
    <Field label={label} error={error}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => cameraRef.current?.click()}>
            <Camera className="size-4" aria-hidden /> Take photo
          </button>
          <button type="button" className={btn} onClick={() => uploadRef.current?.click()}>
            <Upload className="size-4" aria-hidden /> Upload {accept.includes("pdf") ? "files" : "photos"}
          </button>
        </div>
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li key={i} className="relative">
                {previews[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[i]} alt="" className="size-16 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center rounded-lg bg-sunken p-1 text-center text-[10px] break-all text-muted">{f.name}</span>
                )}
                <button type="button" onClick={() => sync(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full bg-ink text-xs text-white">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Nothing chosen yet{max > 1 ? ` (up to ${max})` : ""}.</p>
        )}
        <input ref={fieldRef} type="file" name={name} accept={accept} multiple required={required && files.length === 0} className="sr-only" tabIndex={-1} aria-hidden />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => add(e.target)} />
        <input ref={uploadRef} type="file" accept={accept} multiple className="sr-only" tabIndex={-1} onChange={(e) => add(e.target)} />
      </div>
    </Field>
  );
}

export function CheckboxField({ name, label, description, defaultChecked }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
      <span className="flex flex-col">
        <span className="text-[15px]">{label}</span>
        {description && <span className="text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn("grid gap-4", { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[cols])}>{children}</div>;
}

/** Shows the server-side error for a field that isn't rendered with a *Field helper. */
export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  if (!error?.length) return null;
  return (
    <p className="text-sm text-wine-700" role="alert">
      {error[0]}
    </p>
  );
}

/** Toggleable chips for any options; posts repeated `name` values. */
export function ChipSelect({ name, options, defaultValue = [] }: { name: string; options: { value: string; label: string }[]; defaultValue?: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            aria-pressed={on}
            onClick={() => setSelected((s) => (on ? s.filter((x) => x !== o.value) : [...s, o.value]))}
            className={cn("h-9 rounded-full border px-3.5 text-sm transition-colors", on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-line-strong text-ink-soft hover:bg-sunken")}
          >
            {o.label}
            {on && <input type="hidden" name={name} value={o.value} />}
          </button>
        );
      })}
    </div>
  );
}
