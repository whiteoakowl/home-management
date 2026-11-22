import type { Metadata } from "next";
import { MessageSquareHeart } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { saveReview, sendFeedback } from "@/app/actions/feedback";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { ActionForm } from "@/components/forms/action-form";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getBrand } from "@/lib/billing";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Send feedback" };

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const viewer = await getViewer();
  const brand = await getBrand();
  const sp = await searchParams;
  const [review] = await db.select().from(reviews).where(and(eq(reviews.memberId, viewer.member.id), eq(reviews.familyId, viewer.family.id)));
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Feedback & feature ideas" description={`Suggest a feature, report a problem, ask a question or share kind words: it all goes straight to the people who make ${brand}. Many features started as a family's suggestion.`} />
      <Card>
        <ActionForm action={sendFeedback} submitLabel="Send feedback" showSuccess>
          <input type="hidden" name="page" value={typeof sp.from === "string" ? sp.from : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="kind"
              label="What kind of feedback?"
              defaultValue={sp.kind === "feature" ? "feature" : "idea"}
              options={[
                { value: "feature", label: "✨ Suggest a new feature" },
                { value: "idea", label: "💡 An idea to improve something" },
                { value: "problem", label: "🐞 Something isn't working" },
                { value: "question", label: "❓ A question" },
                { value: "praise", label: "💜 Something I love" },
                { value: "other", label: "💬 Something else" },
              ]}
            />
            <SelectField name="rating" label="How are we doing?" defaultValue="" placeholder="Rather not say" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}` }))} />
          </div>
          <TextAreaField name="message" label="Your feedback" rows={6} required placeholder="Describe the feature you'd love (what it would do and how your family would use it), or tell us what happened…" />
          <CheckboxField name="contactOk" label={`You may reply to me at ${viewer.user.email}`} defaultChecked />
        </ActionForm>
      </Card>
      <Card id="review">
        <h2 className="mb-1 text-lg font-semibold">Write a review</h2>
        <p className="mb-4 text-sm text-muted">
          Help other families decide. Approved reviews appear on our website.
          {review && ` Your review is ${review.status === "approved" ? "live on the website" : review.status === "hidden" ? "not shown on the website" : "waiting for approval"}; editing it sends it for approval again.`}
        </p>
        <ActionForm action={saveReview} submitLabel={review ? "Update review" : "Post review"} showSuccess resetOnSuccess={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField name="rating" label="Your rating" required defaultValue={review ? String(review.rating) : "5"} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}` }))} />
            <TextField name="displayName" label="Show my name as" required defaultValue={review?.displayName ?? `${viewer.member.displayName.split(" ")[0]}, ${viewer.family.name} family`} hint="First name is plenty." />
          </div>
          <TextField name="title" label="Headline (optional)" defaultValue={review?.title ?? ""} placeholder="Finally, one place for everything" />
          <TextAreaField name="body" label="Your review" rows={4} required defaultValue={review?.body ?? ""} placeholder="What has it changed for your family?" />
        </ActionForm>
      </Card>
      <p className="flex items-center gap-2 text-sm text-muted">
        <MessageSquareHeart className="size-4" /> We read every message.
      </p>
    </div>
  );
}
