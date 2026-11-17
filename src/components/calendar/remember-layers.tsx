"use client";

import { useEffect } from "react";
import { saveCalendarLayers } from "@/app/actions/calendar";

/** Saves the member's category choice in the background, so the calendar keeps it everywhere. */
export function RememberLayers({ layers }: { layers: string }) {
  useEffect(() => {
    const fd = new FormData();
    fd.set("layers", layers);
    saveCalendarLayers(fd).catch(() => {});
  }, [layers]);
  return null;
}
