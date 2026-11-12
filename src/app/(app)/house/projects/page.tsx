import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Hammer, Pencil } from "lucide-react";
import { db } from "@/db";
import { familyMembers, homeProjects, rooms } from "@/db/schema";
import { deleteProject, saveProject } from "@/app/actions/house";
import { FormModal } from "@/components/forms/action-form";
import { DateField, FormRow, MemberSelect, NumberField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { DeleteButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatShortDate } from "@/lib/dates";
import { memberOptions, roomOptions } from "@/lib/queries";
import { formatCents } from "@/lib/utils";
import { HouseTabs } from "../house-tabs";

export const metadata: Metadata = { title: "Home projects" };

const STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "done", label: "Done" },
];

type P = typeof homeProjects.$inferSelect;

function ProjectFields({ p, members, roomOpts }: { p?: P; members: MemberOption[]; roomOpts: { id: string; name: string }[] }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <TextField name="title" label="Project" required defaultValue={p?.title} placeholder="Paint the porch" />
      <TextAreaField name="description" label="Description" rows={3} defaultValue={p?.description ?? ""} />
      <FormRow>
        <SelectField name="status" label="Status" defaultValue={p?.status ?? "planned"} options={STATUSES} />
        <MemberSelect name="ownerId" label="Owner" members={members} defaultValue={p?.ownerMemberId} placeholder="No owner" />
        <SelectField name="roomId" label="Room" defaultValue={p?.roomId ?? ""} placeholder="Whole house" options={roomOpts.map((r) => ({ value: r.id, label: r.name }))} />
        <NumberField name="budget" label="Budget ($)" min={0} defaultValue={p?.budgetCents != null ? p.budgetCents / 100 : ""} />
        <DateField name="startDate" label="Start" defaultValue={p?.startDate ?? ""} />
        <DateField name="targetDate" label="Target finish" defaultValue={p?.targetDate ?? ""} />
      </FormRow>
    </>
  );
}

export default async function ProjectsPage() {
  const viewer = await getViewer();
  if (!viewer.can("house")) notFound();
  const canManage = viewer.can("house", "edit");
  const [members, roomOpts, rows] = await Promise.all([
    memberOptions(viewer),
    roomOptions(viewer),
    db
      .select({ p: homeProjects, owner: familyMembers.displayName, ownerColor: familyMembers.color, room: rooms.name })
      .from(homeProjects)
      .leftJoin(familyMembers, eq(familyMembers.id, homeProjects.ownerMemberId))
      .leftJoin(rooms, eq(rooms.id, homeProjects.roomId))
      .where(and(eq(homeProjects.familyId, viewer.family.id)))
      .orderBy(asc(homeProjects.targetDate), asc(homeProjects.createdAt)),
  ]);
  const add = (
    <FormModal title="New project" action={saveProject} submitLabel="Add project">
      <ProjectFields members={members} roomOpts={roomOpts} />
    </FormModal>
  );
  return (
    <>
      <PageHeader eyebrow="House" title="Home projects" description="Renovations, repairs and improvements, from idea to done." actions={canManage ? add : undefined} />
      <HouseTabs active="projects" viewer={viewer} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Hammer />} title="No projects yet" description="Track home improvements with an owner, budget and target date." example="“Build raised beds”: planned, $400, by April" action={canManage ? add : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {STATUSES.map((s) => {
            const list = rows.filter((r) => r.p.status === s.value);
            return (
              <section key={s.value} className="flex flex-col gap-3 rounded-2xl bg-sunken/50 p-3">
                <h2 className="flex items-center justify-between px-1 font-sans text-sm font-semibold text-ink-soft">
                  {s.label} <span className="text-muted">{list.length}</span>
                </h2>
                {list.map(({ p, owner, ownerColor, room }) => (
                  <article key={p.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{p.title}</p>
                      {canManage && (
                        <div className="-mt-1 -mr-1 flex">
                          <FormModal
                            title="Edit project"
                            action={saveProject}
                            triggerAriaLabel="Edit"
                            triggerClassName="size-9 rounded-full text-muted hover:bg-sunken"
                            triggerContent={<Pencil className="mx-auto size-4" />}
                          >
                            <ProjectFields p={p} members={members} roomOpts={roomOpts} />
                          </FormModal>
                          <DeleteButton action={deleteProject} fields={{ id: p.id }} what="this project" />
                        </div>
                      )}
                    </div>
                    {p.description && <p className="line-clamp-3 text-sm text-muted">{p.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {room && <Badge>{room}</Badge>}
                      {p.budgetCents != null && <Badge tone="olive">{formatCents(p.budgetCents)}</Badge>}
                      {p.targetDate && <Badge tone="mist">By {formatShortDate(p.targetDate)}</Badge>}
                    </div>
                    {owner && (
                      <p className="flex items-center gap-2 text-sm">
                        <Avatar name={owner} color={ownerColor} size="xs" /> {owner}
                      </p>
                    )}
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
