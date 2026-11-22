import type { Metadata } from "next";
import Link from "next/link";
import { Clock, LifeBuoy, MessageSquareHeart } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";
import { Section, SectionTitle } from "@/components/site/parts";
import { readSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Contact", description: "Questions, help or ideas? Send us a message." };

export default async function ContactPage() {
  const user = await readSessionUser();
  return (
    <div className="bg-hearth">
      <Section>
        <SectionTitle as="h1" eyebrow="Contact" title="We'd love to hear from you" intro="Questions before you sign up, help with your account, or ideas for the app: send us a note." />
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
            <ContactForm />
          </div>
          <ul className="flex flex-col gap-5">
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold">Quick replies</p>
                <p className="text-[15px] text-muted">We usually answer within one business day.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <LifeBuoy className="mt-0.5 size-5 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold">Already a member?</p>
                <p className="text-[15px] text-muted">
                  {user ? (
                    <>
                      Use <Link href="/feedback" className="font-medium text-primary-700 underline">Send feedback</Link> inside the app so we can see which family you&apos;re in.
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="font-medium text-primary-700 underline">Sign in</Link> and use Send feedback in the menu so we know which family you&apos;re in.
                    </>
                  )}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold">Ideas welcome</p>
                <p className="text-[15px] text-muted">Many of our features started as a suggestion from a family.</p>
              </div>
            </li>
          </ul>
        </div>
      </Section>
    </div>
  );
}
