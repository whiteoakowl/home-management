import Link from "next/link";
import { cn } from "@/lib/utils";

/** "© 2026 Family Bubble. All rights reserved. · Terms · Privacy" for the app and sign-in screens. */
export function LegalFooter({ brand, className }: { brand: string; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted", className)}>
      <span>
        © {new Date().getFullYear()} {brand}. All rights reserved.
      </span>
      <Link href="/terms" className="hover:text-ink hover:underline">
        Terms of Service
      </Link>
      <Link href="/privacy-policy" className="hover:text-ink hover:underline">
        Privacy Policy
      </Link>
    </p>
  );
}
