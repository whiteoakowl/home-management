"use client";

import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "./action-state";
import { MAX_REQUEST_BYTES, networkFailureMessage, shrinkFormData, tooLargeMessage } from "./shrink-image";

/**
 * Wrap a server action for a client form: shrink photos first, refuse requests the
 * host would reject for size, and turn a failed request into a message on the form
 * instead of an error page. Redirects and other Next.js signals pass through.
 */
export function safeAction<A extends unknown[]>(action: (...args: [...A, FormData]) => Promise<ActionState>) {
  return async (...args: [...A, FormData]): Promise<ActionState> => {
    const fd = args[args.length - 1] as FormData;
    const { data, bytes } = await shrinkFormData(fd);
    if (bytes > MAX_REQUEST_BYTES) return { ok: false, message: tooLargeMessage(bytes) };
    try {
      return await action(...([...args.slice(0, -1), data] as [...A, FormData]));
    } catch (e) {
      unstable_rethrow(e);
      console.error(e);
      return { ok: false, message: networkFailureMessage() };
    }
  };
}
