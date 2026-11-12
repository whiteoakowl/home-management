import { cn } from "@/lib/utils";

const EMOJI: Record<string, string> = { chicken: "🐔", duck: "🦆", goat: "🐐", cow: "🐄", sheep: "🐑", pig: "🐖", rabbit: "🐇", bee: "🐝", horse: "🐴", turkey: "🦃", dog: "🐕", cat: "🐈" };

export function AnimalAvatar({ species, photoUrl, size = "md", className }: { species: string; photoUrl?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const box = { sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-20 text-4xl", xl: "size-32 text-6xl" }[size];
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn(box, "shrink-0 rounded-2xl object-cover", className)} />;
  }
  return (
    <span className={cn(box, "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-olive-100 to-primary-50", className)} aria-hidden>
      {EMOJI[species.toLowerCase()] ?? "🐾"}
    </span>
  );
}
