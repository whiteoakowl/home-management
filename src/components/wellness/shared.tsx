import { HeartHandshake, Phone } from "lucide-react";
import { askParentToTalk } from "@/app/actions/wellness";
import { LinkTabs } from "@/components/ui/tabs";

export function WellnessTabs({ active, member }: { active: string; member?: string }) {
  const q = member ? `?member=${member}` : "";
  return (
    <LinkTabs
      active={active}
      tabs={[
        { key: "today", href: `/wellness${q}`, label: "Today" },
        { key: "journal", href: `/wellness/journal${q}`, label: "Journal" },
        { key: "gratitude", href: `/wellness/journal?view=gratitude${member ? `&member=${member}` : ""}`, label: "Gratitude" },
        { key: "history", href: `/wellness/history${q}`, label: "Mood & insights" },
        { key: "habits", href: `/wellness/habits${q}`, label: "Goals & habits" },
        ...(member
          ? []
          : [
              { key: "sleep", href: "/wellness/sleep", label: "Sleep journal" },
              { key: "breathe", href: "/wellness/breathe", label: "Breathe" },
              { key: "learn", href: "/wellness/learn", label: "Learn" },
              { key: "quotes", href: "/wellness/quotes", label: "Quotes" },
              { key: "settings", href: "/wellness/settings", label: "Settings" },
            ]),
      ]}
    />
  );
}

/** Shown after someone writes something that sounds like they might be in danger, and always reachable. */
export function SupportPanel({ back, asked }: { back: string; asked?: boolean }) {
  return (
    <section aria-labelledby="support-title" className="rounded-[var(--radius-card)] border-2 border-wine-400 bg-wine-50 p-5 text-wine-700">
      <h2 id="support-title" className="flex items-center gap-2 font-sans text-lg font-semibold">
        <HeartHandshake className="size-5" aria-hidden /> You don&apos;t have to handle this alone
      </h2>
      <p className="mt-2 text-[15px]">It sounds like things might be really hard right now. If you might hurt yourself or you&apos;re not safe, please reach out now:</p>
      <ul className="mt-3 flex flex-col gap-2 text-[15px]">
        <li className="flex items-center gap-2">
          <Phone className="size-4 shrink-0" aria-hidden /> In an emergency, call <a href="tel:911" className="font-semibold underline">911</a> (or your local emergency number).
        </li>
        <li className="flex items-center gap-2">
          <Phone className="size-4 shrink-0" aria-hidden /> Call or text <a href="tel:988" className="font-semibold underline">988</a>, the Suicide &amp; Crisis Lifeline (US), any time, free.
        </li>
        <li className="flex items-center gap-2">
          <Phone className="size-4 shrink-0" aria-hidden /> Text <span className="font-semibold">HOME</span> to <a href="sms:741741" className="font-semibold underline">741741</a> for the Crisis Text Line.
        </li>
        <li>Talk to a trusted adult: a parent, family member, teacher, coach or school counselor.</li>
      </ul>
      {asked ? (
        <p className="mt-3 font-medium">We let your parents know you&apos;d like to talk. What you wrote stays private.</p>
      ) : (
        <form action={askParentToTalk} className="mt-4">
          <input type="hidden" name="back" value={back} />
          <button className="inline-flex h-11 items-center rounded-full bg-wine-700 px-4 text-sm font-semibold text-white hover:bg-wine-500">Let my parents know I&apos;d like to talk</button>
          <span className="mt-1 block text-xs">They&apos;ll only see that you&apos;d like to talk, not what you wrote.</span>
        </form>
      )}
    </section>
  );
}

/** The gentle footer every wellness page carries. */
export function WellnessFooter() {
  return (
    <p className="text-xs text-muted">
      Mental Wellness is for reflection and self-care. It isn&apos;t a doctor, therapist, counselor or emergency service. If you&apos;re struggling, talk to a trusted adult or a professional. In a crisis call or text <a href="tel:988" className="underline">988</a> (US) or call <a href="tel:911" className="underline">911</a>.
    </p>
  );
}
