import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/display";
import { SoundsApp } from "@/components/sounds/sounds-app";
import { getViewer } from "@/lib/dal";
import { isFreeSound, isSoundId, presetById } from "@/lib/sounds/catalog";
import { soundPrefs, visibleMixes } from "@/lib/sounds/data";

export const metadata: Metadata = { title: "Sleep Sounds" };

/** Sleep Sounds: relaxing and background sounds, made in the browser. */
export default async function SoundsPage() {
  const viewer = await getViewer();
  if (!viewer.can("sounds")) notFound();
  const [prefs, mixes] = await Promise.all([soundPrefs(viewer), visibleMixes(viewer)]);
  const mixIds = new Set(mixes.map((m) => m.id));
  const ok = (id: string) => isSoundId(id) && (viewer.premium || isFreeSound(id));
  return (
    <>
      <PageHeader title="Sleep Sounds" description="Rain, ocean, fan, noise and calm mixes for sleep, focus, reading and quiet time. Set a timer and it stops on its own; it keeps playing while you use the rest of the app." />
      <SoundsApp
        premium={viewer.premium}
        upgradeHref={viewer.isOwner ? "/settings/billing" : null}
        mixes={mixes}
        prefs={{
          defaultVolume: prefs.defaultVolume,
          defaultTimer: prefs.defaultTimer,
          fadeOut: prefs.fadeOut,
          preferredSound: prefs.preferredSound && ok(prefs.preferredSound) ? prefs.preferredSound : null,
          favoriteSounds: prefs.favoriteSounds.filter(ok),
          // Mixes that were deleted or are no longer shared drop out here.
          favoriteMixes: prefs.favoriteMixes.filter((id) => mixIds.has(id)),
          recent: prefs.recent.filter((r) => (r.type === "sound" ? ok(r.id) : r.type === "preset" ? !!presetById(r.id) && viewer.premium : mixIds.has(r.id))),
          reminderKind: prefs.reminderKind,
          reminderTime: prefs.reminderTime,
          reminderDays: prefs.reminderDays,
        }}
      />
    </>
  );
}
