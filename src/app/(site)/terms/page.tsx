import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";
import { getPlatformSettings } from "@/lib/billing";

export const metadata: Metadata = { title: "Terms" };

export default async function TermsPage() {
  const s = await getPlatformSettings();
  return (
    <LegalPage title="Terms of service" updated="November 2026">
      <p>By creating an account or using {s.brandName}, you agree to these terms.</p>
      <h2>Your account</h2>
      <p>The person who creates the family account is its owner and is responsible for the family members they add and the permissions they give. Keep your password safe and let us know if you think someone else has used your account.</p>
      <h2>Subscriptions and free trial</h2>
      <ul>
        <li>{s.trialDays > 0 ? `New families get a ${s.trialDays}-day free trial. Your card is charged when the trial ends unless you cancel before then.` : "Your card is charged when you subscribe."}</li>
        <li>Subscriptions renew automatically each month or year until you cancel.</li>
        <li>You can cancel anytime from Settings → Subscription. You keep access until the end of the period you&apos;ve paid for. Payments already made aren&apos;t refunded, except where the law requires.</li>
        <li>We may change prices; changes apply to new subscriptions, and we&apos;ll tell existing subscribers before any change affects them.</li>
      </ul>
      <h2>Your content</h2>
      <p>What you add belongs to you. You give us permission to store and display it so the app works for your family. Please don&apos;t upload anything illegal or anything you don&apos;t have the right to share.</p>
      <h2>Acceptable use</h2>
      <p>Don&apos;t misuse the service, try to access other families&apos; information, or interfere with how it runs.</p>
      <h2>The service</h2>
      <p>We work hard to keep {s.brandName} available and your information safe, but the service is provided &quot;as is&quot;. It is an organizing tool and isn&apos;t medical, financial or legal advice.</p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will post the new version here. Questions? <Link href="/contact" className="text-primary-700 underline">Contact us</Link>.
      </p>
    </LegalPage>
  );
}
