"use client";

import { sendContact } from "@/app/actions/site";
import { ActionForm } from "@/components/forms/action-form";
import { FormRow, SelectField, TextAreaField, TextField } from "@/components/forms/fields";

export function ContactForm() {
  return (
    <ActionForm action={sendContact} submitLabel="Send message" pendingLabel="Sending…" showSuccess>
      {/* Spam trap: hidden from people, filled in by bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormRow>
        <TextField name="name" label="Your name" required autoComplete="name" />
        <TextField name="email" label="Email" type="email" required autoComplete="email" />
      </FormRow>
      <SelectField
        name="topic"
        label="What's it about?"
        defaultValue="question"
        options={[
          { value: "question", label: "A question about the app" },
          { value: "support", label: "Help with my account" },
          { value: "sales", label: "Schools, groups or gifting" },
          { value: "press", label: "Press or partnerships" },
          { value: "other", label: "Something else" },
        ]}
      />
      <TextAreaField name="message" label="Message" rows={6} required />
    </ActionForm>
  );
}
