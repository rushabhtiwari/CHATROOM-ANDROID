import {
  AppWindow,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  ChartColumn,
  ClipboardCheck,
  Factory,
  FileText,
  Folder,
  Headset,
  Kanban,
  Landmark,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  Zap,
} from "lucide-react";

/** The icons admins can choose for an app (catalog spec §4.5). Keys are stored on the app. */
const ICONS = {
  "trending-up": TrendingUp,
  truck: Truck,
  "book-open": BookOpen,
  landmark: Landmark,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  users: Users,
  factory: Factory,
  "badge-check": BadgeCheck,
  "clipboard-check": ClipboardCheck,
  kanban: Kanban,
  zap: Zap,
  "message-circle": MessageCircle,
  "app-window": AppWindow,
  briefcase: Briefcase,
  "building-2": Building2,
  calculator: Calculator,
  calendar: Calendar,
  "chart-column": ChartColumn,
  "file-text": FileText,
  folder: Folder,
  headset: Headset,
  package: Package,
  receipt: Receipt,
  settings: Settings,
  "shield-check": ShieldCheck,
  store: Store,
  wallet: Wallet,
  warehouse: Warehouse,
  wrench: Wrench,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof ICONS;

export const DEFAULT_ICON: AppIconName = "app-window";
export const APP_ICON_NAMES = Object.keys(ICONS) as AppIconName[];

export function AppIcon({ name, size = 28 }: { name: string; size?: number }) {
  const Icon = ICONS[name as AppIconName] ?? ICONS[DEFAULT_ICON];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
