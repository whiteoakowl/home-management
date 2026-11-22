"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pencil, Plus } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import {
  FormMessage,
  FormPendingContext,
  SubmitButton,
} from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { safeAction } from "@/lib/safe-submit";
import { cn } from "@/lib/utils";

export type FormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const ErrorsContext = createContext<Record<string, string[] | undefined>>({});
export const useFieldError = (name: string) => use(ErrorsContext)[name];

/**
 * A form wired to a server action via useActionState. Shows the action's
 * message, exposes field errors to child fields, and calls onSuccess.
 */
export function ActionForm({
  action,
  children,
  onSuccess,
  className,
  submitLabel,
  pendingLabel = "Saving…",
  footer,
  resetOnSuccess = true,
  showSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  onSuccess?: () => void;
  className?: string;
  submitLabel?: string;
  pendingLabel?: string;
  footer?: ReactNode;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
}) {
  // Photos are shrunk before sending; a dropped or rejected request shows a message here.
  const safe = useMemo(() => safeAction(action), [action]);
  const [state, formAction, pending] = useActionState(safe, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccessRef.current?.();
    }
  }, [state, resetOnSuccess]);

  return (
    <ErrorsContext value={state?.errors ?? {}}>
      {/* Submitted via onSubmit, not the action prop: React resets an action-prop form after every
          submit, which wiped typed text and chosen photos when a save failed. Here the form only
          clears after a successful save (resetOnSuccess). */}
      <FormPendingContext value={pending}>
        <form
          ref={ref}
          onSubmit={(e) => {
            e.preventDefault();
            if (pending) return;
            const submitter = (e.nativeEvent as SubmitEvent)
              .submitter as HTMLElement | null;
            const fd = new FormData(e.currentTarget, submitter);
            startTransition(() => formAction(fd));
          }}
          className={cn("flex flex-col gap-4", className)}
          noValidate
        >
          {(!state?.ok || showSuccess) && (
            <FormMessage
              message={
                state?.message ??
                (state?.errors && Object.keys(state.errors).length
                  ? "Please check the fields marked below."
                  : undefined)
              }
              tone={state?.ok ? "success" : "error"}
            />
          )}
          {children}
          {(submitLabel || footer) && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {footer}
              {submitLabel && (
                <SubmitButton pendingLabel={pendingLabel}>
                  {submitLabel}
                </SubmitButton>
              )}
            </div>
          )}
        </form>
      </FormPendingContext>
    </ErrorsContext>
  );
}

/** A button that opens a modal containing an ActionForm. Closes on success. */
export function FormModal({
  title,
  description,
  action,
  children,
  submitLabel = "Save",
  trigger,
  triggerLabel,
  triggerVariant = "primary",
  triggerSize = "md",
  triggerIcon: triggerIconProp,
  size = "md",
  defaultOpen = false,
  triggerContent,
  triggerClassName,
  triggerAriaLabel,
  refreshOnSuccess = false,
}: {
  title: string;
  description?: ReactNode;
  action: FormAction;
  children: ReactNode;
  submitLabel?: string;
  /** Custom trigger renderer (client callers only); receives an open() function. */
  trigger?: (open: () => void) => ReactNode;
  /** Serializable custom trigger (usable from Server Components). */
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "ghost" | "soft" | "danger";
  triggerSize?: "sm" | "md";
  triggerIcon?: ReactNode;
  size?: "sm" | "md" | "lg";
  defaultOpen?: boolean;
  /**
   * After saving, close and then reload the page's data in a separate request. Use for
   * uploads whose action skips revalidatePath, so a heavy page never has to be rebuilt
   * inside the (time-limited) upload request.
   */
  refreshOnSuccess?: boolean;
}) {
  const router = useRouter();
  const triggerIcon =
    triggerIconProp ??
    (triggerLabel === "Edit" ? (
      <Pencil className="size-4" />
    ) : (
      <Plus className="size-4" />
    ));
  const [open, setOpen] = useState(defaultOpen);
  // Remount the form each time the modal opens so it starts clean.
  const [key, setKey] = useState(0);
  const show = () => {
    setKey((k) => k + 1);
    setOpen(true);
  };
  return (
    <>
      {trigger ? (
        trigger(show)
      ) : triggerContent ? (
        <button
          type="button"
          onClick={show}
          aria-label={triggerAriaLabel}
          className={triggerClassName}
        >
          {triggerContent}
        </button>
      ) : (
        <Button
          variant={triggerVariant}
          size={triggerSize}
          icon={triggerIcon}
          onClick={show}
        >
          {triggerLabel ?? title}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        size={size}
      >
        <ActionForm
          key={key}
          action={action}
          onSuccess={() => {
            setOpen(false);
            if (refreshOnSuccess) router.refresh();
          }}
          submitLabel={submitLabel}
          footer={
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          }
        >
          {children}
        </ActionForm>
      </Modal>
    </>
  );
}
