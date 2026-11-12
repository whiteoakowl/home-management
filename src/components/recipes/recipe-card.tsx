import Link from "next/link";
import { Clock, Heart, Star, UtensilsCrossed } from "lucide-react";

export type RecipeCardData = {
  id: string;
  name: string;
  thumbUrl: string | null;
  totalMinutes: number | null;
  servings: number | null;
  isFavorite: boolean;
  rating: number | null;
  categoryName: string | null;
};

const GRADIENTS = ["from-primary-200 to-primary-50", "from-olive-100 to-primary-50", "from-primary-100 to-olive-50", "from-mist-50 to-primary-100"];

export function RecipeCard({ r }: { r: RecipeCardData }) {
  const g = GRADIENTS[r.name.length % GRADIENTS.length];
  return (
    <Link href={`/recipes/${r.id}`} className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-colors hover:border-primary-300">
      <div className={`relative aspect-[4/3] bg-gradient-to-br ${g}`}>
        {r.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.thumbUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className="flex size-full items-center justify-center text-primary-600/60">
            <UtensilsCrossed className="size-10" aria-hidden />
          </span>
        )}
        {r.isFavorite && (
          <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-surface/90 text-wine-500 shadow" title="Family favorite">
            <Heart className="size-4 fill-current" aria-label="Favorite" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-display text-lg leading-snug font-semibold">{r.name}</p>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 text-sm text-muted">
          {r.totalMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {r.totalMinutes} min
            </span>
          ) : null}
          {r.servings && <span>Serves {r.servings}</span>}
          {r.rating && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current text-olive-400" aria-hidden /> {r.rating.toFixed(1)}
            </span>
          )}
          {r.categoryName && <span>{r.categoryName}</span>}
        </p>
      </div>
    </Link>
  );
}
