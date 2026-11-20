import "server-only";

/**
 * Sends email through Resend (resend.com). Needs RESEND_API_KEY and
 * EMAIL_FROM (e.g. "Family Bubble <hello@yourdomain.com>", from a domain
 * verified in Resend). Without them nothing is sent: in development the
 * message is printed to the server log instead, so links can still be tested.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }) {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== "production") console.log(`\n[email not configured: would send]\nTo: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`);
    return false;
  }
  try {
    const res = await fetch(`${process.env.EMAIL_API_BASE || "https://api.resend.com"}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html, ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("Email failed:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email failed:", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A simple branded email with one button. */
export function buttonEmail(opts: { brand: string; heading: string; body: string; button: string; url: string; footer: string }) {
  const text = `${opts.heading}\n\n${opts.body}\n\n${opts.button}: ${opts.url}\n\n${opts.footer}\n\n— ${opts.brand}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ef;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#2a1a26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fffdfb;border:1px solid #e6dee0;border-radius:20px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 20px;font:600 18px Georgia,serif;color:#6a2d5e">${esc(opts.brand)}</p>
<h1 style="margin:0 0 12px;font:600 22px Georgia,serif">${esc(opts.heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a3946">${esc(opts.body)}</p>
<a href="${esc(opts.url)}" style="display:inline-block;background:#6a2d5e;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${esc(opts.button)}</a>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#7d7586">${esc(opts.footer)}</p>
<p style="margin:16px 0 0;font-size:12px;color:#7d7586;word-break:break-all">${esc(opts.url)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
