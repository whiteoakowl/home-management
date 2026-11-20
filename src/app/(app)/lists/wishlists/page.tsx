import type { Metadata } from "next";
import { familyMembersFor } from "@/lib/names";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Check, ExternalLink, Gift, PackageCheck, ShoppingBag, Undo2 } from "lucide-react";
import { db } from "@/db";
import { wishlistItems } from "@/db/schema";
import { claimWishlistItem, deleteWishlistItem, toggleReceived } from "@/app/actions/wishlist";
import { ActionButton, DeleteButton } from "@/components/forms/inline";
import { WishModal } from "@/components/lists/wishlist-form";
import { PRIORITY } from "@/lib/hub-shared";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { SegmentLinks } from "@/components/ui/tabs";
import { fileUrl } from "@/lib/files";
import { getViewer } from "@/lib/dal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Wishlists" };

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
};
const chip = "inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-medium hover:bg-sunken";

export default async function WishlistsPage({ searchParams }: PageProps<"/lists/wishlists">) {
  const viewer = await getViewer();
  if (!viewer.can("lists")) notFound();
  const sp = await searchParams;
  const [members, items] = await Promise.all([
    familyMembersFor(viewer),
    db.select().from(wishlistItems).where(and(eq(wishlistItems.familyId, viewer.family.id))).orderBy(asc(wishlistItems.priority), asc(wishlistItems.createdAt)),
  ]);
  const opts = members.map((m) => ({ id: m.id, displayName: m.displayName, color: m.color }));
  const me = viewer.member.id;
  const canAll = viewer.can("lists", "edit");
  const occasions = [...new Set(items.map((i) => i.occasion))].sort();
  const occasion = typeof sp.occasion === "string" && occasions.includes(sp.occasion) ? sp.occasion : "";
  const shown = occasion ? items.filter((i) => i.occasion === occasion) : items;
  const name = (id: string | null) => members.find((m) => m.id === id)?.displayName.split(" ")[0] ?? "Someone";
  // You first, then everyone else.
  const order = [...members].sort((a, b) => Number(b.id === me) - Number(a.id === me));
  const myGetting = items.filter((i) => i.claimedByMemberId === me && i.memberId !== me && !i.received);

  return (
    <>
      <PageHeader
        eyebrow="Lists"
        title="Wishlists"
        description="Everyone keeps their own gift wishlist and can change it anytime. Mark what you're getting for someone else; they'll never see it, so it stays a surprise."
        actions={<WishModal occasion={occasion || undefined} />}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <SegmentLinks active="wishlists" items={[{ key: "lists", href: "/lists", label: "Lists" }, { key: "wishlists", href: "/lists/wishlists", label: "Wishlists" }]} />
        {occasions.length > 1 && <SegmentLinks active={occasion || "all"} items={[{ key: "all", href: "/lists/wishlists", label: "All occasions" }, ...occasions.map((o) => ({ key: o, href: `/lists/wishlists?occasion=${encodeURIComponent(o)}`, label: o }))]} />}
      </div>

      {myGetting.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <ShoppingBag className="size-4 text-primary-600" /> Gifts I&apos;m getting
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {myGetting.map((i) => (
              <li key={i.id}>
                <Badge tone={i.purchased ? "olive" : "primary"}>
                  {i.purchased && <Check className="size-3" />} {i.title} · for {name(i.memberId)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {order.map((m) => {
          const mine = m.id === me;
          const list = shown.filter((i) => i.memberId === m.id);
          const wants = list.filter((i) => !i.received);
          const got = list.filter((i) => i.received);
          const editable = mine || canAll;
          return (
            <Card key={m.id} className={cn(mine && "ring-2 ring-primary-200")}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={m.displayName} color={m.color} photoUrl={fileUrl(m.avatarFileId, true)} size="md" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{mine ? "My wishlist" : `${m.displayName.split(" ")[0]}'s wishlist`}</h2>
                  <p className="text-sm text-muted">
                    {wants.length} wish{wants.length === 1 ? "" : "es"}
                    {!mine && wants.length > 0 && ` · ${wants.filter((i) => i.claimedByMemberId).length} covered`}
                  </p>
                </div>
                {!mine && canAll && <WishModal forMember={opts.find((o) => o.id === m.id)} occasion={occasion || undefined} />}
              </div>
              {wants.length === 0 ? (
                mine ? (
                  <EmptyState icon={<Gift />} title="What's on your list?" description="Add gifts you'd love, with a link and size so nobody has to guess." action={<WishModal occasion={occasion || undefined} />} />
                ) : (
                  <p className="text-sm text-muted">Nothing on the list yet.</p>
                )
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {wants.map((i) => {
                    const claimedByMe = i.claimedByMemberId === me;
                    const claimed = !!i.claimedByMemberId;
                    return (
                      <li key={i.id} className={cn("flex flex-col gap-1.5 py-3", !mine && claimed && !claimedByMe && "opacity-60")}>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-medium", !mine && i.purchased && "line-through decoration-olive-500")}>{i.title}</p>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                              <Badge tone={i.priority === 1 ? "wine" : i.priority === 2 ? "primary" : "neutral"}>{PRIORITY[i.priority] ?? "Would love"}</Badge>
                              {i.priceCents != null && <span className="tabular-nums">~{usd(i.priceCents)}</span>}
                              {!occasion && occasions.length > 1 && <span>{i.occasion}</span>}
                              {i.link && (
                                <a href={i.link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                                  {host(i.link)} <ExternalLink className="size-3" />
                                </a>
                              )}
                            </p>
                            {i.details && <p className="mt-0.5 text-sm whitespace-pre-line text-ink-soft">{i.details}</p>}
                          </div>
                          {editable && (
                            <span className="flex shrink-0 items-center">
                              {mine && (
                                <ActionButton action={toggleReceived} fields={{ id: i.id }} label="I got this" className="size-9 rounded-full text-muted hover:bg-olive-50 hover:text-olive-700">
                                  <PackageCheck className="size-4" />
                                </ActionButton>
                              )}
                              <WishModal item={{ id: i.id, title: i.title, link: i.link, priceCents: i.priceCents, priority: i.priority, details: i.details, occasion: i.occasion }} />
                              <DeleteButton action={deleteWishlistItem} fields={{ id: i.id }} what={i.title} />
                            </span>
                          )}
                        </div>
                        {/* Claims: hidden on your own list to keep the surprise. */}
                        {!mine && (
                          <div className="flex flex-wrap items-center gap-2">
                            {!claimed && (
                              <ActionButton action={claimWishlistItem} fields={{ id: i.id, op: "claim" }} className={chip}>
                                <Gift className="size-3.5" /> I&apos;ll get this
                              </ActionButton>
                            )}
                            {claimed && !claimedByMe && (
                              <span className="text-xs text-muted">
                                {i.purchased ? "Bought" : "Being bought"} by {name(i.claimedByMemberId)}
                              </span>
                            )}
                            {claimedByMe && (
                              <>
                                <Badge tone={i.purchased ? "olive" : "primary"}>{i.purchased ? "You bought this" : "You're getting this"}</Badge>
                                <ActionButton action={claimWishlistItem} fields={{ id: i.id, op: i.purchased ? "notBought" : "bought" }} className={chip}>
                                  {i.purchased ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />} {i.purchased ? "Not bought yet" : "Mark bought"}
                                </ActionButton>
                                <ActionButton action={claimWishlistItem} fields={{ id: i.id, op: "unclaim" }} className={chip}>
                                  Release
                                </ActionButton>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {got.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">Got it ({got.length})</summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {got.map((i) => (
                      <li key={i.id} className="flex items-center gap-2">
                        <Check className="size-3.5 text-olive-600" /> <span className="flex-1">{i.title}</span>
                        {editable && (
                          <ActionButton action={toggleReceived} fields={{ id: i.id }} label="Move back to wishlist" className="size-8 rounded-full text-muted hover:bg-sunken">
                            <Undo2 className="size-3.5" />
                          </ActionButton>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
