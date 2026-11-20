import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";
import { getBrand } from "@/lib/billing";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const brand = await getBrand();
  return (
    <LegalPage title="Privacy Policy" updated="November 2026">
      <p>{brand} helps families organize their lives. This policy explains, in plain language, what information we keep, why, who can see it, and the choices you have.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> names, email addresses, and passwords (stored only as secure one-way hashes, never readable).</li>
        <li><strong>What your family adds:</strong> events, chores, lists, recipes, photos, messages, notes, health and money records and anything else you enter.</li>
        <li><strong>Billing details:</strong> handled by our payment processor, Stripe. Card numbers go straight from your device to Stripe; we never see or store them. We keep only your plan, payment status, receipts, and your card&apos;s brand, last 4 digits and expiry date so you can recognise it.</li>
        <li><strong>Technical details:</strong> a sign-in cookie that keeps you logged in, a cookie that remembers which family last signed in on a device (so the installed app shows your family&apos;s name), and basic server logs used to keep the service secure. We don&apos;t use advertising cookies or trackers.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to provide the service to your family: showing your information to the family members you share it with, sending reminders and emails you need (such as password resets and receipts), processing your subscription, keeping accounts secure, and answering your messages. We don&apos;t sell your information or use it for advertising.</p>

      <h2>Who can see your information</h2>
      <ul>
        <li>Only people in your family, according to the permissions and privacy settings you choose. Private items (journals, savings, medical details, private contacts) stay private to their owner.</li>
        <li>Service providers who run parts of the service for us: hosting and database (Netlify, Supabase), payments (Stripe) and email delivery. They may use your information only to provide their service to us.</li>
        <li>Authorities, only when the law requires it.</li>
      </ul>

      <h2>Children</h2>
      <p>Children&apos;s profiles are created and managed by a parent or guardian, who controls what each child can see and do and can review or delete their information. We don&apos;t knowingly collect information from children except through a parent&apos;s family account.</p>

      <h2>How we protect it</h2>
      <p>Information is encrypted in transit (HTTPS), passwords are hashed, each family&apos;s data is kept separate, and access is limited by permissions. No system is perfectly secure, but we work to protect your information and will tell you if a breach affects it.</p>

      <h2>Keeping and deleting information</h2>
      <p>We keep your family&apos;s information while your account exists. The account holder can download a copy at any time in Settings, and can permanently delete the family account there, which erases its information and photos (billing records Stripe must keep by law are kept by Stripe).</p>

      <h2>Your rights</h2>
      <p>You can see, correct, download or delete your information. Depending on where you live (for example under GDPR or state privacy laws) you may have further rights; <Link href="/contact" className="text-primary-700 underline">contact us</Link> to use them.</p>

      <h2>Changes and questions</h2>
      <p>
        We&apos;ll post updates here and tell you in the app about important changes. Questions? <Link href="/contact" className="text-primary-700 underline">Send us a message</Link>.
      </p>
    </LegalPage>
  );
}
