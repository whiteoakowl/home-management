"use client";

import { useState } from "react";
import { Lock, ShieldCheck, Users } from "lucide-react";
import { savePrivacy } from "@/app/actions/privacy";
import { ActionForm } from "@/components/forms/action-form";
import { MemberChips, type MemberOption } from "@/components/forms/fields";
import { cn } from "@/lib/utils";

type Audience = "private" | "parents" | "selected";

/** One Privacy Center row: Private to me / Share with parents / Share with selected people. */
export function PrivacyForm({
  category,
  audience,
  memberIds,
  members,
  options,
  optionLabels = {},
  perEntry,
}: {
  category: string;
  audience: Audience;
  memberIds: string[];
  members: MemberOption[];
  options: Record<string, boolean>;
  optionLabels?: Record<string, string>;
  perEntry?: boolean;
}) {
  const [v, setV] = useState<Audience>(audience);
  const choices = [
    { value: "private", label: perEntry ? "Private (only me)" : "Private to me", icon: Lock },
    { value: "parents", label: "Share with parents", icon: ShieldCheck },
    { value: "selected", label: "Share with selected people", icon: Users },
  ] as const;
  return (
    <ActionForm action={savePrivacy} submitLabel="Save" resetOnSuccess={false} showSuccess className="gap-3">
      <input type="hidden" name="category" value={category} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{perEntry ? "Default for new entries" : "Who can see this"}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map((c) => (
            <label
              key={c.value}
              className={cn(
                "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                v === c.value ? (c.value === "private" ? "border-olive-400 bg-olive-50 text-olive-700" : "border-primary-500 bg-primary-50 text-primary-700") : "border-line-strong hover:bg-sunken",
              )}
            >
              <input type="radio" name="audience" value={c.value} checked={v === c.value} onChange={() => setV(c.value)} className="sr-only" />
              <c.icon className="size-4 shrink-0" aria-hidden />
              {c.label}
            </label>
          ))}
        </div>
        {v === "selected" && <MemberChips name="memberIds" members={members} defaultValue={memberIds} />}
        {v === "parents" && <p className="text-xs text-muted">Parents can view it. They can&apos;t change it.</p>}
      </fieldset>
      {Object.entries(optionLabels).map(([k, label]) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={k} defaultChecked={!!options[k]} className="size-4 accent-[var(--color-primary-600)]" />
          {label}
        </label>
      ))}
    </ActionForm>
  );
}
