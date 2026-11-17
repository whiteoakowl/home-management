import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Footprints, PackageCheck, Play, ShoppingBag, Skull, Star } from "lucide-react";
import { advancePointeShoe, deletePointeFavorite, deletePointeShoe } from "@/app/actions/dance";
import { PointeFavoriteModal, PointeShoeModal } from "@/components/dance/forms";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { getViewer } from "@/lib/dal";
import { pairLifeDays, reorderDue } from "@/lib/dance";
import { daysBetween, formatShortDate, todayIn } from "@/lib/dates";
import { pointeData, reorderText } from "@/lib/pointe";
import { memberOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Pointe shoes" };

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const fit = (p: { brand: string; model: string | null; size: string | null; width: string | null; shank: string | null; wings: string | null }) =>
  [p.size && `Size ${p.size}`, p.width && `width ${p.width}`, p.shank && `${p.shank} shank`, p.wings && `${p.wings} wings`].filter(Boolean).join(" · ");

/** Pointe shoe tracker: orders, spares, the pair in use, dead pairs, spending, favourite fits, and when to order next. */
export default async function PointePage({ searchParams }: PageProps<"/dance/pointe">) {
  const viewer = await getViewer();
  if (!viewer.can("dance")) notFound();
  const sp = await searchParams;
  const today = todayIn(viewer.family.timezone);
  const members = await memberOptions(viewer);
  const canAll = viewer.can("dance", "edit");
  const canUse = viewer.can("dance", "use");
  const dancersForForms = canAll ? members : canUse ? members.filter((m) => m.id === viewer.member.id) : [];
  const canChange = (memberId: string) => canAll || (canUse && memberId === viewer.member.id);
  const member = typeof sp.member === "string" && members.some((m) => m.id === sp.member) ? sp.member : "";
  const { shoes, favorites } = await pointeData(viewer, member ? [member] : null);
  const ids = [...new Set([...shoes.map((s) => s.memberId), ...favorites.map((f) => f.memberId), ...(member ? [member] : [])])];
  const dancers = members.filter((m) => ids.includes(m.id));
  const allDancers = members.filter((m) => [...new Set([...shoes.map((s) => s.memberId), ...favorites.map((f) => f.memberId)])].includes(m.id));
  const btn = "inline-flex h-8 items-center gap-1 rounded-full border border-line px-2.5 text-xs font-medium whitespace-nowrap hover:bg-sunken";
  const year = today.slice(0, 4);

  const actions = canUse ? (
    <>
      <PointeShoeModal dancers={dancersForForms} defaultMember={member || undefined} defaultStatus="ordered" triggerLabel="Order a pair" />
      <PointeShoeModal dancers={dancersForForms} defaultMember={member || undefined} />
      <PointeFavoriteModal dancers={dancersForForms} defaultMember={member || undefined} />
    </>
  ) : undefined;

  return (
    <>
      <Link href={member ? `/dance?member=${member}` : "/dance"} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Dance
      </Link>
      <PageHeader eyebrow="Dance" title="Pointe shoes" description="Every pair from order to retirement, what they cost, how long they last, and when to order the next one." actions={actions} />
      {allDancers.length > 1 && (
        <div className="mb-5">
          <SegmentLinks fit active={member || "all"} items={[{ key: "all", href: "/dance/pointe", label: "Everyone" }, ...allDancers.map((m) => ({ key: m.id, href: `/dance/pointe?member=${m.id}`, label: m.displayName.split(" ")[0]! }))]} />
        </div>
      )}
      {dancers.length === 0 ? (
        <Card>
          <EmptyState icon={<Footprints />} title="No pointe shoes yet" description="Add the pair being worn now, spares on hand, or an order on the way. We'll learn how long pairs last and tell you when to order the next one." example="Gaynor Minden Classic · size 6, width 3 · hard shank · $115" action={canUse ? <PointeShoeModal dancers={dancersForForms} defaultMember={member || undefined} /> : undefined} />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {dancers.map((d) => {
            const pairs = shoes.filter((s) => s.memberId === d.id);
            const favs = favorites.filter((f) => f.memberId === d.id);
            const due = reorderDue(pairs, today);
            const life = pairLifeDays(pairs);
            const spent = pairs.filter((p) => (p.receivedOn ?? p.orderedOn ?? p.createdAt.toISOString()).startsWith(year)).reduce((s, p) => s + (p.priceCents ?? 0), 0);
            const priced = pairs.filter((p) => p.priceCents != null);
            const avg = priced.length ? Math.round(priced.reduce((s, p) => s + p.priceCents!, 0) / priced.length) : null;
            const mine = canChange(d.id);
            const groups = [
              { key: "ordered", title: "On order", rows: pairs.filter((p) => p.status === "ordered") },
              { key: "in_use", title: "Wearing now", rows: pairs.filter((p) => p.status === "in_use") },
              { key: "on_hand", title: "Spares on hand", rows: pairs.filter((p) => p.status === "on_hand") },
              { key: "retired", title: "Past pairs", rows: pairs.filter((p) => p.status === "retired") },
            ];
            return (
              <section key={d.id} aria-label={d.displayName}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Avatar name={d.displayName} color={d.color} size="sm" />
                  <h2 className="text-xl font-semibold">{d.displayName}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <div className="flex flex-col gap-4">
                    <Card className={due.status === "now" ? "border-wine-200" : undefined}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted">Next pair</p>
                          <p className="text-lg font-semibold">{reorderText(due, today)}</p>
                          <p className="text-sm text-muted">
                            {due.status === "ordered"
                              ? "A pair is on the way. Mark it received when it arrives."
                              : life
                                ? `Pairs last about ${life} days. We order 2 weeks ahead.`
                                : "Pairs usually last about 6 weeks; this gets more accurate as you retire pairs."}
                          </p>
                        </div>
                        <dl className="flex gap-5 text-sm">
                          <div>
                            <dt className="text-muted">Spent in {year}</dt>
                            <dd className="text-lg font-semibold tabular-nums">{usd(spent)}</dd>
                          </div>
                          {avg != null && (
                            <div>
                              <dt className="text-muted">Avg pair</dt>
                              <dd className="text-lg font-semibold tabular-nums">{usd(avg)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </Card>
                    {groups
                      .filter((g) => g.rows.length)
                      .map((g) => (
                        <Card key={g.key}>
                          <CardHeader title={g.title} />
                          <ul className="flex flex-col divide-y divide-line">
                            {g.rows.map((p) => {
                              const worn = p.firstWornOn ? daysBetween(p.firstWornOn, p.retiredOn ?? today) : null;
                              return (
                                <li key={p.id} className="flex flex-wrap items-start gap-2 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                      {[p.brand, p.model].filter(Boolean).join(" ")}
                                      {p.priceCents != null && <span className="font-normal text-muted"> · {usd(p.priceCents)}</span>}
                                    </p>
                                    {fit(p) && <p className="text-sm text-ink-soft">{fit(p)}</p>}
                                    <p className="text-xs text-muted">
                                      {[
                                        p.orderedOn && `ordered ${formatShortDate(p.orderedOn)}`,
                                        p.receivedOn && `bought ${formatShortDate(p.receivedOn)}`,
                                        p.firstWornOn && `worn from ${formatShortDate(p.firstWornOn)}`,
                                        p.retiredOn && `died ${formatShortDate(p.retiredOn)}`,
                                        worn != null && `${worn} day${worn === 1 ? "" : "s"}${p.status === "in_use" ? " so far" : ""}`,
                                        p.store,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </p>
                                    {p.notes && <p className="text-sm text-ink-soft">{p.notes}</p>}
                                  </div>
                                  {mine && (
                                    <span className="flex items-center gap-1">
                                      {p.status !== "retired" && (
                                        <ActionButton action={advancePointeShoe} fields={{ id: p.id, today }} className={btn}>
                                          {p.status === "ordered" ? (
                                            <>
                                              <PackageCheck className="size-3.5" /> Received
                                            </>
                                          ) : p.status === "on_hand" ? (
                                            <>
                                              <Play className="size-3.5" /> Start wearing
                                            </>
                                          ) : (
                                            <>
                                              <Skull className="size-3.5" /> Dead
                                            </>
                                          )}
                                        </ActionButton>
                                      )}
                                      <PointeShoeModal dancers={dancersForForms} item={{ ...p }} />
                                      <DeleteButton action={deletePointeShoe} fields={{ id: p.id }} what={`this pair of ${p.brand}`} className="size-9" />
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </Card>
                      ))}
                  </div>
                  <Card>
                    <CardHeader title="Favourite brands & fits" icon={<Star className="size-4" />} action={mine ? <PointeFavoriteModal dancers={dancersForForms} defaultMember={d.id} /> : undefined} />
                    {favs.length ? (
                      <ul className="flex flex-col divide-y divide-line">
                        {favs.map((f) => (
                          <li key={f.id} className="flex flex-wrap items-start gap-2 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{[f.brand, f.model].filter(Boolean).join(" ")}</p>
                              {fit(f) && <p className="text-sm text-ink-soft">{fit(f)}</p>}
                              {f.notes && <p className="text-xs text-muted">{f.notes}</p>}
                            </div>
                            {mine && (
                              <span className="flex items-center gap-1">
                                <PointeShoeModal
                                  dancers={dancersForForms}
                                  fit={{ memberId: d.id, brand: f.brand, model: f.model, size: f.size, width: f.width, shank: f.shank, wings: f.wings }}
                                  defaultStatus="ordered"
                                  triggerContent={
                                    <>
                                      <ShoppingBag className="size-3.5" /> Order
                                    </>
                                  }
                                  triggerClassName={btn}
                                />
                                <PointeFavoriteModal dancers={dancersForForms} item={{ ...f }} />
                                <DeleteButton action={deletePointeFavorite} fields={{ id: f.id }} what={f.brand} className="size-9" />
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted">Save the brands and exact fits that work, then reorder them in one tap.</p>
                    )}
                    {pairs.length > 0 && (
                      <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                        <Badge tone="mist">{pairs.length}</Badge> pair{pairs.length === 1 ? "" : "s"} tracked
                      </p>
                    )}
                  </Card>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
