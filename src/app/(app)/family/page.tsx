import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { getViewer, listFamilyMembers } from "@/lib/dal";
import { memberColor } from "@/lib/colors";
import { AddMemberButton } from "./add-member-button";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage({ searchParams }: PageProps<"/family">) {
  const viewer = await getViewer();
  const members = await listFamilyMembers(viewer.family.id);
  const { new: openNew } = await searchParams;

  return (
    <>
      <PageHeader
        eyebrow={`${viewer.family.name} Family Home`}
        title="Family"
        description="Everyone in your household. Open someone's home to see their chores, events and goals."
        actions={viewer.isParent ? <AddMemberButton defaultOpen={openNew === "1"} /> : undefined}
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => {
          const c = memberColor(m.color);
          return (
            <li key={m.id}>
              <Card className="group relative h-full overflow-hidden p-0 sm:p-0">
                <div className="h-16" style={{ background: `linear-gradient(120deg, ${c.solid}, ${c.soft})` }} aria-hidden />
                <div className="-mt-8 flex flex-col gap-3 px-5 pb-5">
                  <Avatar name={m.displayName} color={m.color} size="lg" className="ring-4" />
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/family/${m.id}`} className="font-display text-xl font-semibold after:absolute after:inset-0">
                      {m.displayName}
                    </Link>
                    <ChevronRight className="size-5 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.role === "parent" ? (
                      <Badge tone="primary">
                        <ShieldCheck className="size-3" aria-hidden /> Parent
                      </Badge>
                    ) : (
                      <Badge>Family member</Badge>
                    )}
                    {m.id === viewer.family.ownerMemberId && <Badge tone="olive">Owner</Badge>}
                    {m.userId ? (
                      <Badge tone="mist">
                        <KeyRound className="size-3" aria-hidden /> Has login
                      </Badge>
                    ) : null}
                    {m.id === viewer.member.id && <Badge>You</Badge>}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
