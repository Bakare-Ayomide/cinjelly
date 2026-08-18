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
