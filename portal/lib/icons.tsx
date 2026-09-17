import {
  AppWindow,
  Bank,
  BookOpenText,
  Briefcase,
  Buildings,
  Calculator,
  CalendarBlank,
  ChartBar,
  ChatCircleDots,
  ClipboardText,
  Factory,
  FileText,
  Folder,
  GearSix,
  Headset,
  Kanban,
  Lightning,
  Megaphone,
  Package,
  Receipt,
  SealCheck,
  ShieldCheck,
  ShoppingCart,
  Storefront,
  TrendUp,
  Truck,
  UsersThree,
  Wallet,
  Warehouse,
  Wrench,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Stored icon names (catalog spec §4.5) drawn with Phosphor duotone icons (workspace spec §2).
 * The names stay the same so existing apps need no data change.
 */
const ICONS = {
  "trending-up": TrendUp,
  truck: Truck,
  "book-open": BookOpenText,
  landmark: Bank,
  megaphone: Megaphone,
  "shopping-cart": ShoppingCart,
  users: UsersThree,
  factory: Factory,
  "badge-check": SealCheck,
  "clipboard-check": ClipboardText,
  kanban: Kanban,
  zap: Lightning,
  "message-circle": ChatCircleDots,
  "app-window": AppWindow,
  briefcase: Briefcase,
  "building-2": Buildings,
  calculator: Calculator,
  calendar: CalendarBlank,
  "chart-column": ChartBar,
  "file-text": FileText,
  folder: Folder,
  headset: Headset,
  package: Package,
  receipt: Receipt,
  settings: GearSix,
  "shield-check": ShieldCheck,
  store: Storefront,
  wallet: Wallet,
  warehouse: Warehouse,
  wrench: Wrench,
} satisfies Record<string, Icon>;

export type AppIconName = keyof typeof ICONS;

export const DEFAULT_ICON: AppIconName = "app-window";
export const APP_ICON_NAMES = Object.keys(ICONS) as AppIconName[];

export function AppIcon({ name, size = 26 }: { name: string; size?: number }) {
  const Glyph = ICONS[name as AppIconName] ?? ICONS[DEFAULT_ICON];
  return <Glyph size={size} weight="duotone" aria-hidden="true" />;
}
