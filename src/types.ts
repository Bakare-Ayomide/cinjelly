export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  subscriptionStatus: 'Active' | 'Expired' | 'Disabled';
  paymentStatus: 'Paid' | 'Unpaid' | 'Pending Verification';
  registrationDate: string;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  accountStatus?: 'Active' | 'Expired' | 'Disabled';
  jellyfinUserId?: string;
  role: 'admin' | 'user';
  isAffiliate?: boolean;
  affiliateCode?: string;
  referredBy?: string;
  disabledAt?: string;
  declineReason?: string;
  systemNotification?: string;
  emailVerified?: number;
  verificationToken?: string;
}

export interface SystemStatus {
  configured: boolean;
  hasAdmin: boolean;
  serverUrl: string;
  adminUsername: string;
  mysqlAvailable?: boolean;
  mysqlError?: string | null;
  defaultCommission?: number;
  iosDownloadUrl?: string;
  androidDownloadUrl?: string;
  emailVerificationEnabled?: boolean;
  smtpEnabled?: boolean;
}

export interface JellyfinConfigDetails {
  serverUrl: string;
  adminUsername: string;
  apiKey: string;
  defaultCommission?: number;
  iosDownloadUrl?: string;
  androidDownloadUrl?: string;
  manualPaymentEnabled?: boolean;
}

export interface SquadMandate {
  id: string;
  userId: string;
  mandateId: string;
  mandateReference?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  accountName?: string;
  amount: number;
  status: 'pending' | 'pending_otp' | 'active' | 'cancelled' | 'failed';
  startDate?: string;
  endDate?: string;
  lastDebitDate?: string;
  nextDebitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SquadSftpLog {
  id: string;
  action: string;
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  filename?: string;
  txRef?: string;
  metadata?: string;
  createdAt: string;
}

export interface SquadSftpStatus {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  remoteDir: string;
  processingDir: string;
  pollInterval: number;
  hasPassword?: boolean;
  hasPrivateKey?: boolean;
  hasGpgKey?: boolean;
  hasGpgPassphrase?: boolean;
  lastSync?: string;
  lastFile?: string;
  lastTxRef?: string;
  lastError?: string;
  lastStatus?: string;
}

export interface Commission {
  id: string;
  affiliateId: string;
  affiliateName?: string;
  affiliateUsername?: string;
  referredUserId: string;
  referredName?: string;
  referredUsername?: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Paid';
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateWithdrawal {
  id: string;
  affiliate_user_id: string;
  affiliateName?: string;
  affiliateUsername?: string;
  affiliateEmail?: string;
  fullName?: string;
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'paid' | 'declined' | 'cancelled';
  admin_note?: string | null;
  requested_at: string;
  processed_at?: string | null;
  processed_by?: string | null;
  payment_reference?: string | null;
  decline_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateStats {
  affiliateCode: string;
  registeredCount: number;
  paidCount: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  totalCommission: number;
  defaultCommission?: number;
  totalEarnings?: number;
  availableEarnings?: number;
  pendingWithdrawal?: number;
  totalPaidOut?: number;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  withdrawals?: AffiliateWithdrawal[];
  referredUsers: {
    id: string;
    fullName: string;
    username: string;
    registrationDate: string;
    paymentStatus: string;
    subscriptionStatus: string;
  }[];
  commissions: Commission[];
}

export interface HeroSlideConfig {
  id: string;
  title: string;
  tagline: string;
  year: string;
  rating: string;
  quality: string;
  duration: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  posterUrl?: string;
  autoplaySound?: boolean;
  announcement: string;
  slideOrder: number;
  isActive: boolean;
}

export interface LandingAboutCard {
  id: string;
  title: string;
  desc: string;
  icon?: string;
}

export interface LandingAboutConfig {
  header: string;
  badge: string;
  subtitle: string;
  contentHtml: string;
  imageUrl: string;
  imageAlt?: string;
  captionTitle?: string;
  captionDesc?: string;
  featurePills?: string[];
  cards?: LandingAboutCard[];
}

export interface LandingFaqItem {
  id: string;
  question: string;
  answer: string;
  faqOrder: number;
  isActive: boolean;
}

export interface LandingPageContent {
  heroSlides: HeroSlideConfig[];
  heroSlideDelaySeconds: number;
  about: LandingAboutConfig;
  faqs: LandingFaqItem[];
}

declare global {
  interface Window {
    squad?: any;
    Squad?: any;
    PaystackPop?: any;
    Paystack?: any;
    MonnifySDK?: {
      initialize: (options: {
        amount: number;
        customerName: string;
        customerEmail: string;
        paymentReference: string;
        paymentDescription: string;
        currency: string;
        apiKey: string;
        contractCode: string;
        isTestMode?: boolean;
        onComplete: (response: any) => void;
        onClose: (data: any) => void;
      }) => void;
    };
  }
}
