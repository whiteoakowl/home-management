import { FaithTabs } from "@/components/faith/tabs";

/**
 * The Spiritual path gets its own dark celestial theme (globals.css →
 * .theme-celestial). The panel bleeds into the page padding so the night sky
 * fills the content area; the app shell around it is unchanged. The row of
 * religion tabs sits on top.
 */
export default function SpiritualLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-celestial -mx-4 -mt-6 -mb-28 min-h-[calc(100dvh-4rem)] px-4 pt-6 pb-28 sm:-mx-6 sm:-mb-12 sm:px-6 sm:pb-12 lg:-mx-8 lg:-mt-8 lg:rounded-b-[2rem] lg:px-8 lg:pt-8">
      <FaithTabs active="spiritual" />
      {children}
    </div>
  );
}
