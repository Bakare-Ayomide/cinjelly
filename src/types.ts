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

export interface AffiliateStats {
  affiliateCode: string;
  registeredCount: number;
  paidCount: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  totalCommission: number;
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

declare global {
  interface Window {
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
