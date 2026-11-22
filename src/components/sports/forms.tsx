"use client";

import { CalendarPlus, ClipboardList, Pencil, Repeat, Trophy } from "lucide-react";
import { saveGame, savePractice, saveStatLine, saveTeam } from "@/app/actions/sports";
import { FormModal } from "@/components/forms/action-form";
import { ChipSelect, DateField, FormRow, NumberField, SelectField, TextAreaField, TextField, type MemberOption } from "@/components/forms/fields";
import { formatTime, SPORTS, type StatDef } from "@/lib/sports";

const editIcon = <Pencil className="mx-auto size-4" />;
const iconBtn = "size-9 rounded-full text-muted hover:bg-sunken";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type TeamDefaults = {
  id: string;
  memberId: string;
  sport: string;
  sportName: string | null;
  name: string;
  season: string | null;
  league: string | null;
  position: string | null;
  jerseyNumber: string | null;
  coach: string | null;
  coachContact: string | null;
  customStats: string[];
  notes: string | null;
};

export function TeamModal({ athletes, item }: { athletes: MemberOption[]; item?: TeamDefaults }) {
  return (
    <FormModal
      title={item ? `Edit ${item.name}` : "Add a team"}
      triggerLabel="Add a team"
      triggerIcon={<Trophy className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? `Edit ${item.name}` : undefined}
      triggerClassName={item ? iconBtn : undefined}
      action={saveTeam}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {!item &&
        (athletes.length === 1 ? (
          <input type="hidden" name="memberId" value={athletes[0]!.id} />
        ) : (
          <SelectField name="memberId" label="Athlete" options={athletes.map((m) => ({ value: m.id, label: m.displayName }))} />
        ))}
      <FormRow>
        <SelectField name="sport" label="Sport" defaultValue={item?.sport ?? "soccer"} options={SPORTS.map((s) => ({ value: s.key, label: `${s.emoji} ${s.label}` }))} />
        <TextField name="sportName" label="Sport name (if Other)" defaultValue={item?.sportName ?? ""} placeholder="Pickleball" />
      </FormRow>
      <FormRow>
        <TextField name="name" label="Team" required defaultValue={item?.name} placeholder="U12 Thunder" />
        <TextField name="season" label="Season" defaultValue={item?.season ?? ""} placeholder="Fall 2026" />
      </FormRow>
      <FormRow cols={3}>
        <TextField name="position" label="Position" defaultValue={item?.position ?? ""} placeholder="Midfield" />
        <TextField name="jerseyNumber" label="Jersey #" defaultValue={item?.jerseyNumber ?? ""} />
        <TextField name="league" label="League" defaultValue={item?.league ?? ""} />
      </FormRow>
      <FormRow>
        <TextField name="coach" label="Coach" defaultValue={item?.coach ?? ""} />
        <TextField name="coachContact" label="Coach phone / email" defaultValue={item?.coachContact ?? ""} />
      </FormRow>
      <TextField name="customStats" label="Extra stats to track (optional)" defaultValue={item?.customStats.join(", ") ?? ""} hint="Comma separated, e.g. Laps, Free kicks. Common stats for the sport are already included." />
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={item?.notes ?? ""} placeholder="Team dues, uniform sizes, carpool…" />
    </FormModal>
  );
}

export function PracticeModal({ teamId }: { teamId: string }) {
  return (
    <FormModal title="Add practice" triggerLabel="Practice" triggerVariant="secondary" triggerIcon={<Repeat className="size-4" />} action={savePractice} size="sm">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-soft">Every week on</span>
        <ChipSelect name="weekday" options={DAYS.map((d, i) => ({ value: String(i), label: d }))} />
      </div>
      <FormRow>
        <TextField name="startTime" label="Starts" type="time" required />
        <TextField name="endTime" label="Ends" type="time" />
      </FormRow>
      <TextField name="location" label="Where" placeholder="Field 3, Riverside Park" />
      <FormRow>
        <DateField name="startsOn" label="Season starts" />
        <DateField name="endsOn" label="Season ends" />
      </FormRow>
    </FormModal>
  );
}

export type GameDefaults = {
  id: string;
  kind: string;
  opponent: string | null;
  date: string;
  arriveTime: string | null;
  startTime: string | null;
  location: string | null;
  homeAway: string | null;
  ourScore: number | null;
  theirScore: number | null;
  outcome: string | null;
  details: string | null;
  notes: string | null;
};

export function GameModal({ teamId, item, scoring, today }: { teamId: string; item?: GameDefaults; scoring: "score" | "place" | "none"; today: string }) {
  return (
    <FormModal
      title={item ? `Edit ${item.opponent ? `vs ${item.opponent}` : "event"}` : "Add a game or event"}
      triggerLabel="Game / event"
      triggerIcon={<CalendarPlus className="size-4" />}
      triggerContent={item ? editIcon : undefined}
      triggerAriaLabel={item ? "Edit game" : undefined}
      triggerClassName={item ? iconBtn : undefined}
      action={saveGame}
    >
      <input type="hidden" name="teamId" value={teamId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormRow>
        <SelectField
          name="kind"
          label="Type"
          defaultValue={item?.kind ?? "game"}
          options={[
            { value: "game", label: "Game / match" },
            { value: "tournament", label: "Tournament" },
            { value: "meet", label: "Meet / race" },
            { value: "scrimmage", label: "Scrimmage" },
            { value: "tryout", label: "Tryout" },
            { value: "other", label: "Other" },
          ]}
        />
        <TextField name="opponent" label="Opponent / event name" defaultValue={item?.opponent ?? ""} placeholder="Wildcats" />
      </FormRow>
      <FormRow cols={3}>
        <DateField name="date" label="Date" required defaultValue={item?.date ?? today} />
        <TextField name="arriveTime" label="Arrive by" type="time" defaultValue={item?.arriveTime?.slice(0, 5) ?? ""} />
        <TextField name="startTime" label="Starts" type="time" defaultValue={item?.startTime?.slice(0, 5) ?? ""} />
      </FormRow>
      <FormRow>
        <TextField name="location" label="Where" defaultValue={item?.location ?? ""} />
        <SelectField name="homeAway" label="Home / away" defaultValue={item?.homeAway ?? ""} placeholder="—" options={[{ value: "home", label: "Home" }, { value: "away", label: "Away" }, { value: "neutral", label: "Neutral" }]} />
      </FormRow>
      <fieldset className="rounded-2xl border border-line p-3">
        <legend className="px-1 text-sm font-medium text-ink-soft">Result (after it&apos;s played)</legend>
        <FormRow cols={3}>
          {scoring === "score" && <NumberField name="ourScore" label="Our score" min={0} defaultValue={item?.ourScore ?? ""} />}
          {scoring === "score" && <NumberField name="theirScore" label="Their score" min={0} defaultValue={item?.theirScore ?? ""} />}
          <SelectField name="outcome" label="Outcome" defaultValue={item?.outcome ?? ""} placeholder={scoring === "score" ? "From the score" : "—"} options={[{ value: "win", label: "Win" }, { value: "loss", label: "Loss" }, { value: "tie", label: "Tie" }]} />
        </FormRow>
      </fieldset>
      <TextAreaField name="details" label="What to bring / uniform / snack duty" rows={2} defaultValue={item?.details ?? ""} />
      <TextAreaField name="notes" label="Notes & highlights" rows={2} defaultValue={item?.notes ?? ""} />
    </FormModal>
  );
}

export function StatsModal({ teamId, gameId, athlete, defs, values, note }: { teamId: string; gameId: string; athlete: string; defs: StatDef[]; values: Record<string, number>; note: string | null }) {
  return (
    <FormModal
      title={`${athlete}'s stats`}
      triggerLabel="Stats"
      triggerVariant="secondary"
      triggerIcon={<ClipboardList className="size-4" />}
      triggerSize="sm"
      action={saveStatLine}
      size="sm"
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="gameId" value={gameId} />
      {defs.length === 0 ? (
        <p className="text-sm text-muted">Add the stats you want to track on the team (Edit team → Extra stats), then enter them here.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {defs.map((d) => (
            <TextField
              key={d.key}
              name={`stat:${d.key}`}
              label={d.label}
              inputMode="decimal"
              defaultValue={values[d.key] == null ? "" : d.kind === "time" ? formatTime(values[d.key]) : String(values[d.key])}
              placeholder={d.kind === "time" ? "1:05.32" : "0"}
            />
          ))}
        </div>
      )}
      <TextAreaField name="note" label="Note" rows={2} defaultValue={note ?? ""} placeholder="Personal best!" />
    </FormModal>
  );
}
