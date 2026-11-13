import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CheckSquare, FileText, ListChecks, Package, Receipt, ShoppingBasket } from "lucide-react";
import { deleteHomeProject, deleteMaterial, deleteStage, materialsToShopping, recordProjectExpense, saveMaterial, saveStage, setProjectStatus, toggleMaterial, toggleStage } from "@/app/actions/maintenance";
import { FormModal } from "@/components/forms/action-form";
import { RecordModal } from "@/components/forms/config-form";
import { DateField, NumberField, TextField } from "@/components/forms/fields";
import { ActionButton, CheckCircle, DeleteButton } from "@/components/forms/inline";
import { ChoreFormModal } from "@/components/house/chore-form";
import { OccurrenceList } from "@/components/house/occurrence-list";
import { AddPhotosModal, PhotoGallery } from "@/components/maintenance/photos";
import { MaintenanceTabs } from "@/components/maintenance/tabs";
import { DetailList, fmtDate, fmtMoney } from "@/components/records/detail-list";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, ProgressBar } from "@/components/ui/display";
import { listOccurrences } from "@/lib/chores";
import { todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { getProject, projectDetail, projectOpts, roomOpts } from "@/lib/maintenance";
import { MATERIAL_FIELDS, PROJECT_FIELDS, PROJECT_STATUSES, PROJECT_STATUS_TONE } from "@/lib/maintenance-config";
import { categoryOptions, memberOptions, roomOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { DocModal, DocRow, ProjectModal, maintViewer } from "../../shared";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/maintenance/projects/[id]">) {
  const { id } = await params;
  const viewer = await maintViewer();
  const p = await getProject(viewer, id);
  if (!p) notFound();
  const today = todayIn(viewer.family.timezone);
  const canEdit = viewer.can("maintenance", "edit");
  const [members, rooms, projects, choreRooms, cats, detail, tasks] = await Promise.all([
    memberOptions(viewer),
    roomOpts(viewer),
    projectOpts(viewer),
    roomOptions(viewer),
    categoryOptions(viewer, "chore"),
    projectDetail(viewer, p.id),
    viewer.can("chores") ? listOccurrences(viewer, { kinds: ["task", "chore", "maintenance"], projectId: p.id, order: "asc", limit: 100 }) : Promise.resolve([]),
  ]);
  const { stages, materials, photos, docs, expenses } = detail;
  const spent = expenses.reduce((s, e) => s + e.amountCents, 0);
  const matEst = materials.reduce((s, m) => s + (m.estimatedCostCents ?? 0), 0);
  const doneStages = stages.filter((s) => s.done).length;
  const img = fileUrl(p.coverFileId);
  const pending = tasks.filter((t) => t.status === "pending");
  const fields = PROJECT_FIELDS.map((f) => (f.name === "roomId" ? { ...f, options: rooms } : f));
  return (
    <div className="flex flex-col gap-6">
      <Link href="/maintenance/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Remodeling projects
      </Link>
      <MaintenanceTabs active="projects" />
      <header className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PROJECT_STATUS_TONE[p.status]}>{PROJECT_STATUSES.find((s) => s.value === p.status)?.label}</Badge>
            {p.completedOn && <Badge tone="primary">Completed {fmtDate(p.completedOn)}</Badge>}
          </div>
          <h1 className="text-[32px] leading-tight font-semibold">{p.title}</h1>
          {p.description && <p className="max-w-2xl text-ink-soft">{p.description}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={setProjectStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <label className="sr-only" htmlFor="status">
                Status
              </label>
              <select id="status" name="status" defaultValue={p.status} className="h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm">
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button className="h-11 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm font-medium hover:bg-sunken">Move</button>
            </form>
            <ProjectModal p={p} rooms={rooms} members={members} />
            <DeleteButton action={deleteHomeProject} fields={{ id: p.id }} what={`"${p.title}"`} />
          </div>
        )}
      </header>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={p.title} className="max-h-80 w-full rounded-[var(--radius-card)] object-cover" />
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title="Details" />
          {p.contractor || p.measurements || p.notes || p.roomId || p.startDate || p.targetDate ? (
            <DetailList fields={fields} values={{ ...p, ownerMemberId: null }} skip={["title", "status", "description", "budgetCents", "estimatedCostCents", "completedOn"]} />
          ) : (
            <p className="text-sm text-muted">Add the room, dates, contractor, measurements and notes with Edit.</p>
          )}
          {p.ownerMemberId && <p className="mt-3 text-sm text-muted">Project lead: {members.find((m) => m.id === p.ownerMemberId)?.displayName}</p>}
        </Card>
        <Card>
          <CardHeader
            title="Budget"
            icon={<Receipt className="size-4" />}
            action={
              canEdit &&
              viewer.can("budget", "edit") && (
                <FormModal title="Record a project expense" action={recordProjectExpense} triggerLabel="Expense" triggerVariant="soft" triggerSize="sm" size="sm" description="Added to the budget under Home improvement and linked to this project.">
                  <input type="hidden" name="projectId" value={p.id} />
                  <TextField name="what" label="For" placeholder="Tile & grout" />
                  <NumberField name="amount" label="Amount ($)" step="0.01" min={0} required />
                  <DateField name="date" label="Date" defaultValue={today} />
                </FormModal>
              )
            }
          />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Budget</dt>
              <dd className="font-semibold">{p.budgetCents ? fmtMoney(p.budgetCents) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Estimated</dt>
              <dd className="font-semibold">{fmtMoney(p.estimatedCostCents ?? matEst)}</dd>
            </div>
            <div>
              <dt className="text-muted">Spent</dt>
              <dd className="font-semibold">{fmtMoney(spent)}</dd>
            </div>
            <div>
              <dt className="text-muted">Remaining</dt>
              <dd className={cn("font-semibold", p.budgetCents && spent > p.budgetCents && "text-wine-600")}>{p.budgetCents ? fmtMoney(p.budgetCents - spent) : "—"}</dd>
            </div>
          </dl>
          {p.budgetCents ? <div className="mt-3"><ProgressBar value={spent} max={p.budgetCents} tone={spent > p.budgetCents ? "wine" : "primary"} /></div> : null}
          {expenses.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {expenses.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 py-1.5">
                  <span className="truncate">{e.name.replace(`${p.title}: `, "")}</span>
                  <span className="shrink-0 text-muted">
                    {fmtMoney(e.amountCents)} · {fmtDate(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader
            title={`Stages${stages.length ? ` · ${doneStages}/${stages.length}` : ""}`}
            icon={<CheckSquare className="size-4" />}
            action={
              canEdit && (
                <FormModal title="Add a stage" action={saveStage} triggerLabel="Stage" triggerVariant="soft" triggerSize="sm" size="sm">
                  <input type="hidden" name="projectId" value={p.id} />
                  <TextField name="name" label="Stage" placeholder="Demolition" required />
                  <DateField name="dueOn" label="Target date" />
                </FormModal>
              )
            }
          />
          {stages.length > 0 && <ProgressBar value={doneStages} max={stages.length} />}
          {stages.length ? (
            <ol className="mt-3 flex flex-col gap-2">
              {stages.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  {canEdit ? <CheckCircle action={toggleStage} id={s.id} done={s.done} label={`Mark ${s.name} done`} extra={{ projectId: p.id }} size="sm" /> : <span className={cn("size-5 rounded-full border-2", s.done ? "border-primary-600 bg-primary-600" : "border-line-strong")} aria-hidden />}
                  <span className={cn("flex-1", s.done && "text-muted line-through")}>{s.name}</span>
                  {s.dueOn && <span className={cn("text-sm", !s.done && s.dueOn < today ? "text-wine-600" : "text-muted")}>{fmtDate(s.dueOn)}</span>}
                  {canEdit && <DeleteButton action={deleteStage} fields={{ id: s.id, projectId: p.id }} what={`stage "${s.name}"`} className="size-8" />}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Break the project into stages: planning, demolition, rough-in, finishing…</p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Tasks"
            icon={<ListChecks className="size-4" />}
            action={viewer.can("chores", "edit") && <ChoreFormModal kind="task" members={members} rooms={choreRooms} categories={cats} links={{ projectId: p.id }} label="Task" />}
          />
          {pending.length ? (
            <OccurrenceList items={pending} today={today} members={members} canManage={viewer.can("chores", "edit")} />
          ) : (
            <p className="text-sm text-muted">{tasks.length ? "All tasks are done." : "Add tasks and assign them; they show on everyone's task list."}</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Materials${matEst ? ` · est. ${fmtMoney(matEst)}` : ""}`}
          icon={<Package className="size-4" />}
          action={
            canEdit && (
              <div className="flex gap-2">
                {viewer.can("shopping", "edit") && materials.some((m) => !m.purchased) && (
                  <ActionButton action={materialsToShopping} fields={{ projectId: p.id }} className="h-9 rounded-full bg-primary-50 px-3 text-sm font-semibold text-primary-700 hover:bg-primary-100">
                    <ShoppingBasket className="size-4" /> Shopping list
                  </ActionButton>
                )}
                <RecordModal title="Add material" triggerLabel="Material" triggerVariant="soft" size="md" action={saveMaterial} fields={MATERIAL_FIELDS} hidden={{ projectId: p.id }} />
              </div>
            )
          }
        />
        {materials.length ? (
          <ul className="divide-y divide-line">
            {materials.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                {canEdit && <CheckCircle action={toggleMaterial} id={m.id} done={m.purchased} label={`Mark ${m.name} purchased`} extra={{ projectId: p.id }} size="sm" />}
                <div className="min-w-48 flex-1">
                  <p className={cn("font-medium", m.purchased && "text-muted line-through")}>
                    {m.quantity && `${Number(m.quantity)} ${m.unit ?? ""} `}
                    {m.name}
                  </p>
                  <p className="text-sm text-muted">{[m.store, m.productInfo].filter(Boolean).join(" · ")}</p>
                </div>
                {m.estimatedCostCents ? <span className="text-sm">{fmtMoney(m.estimatedCostCents)}</span> : null}
                {canEdit && (
                  <div className="flex">
                    <RecordModal
                      edit
                      title={`Edit ${m.name}`}
                      size="md"
                      action={saveMaterial}
                      fields={MATERIAL_FIELDS}
                      hidden={{ projectId: p.id, id: m.id }}
                      defaults={{ name: m.name, quantity: m.quantity === null ? null : Number(m.quantity), unit: m.unit, estimatedCostCents: m.estimatedCostCents, store: m.store, productInfo: m.productInfo, purchased: m.purchased }}
                    />
                    <DeleteButton action={deleteMaterial} fields={{ id: m.id, projectId: p.id }} what={m.name} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">List tile, paint, fixtures and lumber with quantities, stores and estimated costs.</p>
        )}
        {p.shoppingListId && (
          <Link href={`/shopping/${p.shoppingListId}`} className="mt-3 inline-block text-sm font-medium text-primary-700 underline">
            Open the materials shopping list
          </Link>
        )}
      </Card>

      <Card>
        <CardHeader title="Photos" icon={<Camera className="size-4" />} action={canEdit && <AddPhotosModal target={{ projectId: p.id }} defaultKind="inspiration" />} />
        <PhotoGallery photos={photos} canEdit={canEdit} empty="Add inspiration, before, progress and after photos, receipts and plans." />
      </Card>

      <Card>
        <CardHeader title="Documents" icon={<FileText className="size-4" />} action={canEdit && <DocModal soft rooms={rooms} projects={projects} members={members} defaults={{ projectId: p.id, roomId: p.roomId, docType: "estimate" }} />} />
        {docs.length ? (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <DocRow key={d.id} d={d} rooms={rooms} projects={projects} members={members} canEdit={canEdit} today={today} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Estimates, contracts, plans and permits.</p>
        )}
      </Card>
    </div>
  );
}
