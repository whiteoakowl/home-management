/**
 * Config-driven record fields: one definition drives the form (client) and
 * the parsing (server). Pure module: safe to import anywhere.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "money"
  | "select"
  | "tags"
  | "member"
  | "checkbox"
  | "url"
  | "image"
  | "file";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  /** Spans the full row (textareas default to full). */
  full?: boolean;
  /** Group heading shown before this field. */
  section?: string;
  rows?: number;
};

export type FieldValue = string | number | boolean | string[] | null;

/** Parse a FormData against field definitions (images/files are handled by the caller). */
export function parseFields(fd: FormData, fields: FieldDef[]): { values: Record<string, FieldValue>; errors: Record<string, string[]> } {
  const values: Record<string, FieldValue> = {};
  const errors: Record<string, string[]> = {};
  for (const f of fields) {
    if (f.type === "image" || f.type === "file") continue;
    const raw = fd.get(f.name);
    const str = typeof raw === "string" ? raw.trim() : "";
    let v: FieldValue = null;
    switch (f.type) {
      case "checkbox":
        v = raw === "on" || raw === "true";
        break;
      case "number":
        v = str === "" ? null : Number(str);
        if (v !== null && !Number.isFinite(v)) (errors[f.name] ??= []).push("Enter a number.");
        break;
      case "money":
        v = str === "" ? null : Math.round(Number(str) * 100);
        if (v !== null && !Number.isFinite(v)) (errors[f.name] ??= []).push("Enter an amount.");
        break;
      case "date":
        v = /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
        break;
      case "tags":
        v = str
          .split(/[,\n]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 40);
        break;
      case "select":
        v = str && (!f.options || f.options.some((o) => o.value === str)) ? str : null;
        break;
      case "url":
        v = str || null;
        if (v && !/^https?:\/\//i.test(v)) (errors[f.name] ??= []).push("Links must start with http:// or https://");
        break;
      default:
        v = str ? str.slice(0, f.type === "textarea" ? 20000 : 300) : null;
    }
    if (f.required && (v === null || v === "" || (Array.isArray(v) && !v.length))) (errors[f.name] ??= []).push(`${f.label} is required.`);
    values[f.name] = v;
  }
  return { values, errors };
}

export const opts = (...xs: (string | [string, string])[]) => xs.map((x) => (Array.isArray(x) ? { value: x[0], label: x[1] } : { value: x, label: x[0]!.toUpperCase() + x.slice(1).replace(/_/g, " ") }));
