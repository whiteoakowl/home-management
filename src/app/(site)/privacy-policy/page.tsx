import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";
import { getBrand } from "@/lib/billing";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const brand = await getBrand();
  return (
    <LegalPage title="Privacy policy" updated="November 2026">
      <p>{brand} helps families organize their lives. This page explains, in plain language, what information we keep and how we use it.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: names, email addresses and passwords (stored only as secure hashes).</li>
        <li>What your family adds to the app: events, chores, lists, photos, messages, notes and other records.</li>
        <li>Billing details: handled by our payment processor, Stripe. We never see or store your full card number.</li>
        <li>A sign-in cookie that keeps you logged in. We don&apos;t use advertising cookies or trackers.</li>
      </ul>
      <h2>How we use it</h2>
      <p>Only to run the app for your family: showing your information to the family members you share it with, sending the reminders you set up, processing your subscription and answering your messages.</p>
      <h2>Who can see your information</h2>
      <p>Only people in your family, according to the permissions and privacy settings you choose. Private items (like journals, savings and medical details) stay private. We don&apos;t sell your information or share it with advertisers.</p>
      <h2>Service providers</h2>
      <p>We use trusted providers to host the app and its database and to process payments (Stripe). They may only use your information to provide their service to us.</p>
      <h2>Children</h2>
      <p>Children&apos;s profiles are created and managed by a parent or guardian, who controls what each child can see and do.</p>
      <h2>Your choices</h2>
      <p>You can view, change or delete what you&apos;ve added at any time. To close your account and delete your family&apos;s information, <Link href="/contact" className="text-primary-700 underline">contact us</Link>.</p>
      <h2>Questions</h2>
      <p>
        <Link href="/contact" className="text-primary-700 underline">Send us a message</Link> and we&apos;ll be glad to help.
      </p>
    </LegalPage>
  );
}
