import type { Metadata } from "next";
import { MessageSquareHeart } from "lucide-react";
import { sendFeedback } from "@/app/actions/feedback";
import { ActionForm } from "@/components/forms/action-form";
import { CheckboxField, SelectField, TextAreaField } from "@/components/forms/fields";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { getBrand } from "@/lib/billing";
import { getViewer } from "@/lib/dal";

export const metadata: Metadata = { title: "Send feedback" };

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const viewer = await getViewer();
  const brand = await getBrand();
  const sp = await searchParams;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Send feedback" description={`Ideas, problems, questions or kind words: they go straight to the people who make ${brand}.`} />
      <Card>
        <ActionForm action={sendFeedback} submitLabel="Send feedback" showSuccess>
          <input type="hidden" name="page" value={typeof sp.from === "string" ? sp.from : ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="kind"
              label="What kind of feedback?"
              defaultValue="idea"
              options={[
                { value: "idea", label: "💡 An idea or request" },
                { value: "problem", label: "🐞 Something isn't working" },
                { value: "question", label: "❓ A question" },
                { value: "praise", label: "💜 Something I love" },
                { value: "other", label: "💬 Something else" },
              ]}
            />
            <SelectField name="rating" label="How are we doing?" defaultValue="" placeholder="Rather not say" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${"★".repeat(n)}${"☆".repeat(5 - n)}` }))} />
          </div>
          <TextAreaField name="message" label="Your feedback" rows={6} required placeholder="Tell us what happened, or what would make your family's life easier…" />
          <CheckboxField name="contactOk" label={`You may reply to me at ${viewer.user.email}`} defaultChecked />
        </ActionForm>
      </Card>
      <p className="flex items-center gap-2 text-sm text-muted">
        <MessageSquareHeart className="size-4" /> We read every message.
      </p>
    </div>
  );
}
