import type { FieldDef, FieldValue } from "@/lib/record-fields";
import { cn } from "@/lib/utils";

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Display any non-empty fields of a config-driven record as a definition list. */
export function DetailList({
  fields,
  values,
  skip = [],
  className,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  skip?: string[];
  className?: string;
}) {
  const rows = fields
    .filter((f) => !skip.includes(f.name) && f.type !== "image" && f.type !== "file")
    .map((f) => {
      const v = values[f.name] as FieldValue | undefined;
      let text = "";
      if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
      if (f.type === "date") text = fmtDate(String(v));
      else if (f.type === "money") text = fmtMoney(Number(v));
      else if (f.type === "checkbox") text = v ? "Yes" : "No";
      else if (f.type === "select") text = f.options?.find((o) => o.value === v)?.label ?? String(v);
      else if (Array.isArray(v)) text = v.join(", ");
      else text = String(v);
      return { f, text };
    })
    .filter(Boolean) as { f: FieldDef; text: string }[];
  if (!rows.length) return null;
  return (
    <dl className={cn("grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2", className)}>
      {rows.map(({ f, text }) => (
        <div key={f.name} className={cn("min-w-0", (f.type === "textarea" || f.full) && "sm:col-span-2")}>
          <dt className="text-xs font-medium text-muted">{f.label}</dt>
          <dd className="break-words whitespace-pre-line text-ink">
            {f.type === "url" ? (
              <a href={text} target="_blank" rel="noreferrer noopener" className="text-primary-700 underline">
                {text}
              </a>
            ) : (
              text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
