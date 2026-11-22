import { redirect } from "next/navigation";

/** Milestones moved into Development. */
export default async function OldMilestones({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/baby/${(await params).id}/development`);
}
