import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";
import { formatPrice, getPlatformSettings } from "@/lib/billing";

export const metadata: Metadata = { title: "Terms of Service" };

export default async function TermsPage() {
  const s = await getPlatformSettings();
  const b = s.brandName;
  return (
    <LegalPage title="Terms of Service" updated="November 2026">
      <p>
        These terms are an agreement between you and {b} (&quot;we&quot;, &quot;us&quot;). By creating an account or using {b}, you agree to them. If you don&apos;t agree, please don&apos;t use the service.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>The person who creates a family account is its <strong>account holder</strong>. They manage the subscription, choose which sections the family uses, and are responsible for the people they add and the permissions they give.</li>
        <li>Keep your password safe and tell us if you think someone else has used your account.</li>
        <li>You must be an adult (18 or older) to create a family account. Children may use the app only through a family account managed by a parent or guardian.</li>
      </ul>

      <h2>2. Subscriptions, free trial and automatic renewal</h2>
      <ul>
        <li>
          {b} is a paid subscription: {formatPrice(s.monthlyPriceCents, s.currency)} per month or {formatPrice(s.yearlyPriceCents, s.currency)} per year, plus any applicable taxes. One subscription covers the whole family.
        </li>
        {s.trialDays > 0 && (
          <li>
            New families get a {s.trialDays}-day free trial (once per family). A payment card is required to start it. <strong>Unless you cancel before the trial ends, your card is charged automatically when it ends</strong> for the plan you chose.
          </li>
        )}
        <li>
          <strong>Your subscription renews automatically</strong> at the end of each month or year and your card on file is charged, until you cancel.
        </li>
        <li>Payments are processed by Stripe. We never see or store your full card number.</li>
      </ul>

      <h2>3. Changing your plan</h2>
      <ul>
        <li>Monthly to yearly: takes effect right away. You&apos;re charged the yearly price minus a credit for the unused part of your current month.</li>
        <li>Yearly to monthly: takes effect at the end of the year you&apos;ve paid for, so you never lose paid time.</li>
        <li>During a free trial you can switch plans without charge; the plan you&apos;re on when the trial ends is the one billed.</li>
      </ul>

      <h2>4. Cancelling</h2>
      <ul>
        <li>The account holder can cancel anytime in <strong>Account settings → Subscription &amp; billing</strong>, with no need to contact us.</li>
        <li>After cancelling you keep access until the end of the period you&apos;ve paid for (or the end of the trial), and you won&apos;t be charged again. You can resume before then.</li>
        <li>Payments already made are not refunded, including for partly used periods, except where the law requires a refund.</li>
      </ul>

      <h2>5. Failed payments</h2>
      <p>If a renewal payment fails, we&apos;ll let you know in the app and retry the card for a limited time. You can update your card or pay the open amount in Account settings → Subscription &amp; billing. If payment isn&apos;t completed, access is paused until a payment succeeds; your family&apos;s information is kept.</p>

      <h2>6. Price changes</h2>
      <p>We may change our prices. Changes apply to new subscriptions; we&apos;ll tell existing subscribers in advance before any change affects their renewal, and you can cancel before it takes effect.</p>

      <h2>7. Your content and data</h2>
      <ul>
        <li>What your family adds (events, lists, photos, messages, records) belongs to you. You give us permission to store, process and display it only to provide the service to your family.</li>
        <li>The account holder can download a copy of the family&apos;s information, or permanently delete the family account, in Settings.</li>
        <li>Please don&apos;t upload anything illegal, harmful, or that you don&apos;t have the right to share.</li>
      </ul>

      <h2>8. Acceptable use</h2>
      <p>Don&apos;t misuse the service: no attempts to access other families&apos; information, interfere with how it runs, test cards or payments fraudulently, or use it to harass anyone. We may suspend accounts that do.</p>

      <h2>9. Copyright and intellectual property</h2>
      <p>
        © {new Date().getFullYear()} {b}. All rights reserved. The {b} app, website, name, logo, design and software are owned by us and protected by copyright and other laws. Your subscription gives your family a personal, non-transferable right to use the app; it doesn&apos;t transfer any ownership. Feedback and feature ideas you send may be used to improve the app without obligation to you.
      </p>

      <h2>10. The service</h2>
      <p>We work hard to keep {b} available, accurate and secure, but it&apos;s provided &quot;as is&quot; and &quot;as available&quot;. It is an organizing tool and isn&apos;t medical, financial, legal or safety advice. To the extent the law allows, we&apos;re not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the 12 months before the claim.</p>

      <h2>11. Ending the agreement</h2>
      <p>You can stop using {b} and delete your family account at any time. We may end or suspend accounts that break these terms. Sections about payments already made, ownership and liability continue to apply.</p>

      <h2>12. Changes and contact</h2>
      <p>
        We may update these terms and will post the new version here (and tell you in the app about important changes). Questions? <Link href="/contact" className="text-primary-700 underline">Contact us</Link>.
      </p>
    </LegalPage>
  );
}
