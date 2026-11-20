# Security review

Reviewed November 2026, before selling Family Bubble to the public. This covers what was checked,
what was fixed, and what is still worth doing before or soon after launch.

## Summary

The core design is sound for a multi-family product. Every family's data is kept separate in the
database queries, passwords and sessions are handled properly, and payments go through Stripe with
signed webhooks. The review found six issues, all now fixed, plus a short list of product
gaps (mainly email-based password reset) to plan for.

## What was checked

| Area | Result |
|---|---|
| **Family separation** (one family can't see or change another's data) | ✅ Every server action and page that loads a record by id checks it belongs to the signed-in family (directly, or through helpers such as `loadList`, `ownGoal`, `existing`). Spot-checked all 30+ write actions that take an id from a form. |
| **Every action requires sign-in** | ✅ All server actions authenticate (`getViewer`, `requireParent`, `requireModule`, `requirePlatformAdmin` or a helper that calls them). Only sign-in, sign-up and the public contact form are open, by design. |
| **Permissions inside a family** | ✅ Per-person, per-section access (none / view / use / add / edit), parents-only actions, private items (journals, savings, medical, private contacts, wishlist claims hidden from the owner). |
| **Passwords** | ✅ bcrypt (cost 12). Minimum 8 characters with a letter and a number at sign-up. Changing a password signs out other devices. |
| **Sessions** | ✅ Random 256-bit tokens, stored only as SHA-256 hashes; cookie is `HttpOnly`, `Secure` (production), `SameSite=Lax`; 30-day expiry; sign-out deletes the session. |
| **Cross-site request forgery** | ✅ Server actions only accept same-origin requests (built into Next.js); cookies are `SameSite=Lax`. |
| **Cross-site scripting** | ✅ No raw HTML rendering anywhere (`dangerouslySetInnerHTML` unused); React escapes all text. Public reviews are approved by an admin before they appear. |
| **SQL injection** | ✅ All queries are parameterized (Drizzle ORM); no raw SQL strings built from input. |
| **File uploads** | ✅ Type and 10 MB size checks; photos are re-encoded (which also strips GPS location from phone pictures); files are served only to members of the owning family, medical files only to those allowed, with `nosniff`. |
| **Fetching web pages** (recipe import) | ✅ Blocks private and internal network addresses, re-checks every redirect, and caps size and time. |
| **Payments** | ✅ Prices come from the server, never the browser. Stripe webhooks are verified (HMAC-SHA256, constant-time compare, 5-minute window). Returning from checkout checks the session belongs to the family. Card numbers never touch the app. |
| **Admin area** | ✅ Only emails in `PLATFORM_ADMIN_EMAILS`; every admin action re-checks. |
| **Secrets** | ✅ No keys or passwords in the repository or its history; `.env` files are not committed. |
| **Dependencies** | ✅ `npm audit`: 0 known vulnerabilities in production packages. |

## Fixed in this review

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | No limit on sign-in attempts, sign-ups, contact messages or password changes, so passwords could be guessed and forms spammed. | High | Database-backed rate limits (works on serverless): sign-in 10 tries per email and 30 per address every 15 minutes; 5 sign-ups per address per hour; 5 contact messages per address per hour; 8 password/email changes per 15 minutes; 15 feedback messages per hour. |
| 2 | Open redirect: after some actions, a crafted link (`?next=/\evil.com`, a wellness "back" field) could send people to another website. | Medium | All redirects go through `safePath()`, which only allows paths on this site. |
| 3 | No security headers: the site could be shown inside another site's frame (clickjacking), and nothing forced HTTPS. | Medium | Added `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HSTS (2 years), `nosniff`, a strict referrer policy and a permissions policy (camera and location only for this site). |
| 4 | `/api/health` was public and showed setup details (storage address, version, error text, number of accounts). | Medium | The full report is now only for platform admins, `?key=` matching `HEALTH_CHECK_KEY`, or a site still being set up. Everyone else gets `{"ok": true}`. |
| 5 | Unexpected errors showed raw database messages to people. | Low | In production people see a short reference code; details stay in the server logs. |
| 6 | Signing in with an unknown email answered faster than with a wrong password, revealing which emails have accounts. | Low | Unknown emails now take the same time. |
| 7 | Payment was only enforced by redirecting pages; a family without a plan could still call actions directly. | Low | Enforced on the server for every page and action, except onboarding and the subscription pages. |

## Before launch (recommended)

1. **Password reset by email.** Today a forgotten password can only be reset by a parent in the
   family, which leaves the account owner stuck. Add a "Forgot password?" email link (needs an email
   service such as Postmark, Resend or SendGrid). This is the most important gap for a paid product.
2. **Email verification at sign-up.** Without it, someone could sign up with an email they don't own.
   Add it together with password reset (same email service).
3. **Admin accounts:** only add an email to `PLATFORM_ADMIN_EMAILS` once that account already exists
   (it does for your own), so nobody else can register it first.
4. **Backups:** turn on daily backups / point-in-time recovery in Supabase.
5. **Privacy Policy and Terms:** have the website versions reviewed. Because children can have
   accounts, ask about COPPA (US) and, if you sell in Europe, GDPR (data export and deletion requests).
   Don't describe the Medical section as HIPAA-compliant; consumer apps usually aren't covered, but
   the wording matters.
6. **Stripe:** in live mode, turn on Radar (fraud screening) and use a restricted key if you can.

## Later (nice to have)

- Two-factor sign-in (authenticator app) for account owners.
- A Content-Security-Policy that also restricts scripts (needs per-request nonces in Next.js).
- "Download my family's data" and "Delete our account" buttons in Settings (today handled by request).
- Error monitoring with alerts (for example Sentry) using the reference codes shown to people.
