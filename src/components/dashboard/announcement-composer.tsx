"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { postAnnouncement } from "@/app/actions/family";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, SubmitButton, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";

export function AnnouncementComposer() {
  // Opened directly by Quick Add (/?announce=1).
  const announce = useSearchParams().get("announce");
  const [open, setOpen] = useState(announce === "1");
  const [state, action] = useActionState(postAnnouncement, undefined);

  // Adjust state when inputs change (no effect needed).
  const [seen, setSeen] = useState({ announce, state });
  if (seen.announce !== announce || seen.state !== state) {
    setSeen({ announce, state });
    if (announce === "1" && seen.announce !== announce) setOpen(true);
    if (state?.ok && seen.state !== state) setOpen(false);
  }
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Post
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New announcement" description="Everyone in the family will see this on their dashboard.">
        <form action={action} className="flex flex-col gap-4">
          <FormMessage message={state?.ok ? undefined : state?.message} />
          <Field label="Message" htmlFor="body" error={state?.errors?.body}>
            <Textarea id="body" name="body" maxLength={500} placeholder="Grandma visits Saturday. Rooms tidy by Friday!" autoFocus />
          </Field>
          <Checkbox name="pinned" label="Pin to the top" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Posting…">Post announcement</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
