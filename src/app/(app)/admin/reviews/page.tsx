import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Star } from "lucide-react";
import { requirePlatformAdmin, setReviewStatus } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/inline";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, PageHeader } from "@/components/ui/display";
import { db } from "@/db";
import { families, reviews } from "@/db/schema";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews" };

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePlatformAdmin();
  const sp = await searchParams;
  const show = sp.show === "approved" || sp.show === "hidden" ? sp.show : "pending";
  const rows = await db.select({ r: reviews, family: families.name }).from(reviews).leftJoin(families, eq(families.id, reviews.familyId)).where(eq(reviews.status, show)).orderBy(desc(reviews.updatedAt)).limit(300);
  const btn = "h-8 rounded-lg px-2.5 text-xs font-medium ring-1 ring-line hover:bg-sunken";
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Admin
      </Link>
      <PageHeader title="Customer reviews" description="Families write reviews from the Feedback page. Approved reviews show on the website's Reviews page; featured ones also appear on the home page." />
      <nav className="flex gap-1">
        {(["pending", "approved", "hidden"] as const).map((k) => (
          <Link key={k} href={`/admin/reviews?show=${k}`} className={cn("rounded-full px-3 py-1.5 text-sm font-medium capitalize", show === k ? "bg-ink text-white" : "text-muted hover:bg-sunken")}>
            {k === "pending" ? "Waiting" : k}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Star />} title="Nothing here" description={show === "pending" ? "New reviews waiting for approval will appear here." : "No reviews in this list."} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ r, family }) => (
            <li key={r.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-amber-500" aria-label={`${r.rating} of 5 stars`}>
                    {"★".repeat(r.rating)}
                    <span className="text-line-strong">{"★".repeat(5 - r.rating)}</span>
                  </span>
                  {r.featured && <Badge tone="olive">Featured</Badge>}
                  <span className="text-muted">
                    {r.displayName} · {family ?? "deleted family"} · {r.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                <p className="mt-1 text-[15px] whitespace-pre-line">{r.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status !== "approved" && (
                    <ActionButton action={setReviewStatus} fields={{ id: r.id, op: "approve" }} className={btn}>
                      Approve
                    </ActionButton>
                  )}
                  {!r.featured ? (
                    <ActionButton action={setReviewStatus} fields={{ id: r.id, op: "feature" }} className={btn}>
                      {r.status === "approved" ? "Feature on home page" : "Approve & feature"}
                    </ActionButton>
                  ) : (
                    <ActionButton action={setReviewStatus} fields={{ id: r.id, op: "unfeature" }} className={btn}>
                      Unfeature
                    </ActionButton>
                  )}
                  {r.status !== "hidden" && (
                    <ActionButton action={setReviewStatus} fields={{ id: r.id, op: "hide" }} className={btn}>
                      Hide
                    </ActionButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
