"use client";

import type { ReactNode } from "react";
import { saveFeedOrder } from "@/app/actions/feed";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, TextAreaField, TextField, VisibilityField, type MemberOption } from "@/components/forms/fields";

export type FeedOrderDefaults = {
  id: string;
  title: string;
  dueDate: string;
  store: string | null;
  notes: string | null;
  visibility: "family" | "private" | "selected" | "parents";
  shared: string[];
  items: string[];
};

/** Add or edit a feed order: what we need, by when, and who sees it. */
export function FeedOrderModal({ members, defaults, defaultOpen, today, triggerContent, triggerClassName }: { members: MemberOption[]; defaults?: FeedOrderDefaults; defaultOpen?: boolean; today: string; triggerContent?: ReactNode; triggerClassName?: string }) {
  return (
    <FormModal
      title={defaults ? "Edit feed order" : "Feed we need"}
      triggerLabel="Add feed order"
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      action={saveFeedOrder}
      submitLabel={defaults ? "Save" : "Add"}
      defaultOpen={defaultOpen}
    >
      {defaults && <input type="hidden" name="id" value={defaults.id} />}
      <FormRow>
        <DateField name="dueDate" label="Need it by" required defaultValue={defaults?.dueDate ?? today} />
        <TextField name="store" label="Store" defaultValue={defaults?.store ?? ""} placeholder="Tractor Supply, co-op…" />
      </FormRow>
      <TextAreaField
        name="items"
        label="Items needed"
        required
        rows={5}
        defaultValue={defaults?.items.join("\n") ?? ""}
        placeholder={"2 bags 16% layer pellets\n1 bale timothy hay\nGoat minerals\nScratch grains"}
        hint="One item per line. Start a line with an amount (2 bags, 50 lb) to keep it separate."
      />
      <TextField name="title" label="Name (optional)" defaultValue={defaults?.title ?? ""} placeholder="Monthly feed run" />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={defaults?.notes ?? ""} placeholder="Ask for the bulk price…" />
      <VisibilityField members={members} defaultValue={defaults?.visibility ?? "family"} defaultSelected={defaults?.shared} />
    </FormModal>
  );
}
