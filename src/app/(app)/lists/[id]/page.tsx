import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListDetail } from "@/components/lists/list-detail";
import { getViewer } from "@/lib/dal";
import { loadList } from "@/lib/lists";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params }: PageProps<"/lists/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  const list = await loadList(viewer, id).catch(() => null);
  if (list?.kind === "shopping") redirect(`/shopping/${id}`);
  return <ListDetail viewer={viewer} id={id} backHref="/lists" />;
}
