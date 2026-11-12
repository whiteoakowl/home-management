"use client";

import { useCallback, useState } from "react";
import { UserPlus } from "lucide-react";
import { AddMemberForm } from "@/components/family/member-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function AddMemberButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button icon={<UserPlus className="size-4" />} onClick={() => setOpen(true)}>
        Add member
      </Button>
      <Modal open={open} onClose={close} title="Add a family member" description="They'll get default permissions, which you can adjust any time.">
        <AddMemberForm onDone={close} />
      </Modal>
    </>
  );
}
