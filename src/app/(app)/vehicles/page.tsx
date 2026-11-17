import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Gauge, Landmark, Wrench } from "lucide-react";
import { VehicleModal } from "@/components/vehicles/forms";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar } from "@/components/ui/display";
import { getViewer } from "@/lib/dal";
import { addDays, formatShortDate, todayIn } from "@/lib/dates";
import { fileUrl } from "@/lib/files";
import { memberOptions } from "@/lib/queries";
import { familyVehicles, vehicleSummary, vehicleTitle } from "@/lib/vehicle-data";
import { monthDayYear } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Vehicles" };

export default async function VehiclesPage({ searchParams }: PageProps<"/vehicles">) {
  const viewer = await getViewer();
  if (!viewer.can("vehicles")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const [list, members] = await Promise.all([familyVehicles(viewer), memberOptions(viewer)]);
  const summaries = await Promise.all(list.map((v) => vehicleSummary(viewer, v, today)));
  const canEdit = viewer.can("vehicles", "edit");
  const add = canEdit ? <VehicleModal members={members} defaultOpen={sp.new === "1"} /> : undefined;

  return (
    <>
      <PageHeader eyebrow="Household" title="Vehicles" description="Every car's profile, mileage, maintenance due, repairs, parts and loan payoff." actions={add} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Car />} title="Add your first vehicle" description="We'll set up a standard maintenance plan (oil, tires, filters, brakes…) that you can adjust, and track what's due by miles or date." example="Mom's SUV · 2021 Toyota Highlander · 38,420 mi" action={canEdit ? <VehicleModal members={members} /> : undefined} />
        </Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v, i) => {
            const s = summaries[i]!;
            const top = s.due.find((d) => d.d.status === "overdue" || d.d.status === "soon");
            const driver = members.find((m) => m.id === v.driverMemberId);
            const img = fileUrl(v.imageFileId, true);
            const paperwork = [
              v.registrationExpiresOn && { label: "Registration", date: v.registrationExpiresOn },
              v.insuranceRenewsOn && { label: "Insurance", date: v.insuranceRenewsOn },
              v.inspectionDueOn && { label: "Inspection", date: v.inspectionDueOn },
            ].filter((x): x is { label: string; date: string } => !!x && x.date <= addDays(today, 30));
            return (
              <li key={v.id}>
                <Link href={`/vehicles/${v.id}`} className={cn("flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] hover:border-primary-300", !v.active && "opacity-60")}>
                  <div className="relative aspect-[16/9] bg-gradient-to-br from-primary-100 to-mist-50">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-primary-600/50">
                        <Car className="size-14" aria-hidden />
                      </span>
                    )}
                    {!v.active && <span className="absolute top-2 left-2"><Badge>Sold / retired</Badge></span>}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-xl font-semibold">{v.nickname}</span>
                        <span className="block text-sm text-muted">{vehicleTitle(v) || "Details not added"}</span>
                      </span>
                      {driver && <Avatar name={driver.displayName} color={driver.color} size="sm" />}
                    </div>
                    <p className="flex items-center gap-1.5 text-sm">
                      <Gauge className="size-4 text-muted" aria-hidden /> {s.currentMiles != null ? `${s.currentMiles.toLocaleString()} mi` : "No mileage yet"}
                    </p>
                    {top ? (
                      <p className="flex items-center gap-1.5 text-sm">
                        <Wrench className="size-4 text-muted" aria-hidden />
                        <Badge tone={top.d.status === "overdue" ? "wine" : "mist"}>{top.d.status === "overdue" ? "Overdue" : "Due soon"}</Badge> {top.s.title}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm text-muted">
                        <Wrench className="size-4" aria-hidden /> Maintenance up to date
                      </p>
                    )}
                    {paperwork.map((p) => (
                      <p key={p.label} className="text-sm">
                        <Badge tone={p.date < today ? "wine" : "mist"}>{p.date < today ? "Expired" : "Soon"}</Badge> {p.label} {formatShortDate(p.date)}
                      </p>
                    ))}
                    {s.loan && !s.loan.paidOff && (
                      <div className="mt-auto flex flex-col gap-1 pt-1">
                        <p className="flex items-center gap-1.5 text-sm">
                          <Landmark className="size-4 text-muted" aria-hidden /> <strong>{s.loan.paymentsLeft}</strong> payments left · paid off {monthDayYear(s.loan.payoffDate)}
                        </p>
                        <ProgressBar value={Math.round(s.loan.progress * 100)} max={100} label="Loan paid off" />
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

