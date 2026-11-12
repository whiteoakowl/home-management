import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { db } from "@/db";
import { categories, rooms } from "@/db/schema";
import { Brand } from "@/components/brand";
import { AddMemberForm } from "@/components/family/member-form";
import { PermissionsMatrix } from "@/components/family/permissions-matrix";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import {
  finishOnboardingLater,
  onboardingConfigure,
  onboardingPermissions,
  skipOnboardingStep,
} from "@/app/actions/family";
import { logout } from "@/app/actions/auth";
import { getMembership, listFamilyMembers } from "@/lib/dal";
import { getStoredPermissions } from "@/lib/family";
import { LAST_STEP, ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding";
import { MODULES, type Module } from "@/db/schema/_shared";
import { cn } from "@/lib/utils";
import { FamilyForm } from "./family-form";

export const metadata: Metadata = { title: "Set up your family" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const { user, member, family } = await getMembership();
  const params = await searchParams;

  if (family?.onboardingCompletedAt) redirect("/");
  if (member && member.role !== "parent") {
    return (
      <Shell step={null}>
        <h1 className="text-2xl font-semibold">Almost ready</h1>
        <p className="mt-2 text-muted">A parent is still setting up {family?.name}. Check back soon!</p>
        <form action={logout} className="mt-6">
          <Button type="submit" variant="secondary">Sign out</Button>
        </form>
      </Shell>
    );
  }

  const requested = Number(params.step);
  const current = !family ? 1 : Math.min(Math.max(Number.isFinite(requested) && requested >= 2 ? requested : family.onboardingStep, 2), LAST_STEP);
  const step = ONBOARDING_STEPS[current - 1]!;

  return (
    <Shell step={current}>
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-sm font-medium text-primary-600">
          Step {current} of {LAST_STEP}
        </p>
        <h1 className="text-[28px] leading-tight font-semibold">
          {current === 1 ? `Welcome, ${user.name.split(" ")[0]}!` : step.title}
        </h1>
        <p className="text-[15px] text-muted">{current === 1 ? "Let's set up your family's home. It only takes a few minutes, and every step after this one can be skipped." : step.description}</p>
      </div>

      {current === 1 && <FamilyForm />}
      {family && (current === 2 || current === 3) && <MembersStep familyId={family.id} step={step} />}
      {family && current === 4 && <PermissionsStep familyId={family.id} />}
      {family && current >= 5 && <ConfigureStep familyId={family.id} enabledModules={family.enabledModules} step={step} />}

      {family && (
        <form action={finishOnboardingLater} className="mt-8 border-t border-line pt-4 text-center">
          <button type="submit" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            Skip the rest. I&apos;ll finish setting up later.
          </button>
        </form>
      )}
    </Shell>
  );
}

function Shell({ step, children }: { step: number | null; children: React.ReactNode }) {
  return (
    <main className="bg-hearth min-h-dvh px-4 py-8 sm:py-12">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Brand />
        {step && (
          <ol className="flex gap-1.5" aria-label="Setup progress">
            {ONBOARDING_STEPS.map((s) => (
              <li
                key={s.n}
                title={s.title}
                className={cn("h-1.5 flex-1 rounded-full", s.n < step ? "bg-primary-500" : s.n === step ? "bg-primary-300" : "bg-line")}
              >
                <span className="sr-only">
                  {s.title}
                  {s.n < step ? " (done)" : s.n === step ? " (current)" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-[var(--radius-card)] border border-line bg-surface/95 p-5 shadow-[var(--shadow-pop)] backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function StepFooter({ step, primary = "Continue" }: { step: number; primary?: string }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {step > 2 ? (
        <Link href={`/onboarding?step=${step - 1}`} className="text-sm font-medium text-muted hover:text-ink">
          ← Back
        </Link>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button type="submit" formAction={skipOnboardingStep} variant="ghost">
          Skip
        </Button>
        <Button type="submit">{primary}</Button>
      </div>
    </div>
  );
}

async function MembersStep({ familyId, step }: { familyId: string; step: OnboardingStep }) {
  const members = await listFamilyMembers(familyId);
  const role = step.key === "parents" ? "parent" : "member";
  const shown = members.filter((m) => m.role === role);
  return (
    <div className="flex flex-col gap-6">
      {shown.length > 0 && (
        <ul className="flex flex-col gap-2">
          {shown.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-sunken/60 px-3 py-2.5">
              <Avatar name={m.displayName} color={m.color} size="sm" />
              <span className="flex-1 font-medium">{m.displayName}</span>
              {m.userId ? <Badge tone="primary">Has login</Badge> : <Badge>No login</Badge>}
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-4 sm:p-5">
        <p className="mb-4 font-semibold">{role === "parent" ? "Add another parent" : "Add a family member"}</p>
        <AddMemberForm defaultRole={role} lockRole submitLabel={role === "parent" ? "Add parent" : "Add member"} />
      </div>
      <form>
        <input type="hidden" name="step" value={step.n} />
        <div className="mt-2 flex items-center justify-between gap-3">
          {step.n > 2 ? (
            <Link href={`/onboarding?step=${step.n - 1}`} className="text-sm font-medium text-muted hover:text-ink">
              ← Back
            </Link>
          ) : (
            <span />
          )}
          <Button type="submit" formAction={skipOnboardingStep}>
            {shown.length || step.key === "parents" ? "Continue" : "Skip for now"}
          </Button>
        </div>
      </form>
    </div>
  );
}

async function PermissionsStep({ familyId }: { familyId: string }) {
  const members = (await listFamilyMembers(familyId)).filter((m) => m.role === "member");
  const stored = await getStoredPermissions(members.map((m) => m.id));
  const editable = MODULES.filter((m) => m !== "reports");
  return (
    <form action={onboardingPermissions}>
      <input type="hidden" name="step" value={4} />
      {members.length === 0 ? (
        <p className="rounded-xl bg-sunken/60 p-4 text-muted">
          No family members to configure yet. Parents always have full access. You can add members and adjust access later from the Family page.
        </p>
      ) : (
        <PermissionsMatrix
          modules={editable}
          members={members.map((m) => ({ id: m.id, displayName: m.displayName, color: m.color, access: stored.get(m.id) ?? {} }))}
        />
      )}
      <StepFooter step={4} primary="Save & continue" />
    </form>
  );
}

async function ConfigureStep({
  familyId,
  enabledModules,
  step,
}: {
  familyId: string;
  enabledModules: string[];
  step: OnboardingStep;
}) {
  let existing: string[] = [];
  if (step.picks?.target === "rooms") {
    existing = (await db.select({ name: rooms.name }).from(rooms).where(eq(rooms.familyId, familyId))).map((r) => r.name);
  } else if (step.picks) {
    existing = (
      await db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.familyId, familyId), eq(categories.domain, step.picks.target)))
    ).map((r) => r.name);
  }

  return (
    <form action={onboardingConfigure} className="flex flex-col gap-6">
      <input type="hidden" name="step" value={step.n} />
      {step.modules && (
        <div className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line px-4">
          {step.modules.map((m) => (
            <Toggle
              key={m.module}
              name={`module:${m.module}`}
              label={m.label}
              description={m.description}
              defaultChecked={enabledModules.includes(m.module as Module)}
            />
          ))}
        </div>
      )}

      {step.picks && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-medium text-ink-soft">{step.picks.label}</legend>
          <div className="flex flex-wrap gap-2">
            {step.picks.options.map((opt) => {
              const has = existing.includes(opt);
              return (
                <label key={opt} className="cursor-pointer">
                  <input type="checkbox" name="pick" value={opt} defaultChecked={has} disabled={has} className="peer sr-only" />
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm transition-colors peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-700 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100 hover:bg-sunken">
                    {has && <Check className="size-3.5" aria-hidden />}
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>
          <Field label="Add your own (comma-separated)" htmlFor="custom">
            <Input id="custom" name="custom" placeholder="e.g. Mudroom, Sunroom" />
          </Field>
        </fieldset>
      )}

      {step.key === "goals" && (
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-line-strong p-4 sm:p-5">
          <p className="font-semibold">Your first family goal (optional)</p>
          <Field label="Goal" htmlFor="goalName">
            <Input id="goalName" name="goalName" placeholder="e.g. Emergency fund, Family vacation, Farm truck" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target amount ($, optional)" htmlFor="goalTarget">
              <Input id="goalTarget" name="goalTarget" type="number" min={0} step={1} inputMode="numeric" />
            </Field>
            <Field label="Timeframe" htmlFor="goalHorizon">
              <Select id="goalHorizon" name="goalHorizon" defaultValue="1y">
                <option value="6m">6 months</option>
                <option value="1y">1 year</option>
                <option value="5y">5 years</option>
                <option value="10y">10 years</option>
                <option value="20y">20 years</option>
              </Select>
            </Field>
          </div>
        </div>
      )}

      <StepFooter step={step.n} primary={step.n === LAST_STEP ? "Finish setup" : "Save & continue"} />
    </form>
  );
}
