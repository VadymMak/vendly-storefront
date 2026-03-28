export interface BusinessType {
  id: string;
  icon: string;
  title: string;
  description: string;
  demo: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface HowItWorksStep {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
}

export interface NavItem {
  label: string;
  href: string;
}

export interface SocialProofItem {
  name: string;
  logo: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
}

// ===== Shop (storefront) types =====

export interface ShopData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  templateId: string;
  shopLanguage: string;
  settings: ShopSettings;
  isPublished: boolean;
}

export interface ShopSettings {
  colorScheme: 'light' | 'dark' | 'warm' | 'bold';
  currency: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  address?: string;
  phone?: string;
  openingHours?: string;
  deliveryInfo?: string;
  aboutText?: string;
}

export type ItemType = 'PRODUCT' | 'SERVICE' | 'MENU_ITEM' | 'PORTFOLIO';

export interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  images: string[];
  isAvailable: boolean;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface CartItem {
  item: ShopItem;
  quantity: number;
}

export interface OrderFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  note?: string;
}

export interface ShopReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
}

// ===== Dashboard types =====

export interface DashboardStats {
  itemCount: number;
  orderCount: number;
  revenue: number;
}

export interface DashboardOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  type: ItemType;
  isAvailable: boolean;
}

export interface StoreSettingsFormData {
  name: string;
  description: string;
  shopLanguage: string;
  colorScheme: 'light' | 'dark' | 'warm' | 'bold';
  currency: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  address: string;
  phone: string;
  openingHours: string;
  deliveryInfo: string;
  aboutText: string;
  isPublished: boolean;
}

// ===== Browse (marketplace) types =====

export interface BrowseStore {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  templateId: string;
  itemCount: number;
  createdAt: string;
}

// ===== Admin types =====

export interface AdminStore {
  id: string;
  slug: string;
  name: string;
  templateId: string;
  isPublished: boolean;
  itemCount: number;
  userEmail: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  storeCount: number;
  createdAt: string;
}

// ===== AI Setup Wizard types =====

export interface AiSetupItem {
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  type: ItemType;
}

export interface AiSetupResult {
  shopDescription: string;
  colorScheme: 'light' | 'dark' | 'warm' | 'bold';
  colorReason: string;
  items: AiSetupItem[];
}

export interface ColorSchemeTokens {
  bg: string;
  bgCard: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  border: string;
  headerBg: string;
  footerBg: string;
  footerText: string;
  // Hero & UI extras
  heroBg: string;
  chipBg: string;
  chipText: string;
  outlineBtn: string;
}
