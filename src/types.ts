export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  subscriptionStatus: 'Active' | 'Expired' | 'Disabled';
  paymentStatus: 'Paid' | 'Unpaid';
  registrationDate: string;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  jellyfinUserId?: string;
  role: 'admin' | 'user';
}

export interface SystemStatus {
  configured: boolean;
  hasAdmin: boolean;
  serverUrl: string;
  adminUsername: string;
  mysqlAvailable?: boolean;
  mysqlError?: string | null;
}

export interface JellyfinConfigDetails {
  serverUrl: string;
  adminUsername: string;
  apiKey: string;
}
