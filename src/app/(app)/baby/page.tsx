import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Baby } from "lucide-react";
import { BabyModal } from "@/components/baby/forms";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/display";
import { listBabies } from "@/lib/baby";
import { babyAge } from "@/lib/baby-kinds";
import { getViewer } from "@/lib/dal";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Baby tracker" };

/** The family's babies. With just one, go straight to their Today screen. */
export default async function BabyPage({ searchParams }: { searchParams: Promise<{ all?: string; new?: string }> }) {
  const viewer = await getViewer();
  if (!viewer.can("baby")) notFound();
  const sp = await searchParams;
  const [list, members] = await Promise.all([listBabies(viewer), memberOptions(viewer)]);
  if (list.length === 1 && !sp.all && !sp.new) redirect(`/baby/${list[0]!.id}`);
  const today = todayIn(viewer.family.timezone);
  const canAdd = viewer.can("baby", "use");

  return (
    <>
      <PageHeader title="Baby tracker" description="Feeds, diapers, sleep, growth, health and milestones, plus the baby's daily schedule, shared by everyone who helps." actions={canAdd ? <BabyModal members={members} defaultOpen={sp.new === "1"} /> : undefined} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Baby />} title="No babies yet" description="Add a baby from your family (or by name) to start tracking feeds, diapers, sleep and more. Grandparents and sitters with access can log too." example="🍼 4 oz · 2 h ago   🧷 Wet · 40 min ago   😴 Napping 35 min" />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/baby/${b.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary-300">
                <Avatar name={b.name} size="lg" photoUrl={fileUrl(b.imageFileId, true)} />
                <span>
                  <span className="block font-semibold">{b.name}</span>
                  <span className="text-sm text-muted">{babyAge(b.birthDate, today) ?? "Add a birthday"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
