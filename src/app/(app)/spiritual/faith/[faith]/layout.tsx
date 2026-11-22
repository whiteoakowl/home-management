import { notFound, redirect } from "next/navigation";
import { FaithTabs } from "@/components/faith/tabs";
import { getViewer } from "@/lib/dal";
import { faithPathsOf, isFaith } from "@/lib/faith-config";

/** One religion's tab. The Spiritual path keeps its celestial theme here too. */
export default async function FaithLayout({ children, params }: LayoutProps<"/spiritual/faith/[faith]">) {
  const { faith } = await params;
  if (!isFaith(faith)) notFound();
  const viewer = await getViewer();
  if (!viewer.can("witchcraft")) redirect("/");
  // Only the religions parents gave this person (Account settings).
  if (!faithPathsOf(viewer.member, viewer.family).includes(faith)) redirect("/spiritual");
  if (faith === "spiritual")
    return (
      <div className="theme-celestial -mx-4 -mt-6 -mb-28 min-h-[calc(100dvh-4rem)] px-4 pt-6 pb-28 sm:-mx-6 sm:-mb-12 sm:px-6 sm:pb-12 lg:-mx-8 lg:-mt-8 lg:rounded-b-[2rem] lg:px-8 lg:pt-8">
        <FaithTabs active="spiritual" />
        {children}
      </div>
    );
  return (
    <>
      <FaithTabs active={faith} />
      {children}
    </>
  );
}
