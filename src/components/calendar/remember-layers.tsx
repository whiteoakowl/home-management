"use client";

import { useEffect } from "react";
import { saveCalendarLayers } from "@/app/actions/calendar";

/** Saves the member's category choice in the background, so the calendar keeps it everywhere. */
export function RememberLayers({ layers, hide }: { layers: string; hide: string }) {
  useEffect(() => {
    const fd = new FormData();
    fd.set("layers", layers);
    fd.set("hide", hide);
    saveCalendarLayers(fd).catch(() => {});
  }, [layers, hide]);
  return null;
}
