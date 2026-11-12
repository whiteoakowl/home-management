import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  House,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Refrigerator,
  Settings,
  ShoppingBasket,
  Sprout,
  Target,
  Tractor,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Dumbbell,
  House,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Refrigerator,
  Settings,
  ShoppingBasket,
  Sprout,
  Target,
  Tractor,
  Users,
  UtensilsCrossed,
  Wallet,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? LayoutDashboard;
  return <C className={className} aria-hidden />;
}
