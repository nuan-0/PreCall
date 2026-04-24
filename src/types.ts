export interface Subject {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'live' | 'coming_soon';
  order: number;
  pdfTitle?: string;
  pdfUrl?: string;
  pdfPassword?: string;
  pdfVisible?: boolean;
  pdfAccessType?: 'free' | 'premium';
}

export interface Topic {
  id: string;
  slug: string;
  subjectSlug: string;
  chapter?: string;
  title: string;
  teaser: string;
  status: 'free' | 'premium' | 'coming_soon';
  order: number;
  examRelevance: string;
  estimatedTime: string;
  lastUpdated: string;
  pdfUrl?: string;
  pdfPassword?: string;
  infographicUrl?: string;
  
  // Content Sections
  whyThisMatters?: string;
  coreConcept?: string;
  upscGoldPoint?: string;
  deepUnderstanding?: string;
  linkedFacts?: string;
  trapZone?: string;
  memoryTrick?: string;
  prelimsSnapshot?: string;
  mcqs?: string;
  oneLineRevision?: string;
  linkedTopics?: string;
  
  // Legacy fields (keeping for compatibility during transition if needed, but will migrate)
  coreRecall?: string;
  whyUpscAsksThis?: string;
  deepLink?: string;
  pyqPattern?: string;
  quickEliminationLogic?: string;
  miniMcqQuestion?: string;
  miniMcqAnswer?: string;
}

export interface AppSettings {
  appName: string;
  heroTagline: string;
  sponsorName: string;
  sponsorText: string;
  pricingText: string;
  premiumCtaLine: string;
  footerText: string;
  price: string;
  originalPrice: string;
  pdfPrice?: string;
}

export interface AppNotification {
  id: string;
  userId?: string; // Optional: if present, it's a personal notification. If absent, it's a broadcast.
  title: string;
  message: string;
  type: 'update' | 'alert' | 'welcome' | 'premium';
  createdAt: string;
  isRead?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  gender?: 'male' | 'female' | 'other';
  avatarUrl?: string;
  role: 'admin' | 'user';
  isPremium: boolean;
  premiumExpiry?: string;
  ownedPdfs?: string[];
  completedTopics?: string[];
  lastLogin: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'flat' | 'percentage';
  discountAmount?: number;
  discountPercentage?: number;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
  expiresAt?: string;
  createdAt: string;
}
