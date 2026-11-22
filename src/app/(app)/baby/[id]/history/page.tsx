import { redirect } from "next/navigation";

/** History moved into Track. */
export default async function OldHistory({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/baby/${(await params).id}/track`);
}
