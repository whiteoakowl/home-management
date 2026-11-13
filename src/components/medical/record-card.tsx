import { FileText, Lock, RefreshCw, Users, UsersRound, X } from "lucide-react";
import { deleteMedicalRecord, recordRefill, removeMedicalFile, saveMedicalRecord } from "@/app/actions/medical";
import { RecordModal } from "@/components/forms/config-form";
import type { MemberOption } from "@/components/forms/fields";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { DetailList } from "@/components/records/detail-list";
import { Avatar, Badge } from "@/components/ui/display";
import { fileUrl } from "@/lib/files";
import { KIND_LABEL, MEDICAL_FIELDS, SEVERITY_TONE, type MedicalKind } from "@/lib/medical-config";
import type { FieldValue } from "@/lib/record-fields";

type Rec = { id: string; memberId: string; visibility: "family" | "private" | "selected"; fileId?: string | null; [k: string]: unknown };

const TITLE_FIELD: Record<MedicalKind, string> = { profile: "fullName", allergy: "name", restriction: "title", condition: "name", medication: "name", document: "title" };
const BADGE_FIELDS: Record<MedicalKind, string[]> = { profile: ["bloodType"], allergy: ["type", "severity"], restriction: ["kind"], condition: [], medication: [], document: ["category"] };

export function VisibilityBadge({ v, shared }: { v: string; shared?: number }) {
  if (v === "family")
    return (
      <Badge tone="mist">
        <UsersRound className="size-3" aria-hidden /> Family
      </Badge>
    );
  if (v === "selected")
    return (
      <Badge tone="mist">
        <Users className="size-3" aria-hidden /> Shared{shared ? ` with ${shared}` : ""}
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Lock className="size-3" aria-hidden /> Private
    </Badge>
  );
}

export function medicalDefaults(kind: MedicalKind, r: Rec) {
  const d: Record<string, FieldValue | undefined> = {};
  for (const f of MEDICAL_FIELDS[kind]) d[f.name] = r[f.name] as FieldValue | undefined;
  return d;
}

export function MedicalRecordCard({
  kind,
  r,
  member,
  members,
  canEdit,
  sharedWith = [],
  showMember = true,
}: {
  kind: MedicalKind;
  r: Rec;
  member: { displayName: string; color: string };
  members: MemberOption[];
  canEdit: boolean;
  sharedWith?: string[];
  showMember?: boolean;
}) {
  const fields = MEDICAL_FIELDS[kind];
  const title = (r[TITLE_FIELD[kind]] as string) || member.displayName;
  const inactive = (kind === "condition" || kind === "medication") && r.active === false;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <header className="flex items-start gap-3">
        {showMember && <Avatar name={member.displayName} color={member.color} size="sm" />}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">{title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {showMember && <span className="text-xs text-muted">{member.displayName}</span>}
            {BADGE_FIELDS[kind].map((k) => {
              const v = r[k] as string | null;
              if (!v) return null;
              const label = fields.find((f) => f.name === k)?.options?.find((o) => o.value === v)?.label ?? v;
              return (
                <Badge key={k} tone={k === "severity" ? SEVERITY_TONE[v] : "primary"}>
                  {label}
                </Badge>
              );
            })}
            {inactive && <Badge tone="neutral">{kind === "medication" ? "Not currently taking" : "Resolved"}</Badge>}
            <VisibilityBadge v={r.visibility} shared={sharedWith.length} />
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0">
            <RecordModal
              edit
              title={`Edit ${KIND_LABEL[kind].toLowerCase()}`}
              action={saveMedicalRecord}
              fields={fields}
              defaults={medicalDefaults(kind, r)}
              hidden={{ kind, id: r.id }}
              members={members}
              visibility={{ defaultValue: r.visibility, selected: sharedWith, privateLabel: "Private (patient & parents)" }}
            />
            <DeleteButton action={deleteMedicalRecord} fields={{ kind, id: r.id }} what={`this ${KIND_LABEL[kind].toLowerCase()}`} />
          </div>
        )}
      </header>
      <DetailList fields={fields} values={r} skip={[TITLE_FIELD[kind], ...BADGE_FIELDS[kind], "active"]} />
      {kind === "medication" && canEdit && r.active !== false && (
        <ActionButton
          action={recordRefill}
          fields={{ id: r.id, days: 30 }}
          className="self-start rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100"
          title="Sets the next refill 30 days out and counts down refills remaining"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Picked up refill
        </ActionButton>
      )}
      {r.fileId && (
        <div className="flex items-center gap-2">
          <a href={fileUrl(r.fileId)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm font-medium text-ink hover:bg-primary-50">
            <FileText className="size-4 text-primary-600" aria-hidden /> View attachment
          </a>
          {canEdit && (
            <ActionButton action={removeMedicalFile} fields={{ kind, id: r.id }} confirm="Remove this attachment?" label="Remove attachment" className="size-8 rounded-full text-muted hover:bg-wine-50 hover:text-wine-500">
              <X className="size-4" />
            </ActionButton>
          )}
        </div>
      )}
    </article>
  );
}
