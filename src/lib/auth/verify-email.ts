import "server-only";
import { issueToken } from "./tokens";
import { getBrand } from "@/lib/billing";
import { buttonEmail, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";

/** Email a link that confirms this user's address (best effort). */
export async function sendVerification(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "verify", user.email);
  const brand = await getBrand();
  const url = `${await siteUrl()}/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: `Confirm your email for ${brand}`,
    ...buttonEmail({
      brand,
      heading: `Hi ${user.name.split(" ")[0]}, please confirm your email`,
      body: "Confirm this address so we can send you receipts, reminders and password resets.",
      button: "Confirm my email",
      url,
      footer: "This link works for 3 days. If you didn't create an account, you can ignore this email.",
    }),
  });
}
