"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ChevronDown, Clock, MoreHorizontal, SkipForward, UserRound } from "lucide-react";
import { reassignOccurrence, setOccurrenceDone, setOccurrenceItemDone, skipOccurrence } from "@/app/actions/chores";
import { CheckCircle } from "@/components/forms/inline";
import { Avatar, Badge } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import type { MemberOption } from "@/components/forms/fields";

export type OccurrenceView = {
  id: string;
  choreId: string;
  title: string;
  instructions: string | null;
  priority: "low" | "normal" | "high";
  estimatedMinutes: number | null;
  points?: number | null;
  roomName: string | null;
  dueDate: string;
  status: "pending" | "done" | "skipped" | "missed";
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  completedByName: string | null;
  items: { id: string; text: string; completedAt: Date | null; assigneeId: string | null; assigneeName: string | null; assigneeColor: string | null }[];
};

function dueBadge(today: string, due: string, status: OccurrenceView["status"]) {
  if (status === "missed") return <Badge tone="wine">Missed</Badge>;
  if (status === "skipped") return <Badge>Skipped</Badge>;
  if (status === "done") return null;
  const diff = Math.round((new Date(`${due}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff < 0) return <Badge tone="wine">{diff === -1 ? "Yesterday" : `${-diff} days overdue`}</Badge>;
  if (diff === 0) return <Badge tone="olive">Today</Badge>;
  if (diff === 1) return <Badge>Tomorrow</Badge>;
  return <Badge>{new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</Badge>;
}

function Row({
  o,
  today,
  members,
  canManage,
  showAssignee,
}: {
  o: OccurrenceView;
  today: string;
  members: MemberOption[];
  canManage: boolean;
  showAssignee: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const done = o.status === "done";
  const itemsDone = o.items.filter((i) => i.completedAt).length;

  const complete = () =>
    start(() => {
      const fd = new FormData();
      fd.set("id", o.id);
      fd.set("done", String(!done));
      return setOccurrenceDone(fd);
    });

  return (
    <li className="relative overflow-hidden rounded-2xl ring-1 ring-line">
      {/* Swipe-to-complete backdrop (touch). */}
      <div className="absolute inset-0 flex items-center bg-primary-600 pl-5 text-sm font-semibold text-white" aria-hidden>
        {done ? "Mark not done" : "Done ✓"}
      </div>
      <div
        className={cn("relative flex flex-col bg-surface transition-transform", pending && "opacity-60")}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .2s" }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            startX.current = e.clientX;
            setDragging(true);
          }
        }}
        onPointerMove={(e) => {
          if (startX.current !== null) setDx(Math.max(0, Math.min(140, e.clientX - startX.current)));
        }}
        onPointerUp={() => {
          if (startX.current !== null && dx > 90) complete();
          startX.current = null;
          setDragging(false);
          setDx(0);
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          setDx(0);
        }}
      >
        <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
          <CheckCircle action={setOccurrenceDone} id={o.id} done={done} label={`Mark "${o.title}" ${done ? "not done" : "done"}`} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/house/chores/${o.choreId}`} className={cn("truncate text-[15px] font-medium hover:underline", done && "text-muted line-through")}>
              {o.priority === "high" && !done && <span className="mr-1.5 inline-block size-2 rounded-full bg-wine-500 align-middle" title="High priority" />}
              {o.title}
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
              {o.roomName && <span>{o.roomName}</span>}
              {o.points ? <span className="font-medium text-olive-700">★ {o.points}</span> : null}
              {o.estimatedMinutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {o.estimatedMinutes} min
                </span>
              ) : null}
              {o.items.length > 0 && (
                <span>
                  {itemsDone}/{o.items.length} steps
                </span>
              )}
              {done && o.completedByName && <span>Done by {o.completedByName}</span>}
            </p>
          </div>
          {dueBadge(today, o.dueDate, o.status)}
          {showAssignee && o.assigneeName && <Avatar name={o.assigneeName} color={o.assigneeColor} size="sm" />}
          {(o.items.length > 0 || o.instructions) && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Show checklist" className="size-9 rounded-full text-muted hover:bg-sunken">
              <ChevronDown className={cn("mx-auto size-4 transition-transform", open && "rotate-180")} />
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="More actions" aria-expanded={menu} className="size-9 rounded-full text-muted hover:bg-sunken">
              <MoreHorizontal className="mx-auto size-4" />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]" onMouseLeave={() => setMenu(false)}>
                {!done && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken"
                    onClick={() =>
                      start(() => {
                        const fd = new FormData();
                        fd.set("id", o.id);
                        setMenu(false);
                        return skipOccurrence(fd);
                      })
                    }
                  >
                    <SkipForward className="size-4" /> {o.status === "skipped" ? "Un-skip" : "Skip this time"}
                  </button>
                )}
                {canManage && (
                  <label className="flex items-center gap-2 px-3 py-2 text-sm">
                    <UserRound className="size-4" />
                    <select
                      aria-label="Reassign"
                      defaultValue={o.assigneeId ?? ""}
                      className="flex-1 rounded-md border border-line bg-surface px-1 py-1 text-sm"
                      onChange={(e) =>
                        start(() => {
                          const fd = new FormData();
                          fd.set("id", o.id);
                          fd.set("assigneeId", e.target.value);
                          setMenu(false);
                          return reassignOccurrence(fd);
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Link href={`/house/chores/${o.choreId}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sunken">
                  Details & history
                </Link>
              </div>
            )}
          </div>
        </div>
        {open && (
          <div className="border-t border-line px-4 py-3 pl-14">
            {o.instructions && <p className="mb-2 text-sm whitespace-pre-line text-ink-soft">{o.instructions}</p>}
            <ul className="flex flex-col gap-2">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <CheckCircle action={setOccurrenceItemDone} id={it.id} done={!!it.completedAt} label={it.text} size="sm" />
                  <span className={cn("flex-1 text-[15px]", it.completedAt && "text-muted line-through")}>{it.text}</span>
                  {it.assigneeName && <Avatar name={it.assigneeName} color={it.assigneeColor} size="xs" />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

export function OccurrenceList({
  items,
  today,
  members,
  canManage,
  showAssignee = true,
}: {
  items: OccurrenceView[];
  today: string;
  members: MemberOption[];
  canManage: boolean;
  showAssignee?: boolean;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((o) => (
        <Row key={o.id} o={o} today={today} members={members} canManage={canManage} showAssignee={showAssignee} />
      ))}
    </ul>
  );
}
