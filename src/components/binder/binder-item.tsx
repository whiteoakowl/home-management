import type { ReactNode } from "react";
import { ExternalLink, MapPin, Phone } from "lucide-react";
import QRCode from "qrcode";
import { ADDRESS_FIELDS, BINDER, COPY_FIELDS, PHONE_FIELDS, type BinderKind, wifiQrText } from "@/lib/binder";
import { CopyText } from "./copy-text";

const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** One binder item's fields: tap to call, open in maps, copy numbers and passwords. */
export async function BinderFields({ kind, fields, title, body, print }: { kind: BinderKind; fields: Record<string, string>; title: string; body: string; print?: boolean }) {
  const meta = BINDER[kind];
  if (kind === "note" || !Object.keys(fields).length) return <p className="text-[15px] whitespace-pre-line text-ink-soft">{fields.body ?? body}</p>;
  const rows: { label: string; value: ReactNode; long?: boolean }[] = [];
  for (const f of meta.fields) {
    const v = fields[f.name];
    if (!v || f.name === meta.titleField) continue;
    let value: ReactNode = v;
    if (f.options) value = f.options.find((o) => o.value === v)?.label ?? v;
    if (!print) {
      if (PHONE_FIELDS.has(f.name))
        value = (
          <a href={tel(v)} className="inline-flex items-center gap-1.5 font-medium text-primary-700 hover:underline">
            <Phone className="size-3.5" /> {v}
          </a>
        );
      else if (ADDRESS_FIELDS.has(f.name))
        value = (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(v)}`} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1.5 text-primary-700 hover:underline">
            <MapPin className="mt-0.5 size-3.5 shrink-0" /> {v}
          </a>
        );
      else if (f.type === "url")
        value = (
          <a href={v} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">
            {v.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)} <ExternalLink className="size-3" />
          </a>
        );
      else if (COPY_FIELDS.has(f.name)) value = <CopyText value={v} secret={f.name.toLowerCase().includes("password")} />;
    }
    if (f.type === "date") value = fmtDate(v);
    rows.push({ label: f.label, value, long: f.type === "textarea" });
  }
  let qr: string | null = null;
  if (kind === "wifi" && fields.network) qr = await QRCode.toString(wifiQrText(fields.network, fields.password ?? null, fields.security ?? null), { type: "svg", margin: 1, width: 128 });
  return (
    <div className="flex gap-3">
      <dl className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className={r.long ? "flex flex-col" : "flex flex-wrap items-baseline gap-x-2"}>
            <dt className="shrink-0 text-muted">{r.label}</dt>
            <dd className={r.long ? "whitespace-pre-line text-ink" : "min-w-0 text-ink"}>{r.value}</dd>
          </div>
        ))}
      </dl>
      {qr && (
        <figure className="shrink-0 text-center">
          <div className="size-28 rounded-lg bg-white p-1 [&_svg]:size-full" aria-label={`QR code to join ${title}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
          <figcaption className="mt-1 text-[11px] text-muted">Scan to join</figcaption>
        </figure>
      )}
    </div>
  );
}
