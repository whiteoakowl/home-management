import { cn } from "@/lib/utils";

const TINTS: Record<string, string> = {
  Vegetable: "from-olive-100 to-olive-50",
  Herb: "from-primary-100 to-olive-50",
  Fruit: "from-wine-100 to-primary-50",
  Flower: "from-primary-200 to-primary-50",
};

/** Plant image: uploaded photo, or an emoji illustration on a soft gradient. */
export function PlantAvatar({
  imageUrl,
  photoUrl,
  name,
  category,
  size = "md",
  className,
}: {
  imageUrl: string | null;
  photoUrl?: string | null;
  name: string;
  category?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const box = { xs: "size-6 text-sm", sm: "size-9 text-lg", md: "size-12 text-2xl", lg: "size-20 text-4xl", xl: "size-32 text-6xl" }[size];
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" className={cn(box, "shrink-0 rounded-full object-cover", className)} />;
  }
  const emoji = imageUrl?.startsWith("emoji:") ? imageUrl.slice(6) : null;
  return (
    <span className={cn(box, "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br", TINTS[category ?? ""] ?? "from-olive-100 to-olive-50", className)} aria-hidden>
      {emoji ?? <span className="text-[0.55em] font-semibold text-olive-700">{name.slice(0, 2)}</span>}
    </span>
  );
}
