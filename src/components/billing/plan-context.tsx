"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Whether the family has Premium (paid, complimentary, payments off, or in its free trial). */
const PlanContext = createContext<boolean>(true);

export function PlanProvider({ premium, children }: { premium: boolean; children: ReactNode }) {
  return <PlanContext.Provider value={premium}>{children}</PlanContext.Provider>;
}

export const usePremium = () => useContext(PlanContext);

/** Small "Premium" note for a field that only works on Premium. */
export function PremiumNote({ what }: { what: string }) {
  return (
    <p className="text-xs text-muted">
      {what} {what.endsWith("s") ? "are" : "is"} part of Premium. On the Free plan this setting isn&apos;t used.
    </p>
  );
}
