import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Pencil, Trash2, Users, X } from "lucide-react";
import { deleteJournalEntry, removeJournalPhoto } from "@/app/actions/journal";
import { ActionButton } from "@/components/forms/inline";
import { JournalFormModal } from "@/components/journal/journal-form";
import { Avatar, Badge } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { formatLongDate, todayIn } from "@/lib/dates";
import { getEntry, moodOf } from "@/lib/journal";
import { memberOptions } from "@/lib/queries";
import { getRecordAccess } from "@/lib/records";

export const metadata: Metadata = { title: "Journal entry" };

export default async function JournalEntryPage({ params }: PageProps<"/journal/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer.can("journal")) notFound();
  const x = await getEntry(viewer, id);
  if (!x) notFound();
  const mine = x.e.authorMemberId === viewer.member.id;
  const [members, access] = await Promise.all([memberOptions(viewer), getRecordAccess("journal_entry", [id])]);
  const mood = moodOf(x.e.mood);
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <Link href="/journal?view=timeline" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Journal
      </Link>
      <header className="flex flex-col gap-3 border-b border-line pb-6">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Avatar name={x.author} color={x.authorColor} size="xs" /> {x.author} · {formatLongDate(x.e.date)}
          {x.e.visibility === "private" && (
            <Badge tone="mist">
              <Lock className="size-3" /> Private
            </Badge>
          )}
          {x.e.visibility === "selected" && (
            <Badge tone="mist">
              <Users className="size-3" /> Shared
            </Badge>
          )}
        </p>
        <h1 className="text-[36px] leading-tight font-semibold sm:text-[44px]">{x.e.title ?? formatLongDate(x.e.date)}</h1>
        {mood && (
          <p className="text-[15px] text-ink-soft">
            <span className="text-2xl">{mood.emoji}</span> Feeling {mood.label.toLowerCase()}
          </p>
        )}
        {mine && (
          <div className="flex gap-1">
            <JournalFormModal
              members={members}
              today={todayIn(viewer.family.timezone)}
              triggerContent={<><Pencil className="size-4" /> Edit</>}
              defaults={{ id: x.e.id, date: x.e.date, title: x.e.title, body: x.e.body, mood: x.e.mood, tags: x.e.tags, people: x.people.map((p) => p.id), visibility: x.e.visibility, sharedWith: access.get(id) ?? [] }}
            />
            <ActionButton action={deleteJournalEntry} fields={{ id }} confirm="Delete this entry and its photos?" className="h-9 rounded-lg px-3 text-sm font-medium text-wine-500 hover:bg-wine-50">
              <Trash2 className="size-4" /> Delete
            </ActionButton>
          </div>
        )}
      </header>
      <div className="font-display text-[19px] leading-[1.75] whitespace-pre-line text-ink">{x.e.body}</div>
      {x.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {x.photos.map((p) => (
            <figure key={p.id} className="group relative">
              <a href={p.full} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              </a>
              {mine && (
                <ActionButton action={removeJournalPhoto} fields={{ entryId: id, fileId: p.id }} confirm="Remove this photo?" label="Remove photo" className="absolute top-2 right-2 size-8 rounded-full bg-surface/90 text-muted opacity-0 shadow group-hover:opacity-100">
                  <X className="size-4" />
                </ActionButton>
              )}
            </figure>
          ))}
        </div>
      )}
      <footer className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {x.people.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-sunken py-1 pr-3 pl-1 text-sm">
            <Avatar name={p.displayName} color={p.color} size="xs" /> {p.displayName}
          </span>
        ))}
        {x.e.tags.map((t) => (
          <Link key={t} href={`/journal?view=search&tag=${encodeURIComponent(t)}`}>
            <Badge>#{t}</Badge>
          </Link>
        ))}
      </footer>
    </article>
  );
}
