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

// ===== Structured working hours =====

export interface DaySchedule {
  open: boolean;
  from: string;   // "09:00"
  to: string;     // "18:00"
  breakFrom?: string; // "12:00" (lunch break, optional)
  breakTo?: string;   // "13:00"
}

/** 7 entries indexed 0=Monday … 6=Sunday */
export type WeekSchedule = [DaySchedule, DaySchedule, DaySchedule, DaySchedule, DaySchedule, DaySchedule, DaySchedule];

export interface OrderAcceptanceSchedule {
  enabled: boolean;
  from: string; // "09:00"
  to: string;   // "21:00"
}

export interface MapCoordinates {
  lat: number;
  lng: number;
}

// ===== Shop (storefront) types =====

export type OwnerPlan = 'FREE' | 'STARTER' | 'PRO';

// ===== Hero & Product status types =====

export type HeroLayout = 'classic' | 'compact';
export type HeroTextColor = 'auto' | 'light' | 'dark';
export type ProductStatus = 'none' | 'featured' | 'hot' | 'new' | 'popular';

export interface ShopData {
  id: string;
  slug: string;
  customDomain: string | null;
  name: string;
  description: string | null;
  logo: string | null;
  templateId: string;
  shopLanguage: string;
  settings: ShopSettings;
  isPublished: boolean;
  ownerPlan: OwnerPlan;
}

export interface PromoBanner {
  id: string;
  title: string;
  description: string;
  image?: string;
  ctaText?: string;
  ctaLink?: string;
  enabled: boolean;
}

export interface ShopSettings {
  colorScheme: 'light' | 'dark' | 'warm' | 'bold' | 'festive' | 'elegant';
  currency: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  address?: string;
  phone?: string;
  openingHours?: string;
  deliveryInfo?: string;
  aboutText?: string;
  bannerImage?: string;
  quickBadges?: string[];
  structuredHours?: WeekSchedule;
  orderAcceptance?: OrderAcceptanceSchedule;
  coordinates?: MapCoordinates;
  promoBanners?: PromoBanner[];
  heroLayout?: HeroLayout;
  heroTextColor?: HeroTextColor;
  /** Custom font/text color override (hex). When set, overrides scheme text color. */
  customFontColor?: string;
  /** Custom accent/button color override (hex). When set, overrides scheme accent. */
  customAccentColor?: string;
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

export type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'REJECTED';

export interface ShopReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  ownerReply: string | null;
  createdAt: string;
}

export interface DashboardReview {
  id: string;
  author: string;
  authorEmail: string | null;
  rating: number;
  text: string;
  status: ReviewStatus;
  ownerReply: string | null;
  createdAt: string;
}

export interface ReviewFormData {
  author: string;
  authorEmail?: string;
  rating: number;
  text: string;
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
  images: string[];
}

export interface StoreSettingsFormData {
  name: string;
  description: string;
  shopLanguage: string;
  colorScheme: 'light' | 'dark' | 'warm' | 'bold' | 'festive' | 'elegant';
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
  bannerImage: string;
  quickBadges: string[];
  structuredHours: WeekSchedule;
  orderAcceptance: OrderAcceptanceSchedule;
  coordinates: MapCoordinates | null;
  promoBanners: PromoBanner[];
  customFontColor: string;
  customAccentColor: string;
}

export interface QuickBadgeDefinition {
  id: string;
  icon: string;
  labelKey: string;
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

// ===== Store Advisor types =====

export type ScoreLevel = 'critical' | 'warning' | 'bonus';

export interface ScoreCheck {
  id: string;
  level: ScoreLevel;
  passed: boolean;
  labelKey: string;
  tab?: string; // which settings tab to navigate to
}

export interface StoreScoreResult {
  score: number; // 0-100
  checks: ScoreCheck[];
}

export interface AiAdviceAction {
  /** settings tab name (general, design, contact, promo, categories) */
  tab?: string;
  /** dashboard page path (/dashboard/products, /dashboard/products/new, /dashboard/orders) */
  page?: string;
}

export interface AiAdvice {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  action?: AiAdviceAction;
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
  shopName: string;
  shopDescription: string;
  colorScheme: 'light' | 'dark' | 'warm' | 'bold' | 'festive' | 'elegant';
  colorReason: string;
  items: AiSetupItem[];
}

export interface Testimonial {
  id: string;
  name: string;
  businessType: string;
  rating: number;
  textKey: string;
  avatarInitials: string;
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
  /** Optional heading font class — serif for warm/elegant, default sans for others */
  headingFont?: string;
}
