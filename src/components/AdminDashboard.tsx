import React, { useState, useEffect } from 'react';
import { 
  Users, CheckCircle, AlertTriangle, ShieldCheck, Search, RefreshCw, 
  ArrowLeft, Loader2, Ban, PlusCircle, Activity, UserCheck, Tv,
  TrendingUp, DollarSign, Percent, Settings, Award, ShieldAlert, Edit, Check, Calendar, ArrowRight,
  Trash2, ChevronLeft, ChevronRight, UserPlus, Info, CalendarDays, MessageSquare, Phone,
  CreditCard, X, Smartphone, Download, Mail, Send, Code, FileText, Lock, Eye, RotateCcw, Layout, Maximize2, Monitor, HelpCircle, Copy
} from 'lucide-react';
import { User } from '../types';
import { 
  DEFAULT_VERIFICATION_SUBJECT, 
  DEFAULT_VERIFICATION_TEMPLATE,
  DEFAULT_WELCOME_SUBJECT,
  DEFAULT_WELCOME_TEMPLATE,
  DEFAULT_NOTIFICATION_SUBJECT,
  DEFAULT_NOTIFICATION_TEMPLATE
} from '../lib/templates';

interface AdminDashboardProps {
  currentUser: User;
  onBackToPortal: () => void;
}

export default function AdminDashboard({ currentUser, onBackToPortal }: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual audit trigger state
  const [auditLoading, setAuditLoading] = useState(false);

  // Connection config state
  const [serverUrl, setServerUrl] = useState('');
  const [jellyfinAdminUser, setJellyfinAdminUser] = useState('');
  const [jellyfinAdminPass, setJellyfinAdminPass] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  // SMTP & Email Verification Config State
  const [smtpEnabled, setSmtpEnabled] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('CINJELLY Stream');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  // Email verification & templates state
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [emailVerificationSubject, setEmailVerificationSubject] = useState('');
  const [emailVerificationTemplate, setEmailVerificationTemplate] = useState('');
  const [welcomeEmailSubject, setWelcomeEmailSubject] = useState('');
  const [welcomeEmailTemplate, setWelcomeEmailTemplate] = useState('');
  const [notificationEmailSubject, setNotificationEmailSubject] = useState('');
  const [notificationEmailTemplate, setNotificationEmailTemplate] = useState('');

  // Email Template editor/preview view modes ('edit' | 'preview' | 'split')
  const [verifViewMode, setVerifViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [welcomeViewMode, setWelcomeViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [verifDevice, setVerifDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [welcomeDevice, setWelcomeDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testingTemplate, setTestingTemplate] = useState<'verif' | 'welcome' | null>(null);

  const handleSendTestTemplate = async (type: 'verif' | 'welcome') => {
    if (!smtpTestEmail) {
      showToast('Please enter a target recipient email address in the SMTP Test section above.', 'error');
      return;
    }

    setTestingTemplate(type);
    try {
      const isVerif = type === 'verif';
      const response = await fetch('/api/admin/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpSecure,
          smtpUser,
          smtpPass,
          smtpFromName,
          smtpFromEmail,
          testEmail: smtpTestEmail,
          customSubject: isVerif ? emailVerificationSubject : welcomeEmailSubject,
          customHtml: isVerif ? emailVerificationTemplate : welcomeEmailTemplate
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to send test email');
      }

      showToast(`Success! Test template email delivered to ${smtpTestEmail}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error sending test email', 'error');
    } finally {
      setTestingTemplate(null);
    }
  };

  // Fullscreen Email Preview Modal state
  const [emailModal, setEmailModal] = useState<{
    title: string;
    subject: string;
    html: string;
  } | null>(null);
  const [modalDevice, setModalDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Helper to render live sample HTML with dynamic tags
  const renderSampleEmailHtml = (template: string, customVars?: Record<string, string>) => {
    const sampleVars: Record<string, string> = {
      username: 'alex_streamer',
      fullName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      app_name: 'CINJELLY Stream',
      login_url: typeof window !== 'undefined' ? window.location.origin : 'https://zerolord.com',
      support_email: contactEmail || smtpFromEmail || 'support@zerolord.com',
      website_url: serverUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://zerolord.com'),
      current_year: new Date().getFullYear().toString(),
      verification_code: '849201',
      verification_link: typeof window !== 'undefined' ? `${window.location.origin}/api/auth/verify-email?token=sample_token_abc123` : 'https://zerolord.com/api/auth/verify-email?token=sample_token_abc123',
      ios_app_link: iosDownloadUrl || 'https://apps.apple.com/app/jellyfin/id1601583420',
      android_app_link: androidDownloadUrl || 'https://play.google.com/store/apps/details?id=org.jellyfin.mobile',
      notification_message: 'Your 30-day premium 4K pass has been renewed. Thank you for subscribing!',
      ...(customVars || {})
    };

    let rendered = template || '';
    Object.keys(sampleVars).forEach((key) => {
      rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}|\\{${key}\\}`, 'g'), sampleVars[key]);
    });
    return rendered;
  };

  const handleResetVerifTemplate = () => {
    if (window.confirm('Reset Verification Email Subject and HTML Template to factory default?')) {
      setEmailVerificationSubject(DEFAULT_VERIFICATION_SUBJECT);
      setEmailVerificationTemplate(DEFAULT_VERIFICATION_TEMPLATE);
      showToast('Verification email template reset to default!', 'success');
    }
  };

  const handleResetWelcomeTemplate = () => {
    if (window.confirm('Reset Welcome Email Subject and HTML Template to factory default?')) {
      setWelcomeEmailSubject(DEFAULT_WELCOME_SUBJECT);
      setWelcomeEmailTemplate(DEFAULT_WELCOME_TEMPLATE);
      showToast('Welcome email template reset to default!', 'success');
    }
  };

  // SMTP Test state
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [smtpTesting, setSmtpTesting] = useState(false);

  // Floating Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Helper to check if user registered within the last 2 days (48 hours)
  const isNewUser = (registrationDate?: string): boolean => {
    if (!registrationDate) return false;
    const regTime = new Date(registrationDate).getTime();
    if (isNaN(regTime)) return false;
    const diffMs = Date.now() - regTime;
    const fortyEightHoursMs = 2 * 24 * 60 * 60 * 1000;
    return diffMs >= 0 && diffMs <= fortyEightHoursMs;
  };

  // Helper to format signup date and day of week
  const formatSignupDateAndDay = (registrationDate?: string): string => {
    if (!registrationDate) return 'N/A';
    const d = new Date(registrationDate);
    if (isNaN(d.getTime())) return registrationDate;

    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return `${dayName}, ${dateStr} (${timeStr})`;
  };

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'payment_settings' | 'support_config' | 'mobile_app' | 'affiliates' | 'commissions' | 'reports' | 'payments' | 'affiliates_dashboard' | 'media_requests' | 'notifications' | 'smtp_email'>('subscriptions');

  // Affiliate Dashboard tab state
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any | null>(null);

  // Media requests tab state
  const [mediaRequests, setMediaRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Rich broadcast notification tab state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifImageUrl, setNotifImageUrl] = useState('');
  const [notifTargetType, setNotifTargetType] = useState<'all' | 'affiliate' | 'paid' | 'free' | 'user'>('all');
  const [notifTargetUserId, setNotifTargetUserId] = useState('');
  const [notifUserSearchQuery, setNotifUserSearchQuery] = useState('');
  const [notifImageFile, setNotifImageFile] = useState<File | null>(null);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [loadingSentNotifications, setLoadingSentNotifications] = useState(false);

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const getFullWebhookUrl = () => {
    let base = typeof window !== 'undefined' ? window.location.origin : '';
    // If window.location.origin is present, use it directly so it matches the current domain (e.g., https://cinjelly.zerolord.com)
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      base = window.location.origin;
    } else if (serverUrl && serverUrl.startsWith('http')) {
      base = serverUrl.replace(/\/$/, '');
    }
    return `${base}/api/payment/monnify-webhook`;
  };

  const handleCopyWebhook = () => {
    const url = getFullWebhookUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2500);
    }
  };

  const fetchSentNotifications = async () => {
    setLoadingSentNotifications(true);
    try {
      const res = await fetch('/api/admin/notifications/all');
      if (res.ok) {
        const data = await res.json();
        setSentNotifications(data);
      }
    } catch (err) {
      console.error('Error fetching sent notifications:', err);
    } finally {
      setLoadingSentNotifications(false);
    }
  };

  const fetchAffiliates = async () => {
    setAffiliatesLoading(true);
    try {
      const res = await fetch('/api/admin/affiliates');
      if (res.ok) {
        const data = await res.json();
        setAffiliates(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAffiliatesLoading(false);
    }
  };

  const fetchMediaRequests = async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch('/api/media/requests');
      if (res.ok) {
        const data = await res.json();
        setMediaRequests(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleUpdateRequestStatus = async (id: string, status: 'Approved' | 'Declined') => {
    try {
      const res = await fetch(`/api/admin/media/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setMediaRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        setSuccess(`Media request status updated to ${status}.`);
        showToast(`Media request ${status} successfully!`, 'success');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to update request status');
        showToast(data.error || 'Failed to update request status', 'error');
      }
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Error updating status', 'error');
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let finalImageUrl = notifImageUrl;

      if (notifImageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(notifImageFile);
        const base64Data = await base64Promise;

        const uploadRes = await fetch('/api/admin/notifications/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data, fileName: notifImageFile.name })
        });
        if (!uploadRes.ok) {
          throw new Error('Image upload failed');
        }
        const uploadData = await uploadRes.json();
        finalImageUrl = uploadData.url;
      }

      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifTitle,
          message: notifMessage,
          imageUrl: finalImageUrl || null,
          targetType: notifTargetType,
          targetUserId: notifTargetType === 'user' ? notifTargetUserId : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      setSuccess('Broadcast notification sent successfully!');
      showToast('Broadcast notification sent successfully!', 'success');
      setNotifTitle('');
      setNotifMessage('');
      setNotifImageUrl('');
      setNotifTargetUserId('');
      setNotifUserSearchQuery('');
      setNotifImageFile(null);
      fetchSentNotifications();
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Failed to send broadcast', 'error');
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Verify Payments tab state
  const [verificationLoadingUserId, setVerificationLoadingUserId] = useState<string | null>(null);
  const [declineTargetUser, setDeclineTargetUser] = useState<User | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState('');
  const [fullScreenReceiptUrl, setFullScreenReceiptUrl] = useState<string | null>(null);

  const handleVerifyPayment = async (userId: string, action: 'accept' | 'decline', reason?: string) => {
    setVerificationLoadingUserId(userId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, action, declineReason: reason })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process verification');
      }
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u));
      setSuccess(`Payment verification ${action === 'accept' ? 'APPROVED' : 'DECLINED'} successfully.`);
      showToast(`Payment successfully ${action === 'accept' ? 'approved' : 'declined'}!`, 'success');
      setDeclineTargetUser(null);
      setDeclineReasonText('');
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Payment verification failed', 'error');
    } finally {
      setVerificationLoadingUserId(null);
    }
  };

  // Subscriptions tab state
  const [subStatusFilter, setSubStatusFilter] = useState<'All' | 'Active' | 'Expiring' | 'Expired' | 'Disabled'>('All');

  // CRUD state variables
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  // Form states
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formSubscriptionStatus, setFormSubscriptionStatus] = useState<'Active' | 'Expired' | 'Disabled'>('Disabled');
  const [formPaymentStatus, setFormPaymentStatus] = useState<'Paid' | 'Unpaid'>('Unpaid');
  const [formAccountStatus, setFormAccountStatus] = useState<'Active' | 'Disabled'>('Disabled');
  const [formRole, setFormRole] = useState<'user' | 'admin'>('user');
  const [formSubscriptionExpiryDate, setFormSubscriptionExpiryDate] = useState('');
  const [formReferredBy, setFormReferredBy] = useState('');
  const [formIsAffiliate, setFormIsAffiliate] = useState(false);
  const [formAffiliateCode, setFormAffiliateCode] = useState('');

  // View state for subscription controls
  const [subViewMode, setSubViewMode] = useState<'list' | 'calendar'>('list');

  // Calendar Date
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  // Commissions ledger state
  const [commissions, setCommissions] = useState<any[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  // Affiliate Partner edit settings modal state
  const [editingAffiliateUser, setEditingAffiliateUser] = useState<User | null>(null);
  const [editIsAffiliate, setEditIsAffiliate] = useState(false);
  const [editAffiliateCode, setEditAffiliateCode] = useState('');
  const [affSaving, setAffSaving] = useState(false);

  // Configurable default commission
  const [defaultCommission, setDefaultCommission] = useState('100.00');

  // Banking config states
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBeneficiary, setBankBeneficiary] = useState('');
  const [bankInstructions, setBankInstructions] = useState('');

  // Monnify Payment Gateway config states
  const [monnifyEnabled, setMonnifyEnabled] = useState(false);
  const [monnifyApiKey, setMonnifyApiKey] = useState('');
  const [monnifyContractCode, setMonnifyContractCode] = useState('');
  const [monnifySecretKey, setMonnifySecretKey] = useState('');
  const [monnifyMode, setMonnifyMode] = useState<'live' | 'test'>('live');
  const [subscriptionAmount, setSubscriptionAmount] = useState('600.00');

  // Chatbot & Contact config states
  const [chatbotInfo, setChatbotInfo] = useState('');
  const [chatbotInstructions, setChatbotInstructions] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsApp, setContactWhatsApp] = useState('');
  const [contactOther, setContactOther] = useState('');
  const [iosDownloadUrl, setIosDownloadUrl] = useState('');
  const [androidDownloadUrl, setAndroidDownloadUrl] = useState('');

  // Birds-eye View & User Management Modal state
  const [selectedUserForView, setSelectedUserForView] = useState<User | null>(null);

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}`);
      
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your admin session has expired or you do not have permission to view this console. Please sign out and log back in.');
        }
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Access denied or database error.');
        } else {
          throw new Error(`Server returned error status ${response.status}.`);
        }
      }

      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server did not return JSON.');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const response = await fetch('/api/admin/config');
      if (response.ok) {
        const data = await response.json();
        setServerUrl(data.serverUrl || '');
        setJellyfinAdminUser(data.adminUsername || '');
        setJellyfinAdminPass(data.adminPasswordFull || '');
        setApiKey(data.apiKey || '');
        setDefaultCommission(data.defaultCommission || '100.00');
        setBankAccountNo(data.bankAccountNo || '');
        setBankName(data.bankName || '');
        setBankBeneficiary(data.bankBeneficiary || '');
        setBankInstructions(data.bankInstructions || '');
        setChatbotInfo(data.chatbotInfo || '');
        setChatbotInstructions(data.chatbotInstructions || '');
        setContactEmail(data.contactEmail || '');
        setContactPhone(data.contactPhone || '');
        setContactWhatsApp(data.contactWhatsApp || '');
        setContactOther(data.contactOther || '');
        setIosDownloadUrl(data.iosDownloadUrl || '');
        setAndroidDownloadUrl(data.androidDownloadUrl || '');

        // SMTP settings
        setSmtpEnabled(!!data.smtpEnabled);
        setSmtpHost(data.smtpHost || '');
        setSmtpPort(data.smtpPort || 587);
        setSmtpSecure(!!data.smtpSecure);
        setSmtpUser(data.smtpUser || '');
        setSmtpPass(data.smtpPass || '');
        setSmtpFromName(data.smtpFromName || 'CINJELLY Stream');
        setSmtpFromEmail(data.smtpFromEmail || '');

        // Email templates & verification settings
        setEmailVerificationEnabled(!!data.emailVerificationEnabled);
        setEmailVerificationSubject(data.emailVerificationSubject || '');
        setEmailVerificationTemplate(data.emailVerificationTemplate || '');
        setWelcomeEmailSubject(data.welcomeEmailSubject || '');
        setWelcomeEmailTemplate(data.welcomeEmailTemplate || '');
        setNotificationEmailSubject(data.notificationEmailSubject || '');
        setNotificationEmailTemplate(data.notificationEmailTemplate || '');

        // Monnify settings
        setMonnifyEnabled(!!data.monnifyEnabled);
        setMonnifyApiKey(data.monnifyApiKey || '');
        setMonnifyContractCode(data.monnifyContractCode || '');
        setMonnifySecretKey(data.monnifySecretKey || '');
        setMonnifyMode(data.monnifyMode || 'live');
        setSubscriptionAmount(data.subscriptionAmount ? String(data.subscriptionAmount) : '600.00');
      }
    } catch (err: any) {
      setConfigError('Could not load active Jellyfin server settings.');
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchCommissions = async () => {
    setCommissionsLoading(true);
    try {
      const response = await fetch('/api/admin/commissions');
      if (response.ok) {
        const data = await response.json();
        setCommissions(data);
      }
    } catch (err) {
      console.error('Error fetching commissions ledger:', err);
    } finally {
      setCommissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchConfig();
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab === 'commissions' || activeTab === 'reports') {
      fetchCommissions();
    } else if (activeTab === 'affiliates_dashboard') {
      fetchAffiliates();
    } else if (activeTab === 'media_requests') {
      fetchMediaRequests();
    } else if (activeTab === 'notifications') {
      fetchSentNotifications();
    }
  }, [activeTab]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    setConfigSuccess(null);
    setConfigSaving(true);
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          adminUsername: jellyfinAdminUser,
          adminPasswordFull: jellyfinAdminPass,
          apiKey,
          defaultCommission,
          bankAccountNo,
          bankName,
          bankBeneficiary,
          bankInstructions,
          chatbotInfo,
          chatbotInstructions,
          contactEmail,
          contactPhone,
          contactWhatsApp,
          contactOther,
          iosDownloadUrl,
          androidDownloadUrl,
          smtpEnabled,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPass,
          smtpFromName,
          smtpFromEmail,
          emailVerificationEnabled,
          emailVerificationSubject,
          emailVerificationTemplate,
          welcomeEmailSubject,
          welcomeEmailTemplate,
          notificationEmailSubject,
          notificationEmailTemplate,
          monnifyEnabled,
          monnifyApiKey,
          monnifyContractCode,
          monnifySecretKey,
          monnifyMode,
          subscriptionAmount
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      setConfigSuccess('System settings, SMTP & Email Verification options saved successfully!');
      showToast('Configuration settings saved successfully!', 'success');
      fetchUsers();
    } catch (err: any) {
      setConfigError(err.message || 'Verification failed.');
      showToast(err.message || 'Failed to save configuration.', 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpTestEmail) {
      showToast('Please enter an email address for testing SMTP.', 'error');
      return;
    }

    setSmtpTesting(true);
    try {
      const response = await fetch('/api/admin/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpSecure,
          smtpUser,
          smtpPass,
          smtpFromName,
          smtpFromEmail,
          testEmail: smtpTestEmail
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'SMTP test failed');
      }

      showToast(`Success! Test email delivered to ${smtpTestEmail}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'SMTP Connection Test Failed', 'error');
    } finally {
      setSmtpTesting(false);
    }
  };

  // Handle subscriber actions (activate, extend, disable, reactivate)
  const handleUserAction = async (userId: string, action: 'activate' | 'extend' | 'disable' | 'reactivate') => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Operation failed');
      }

      setSuccess(`User subscription status successfully updated to "${action.toUpperCase()}".`);
      showToast(`Subscription status updated to ${action.toUpperCase()}!`, 'success');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  // Run manual subscription expiry audit checks
  const runManualExpiryCheck = async () => {
    setAuditLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/run-expiry-check', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Audit check failed');

      setSuccess(`Subscription expiry audit complete. Suspended and deactivated ${data.expiredCount} expired accounts.`);
      showToast(`Audit complete! Suspended ${data.expiredCount} expired accounts.`, 'success');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Audit check failed', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  // Toggle user affiliate status & update custom affiliate code
  const handleSaveAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAffiliateUser) return;
    setAffSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/users/${editingAffiliateUser.id}/affiliate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isAffiliate: editIsAffiliate,
          affiliateCode: editAffiliateCode
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update affiliate configuration');
      
      setSuccess(`Successfully updated referral configurations for ${editingAffiliateUser.fullName}.`);
      showToast(`Affiliate settings updated for ${editingAffiliateUser.fullName}!`, 'success');
      setEditingAffiliateUser(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Failed to update affiliate configuration', 'error');
    } finally {
      setAffSaving(false);
    }
  };

  // Approve or pay referral commissions
  const handleCommissionStatus = async (id: string, newStatus: 'Pending' | 'Approved' | 'Paid') => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/commissions/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update commission');

      setSuccess(`Commission payout successfully transitioned to status "${newStatus}".`);
      showToast(`Commission status updated to ${newStatus}!`, 'success');
      fetchCommissions();
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || 'Failed to update commission', 'error');
    }
  };

  // Reset Form
  const resetForm = () => {
    setFormFullName('');
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormSubscriptionStatus('Disabled');
    setFormPaymentStatus('Unpaid');
    setFormAccountStatus('Disabled');
    setFormRole('user');
    setFormSubscriptionExpiryDate('');
    setFormReferredBy('');
    setFormIsAffiliate(false);
    setFormAffiliateCode('');
    setCrudError(null);
  };

  // Open Add Modal
  const openAddModal = () => {
    resetForm();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setFormSubscriptionExpiryDate(thirtyDaysFromNow.toISOString().split('T')[0]);
    setFormSubscriptionStatus('Active');
    setFormPaymentStatus('Paid');
    setFormAccountStatus('Active');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setTargetUser(user);
    setFormFullName(user.fullName || '');
    setFormUsername(user.username || '');
    setFormEmail(user.email || '');
    setFormPassword(''); // blank means don't change
    setFormSubscriptionStatus(user.subscriptionStatus || 'Disabled');
    setFormPaymentStatus(user.paymentStatus || 'Unpaid');
    setFormAccountStatus(user.accountStatus || 'Disabled');
    setFormRole(user.role || 'user');
    setFormSubscriptionExpiryDate(user.subscriptionExpiryDate ? new Date(user.subscriptionExpiryDate).toISOString().split('T')[0] : '');
    setFormReferredBy(user.referredBy || '');
    setFormIsAffiliate(!!user.isAffiliate);
    setFormAffiliateCode(user.affiliateCode || '');
    setCrudError(null);
    setIsEditModalOpen(true);
  };

  // Handle Add User Submit
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrudLoading(true);
    setCrudError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName,
          username: formUsername,
          email: formEmail,
          password: formPassword,
          subscriptionStatus: formSubscriptionStatus,
          paymentStatus: formPaymentStatus,
          accountStatus: formAccountStatus,
          role: formRole,
          subscriptionExpiryDate: formSubscriptionExpiryDate ? new Date(formSubscriptionExpiryDate).toISOString() : null,
          referredBy: formReferredBy || null,
          isAffiliate: formIsAffiliate,
          affiliateCode: formIsAffiliate ? formAffiliateCode : null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`Subscriber account ${formFullName} was successfully created.`);
      showToast(`Subscriber ${formFullName} created!`, 'success');
      setIsAddModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setCrudError(err.message);
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setCrudLoading(false);
    }
  };

  // Handle Edit User Submit
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      const response = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formFullName,
          username: formUsername,
          email: formEmail,
          password: formPassword || undefined,
          subscriptionStatus: formSubscriptionStatus,
          paymentStatus: formPaymentStatus,
          accountStatus: formAccountStatus,
          role: formRole,
          subscriptionExpiryDate: formSubscriptionExpiryDate ? new Date(formSubscriptionExpiryDate).toISOString() : null,
          referredBy: formReferredBy || null,
          isAffiliate: formIsAffiliate,
          affiliateCode: formIsAffiliate ? formAffiliateCode : null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      setSuccess(`Subscriber account ${formFullName} was successfully updated.`);
      showToast(`Subscriber ${formFullName} updated!`, 'success');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setCrudError(err.message);
      showToast(err.message || 'Failed to update user', 'error');
    } finally {
      setCrudLoading(false);
    }
  };

  // Handle Delete User Confirm
  const handleDeleteUser = async () => {
    if (!targetUser) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      const response = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess(`Subscriber account ${targetUser.fullName} was deleted successfully.`);
      showToast(`Subscriber ${targetUser.fullName} deleted!`, 'success');
      setIsDeleteModalOpen(false);
      setTargetUser(null);
      fetchUsers();
    } catch (err: any) {
      setCrudError(err.message);
      showToast(err.message || 'Failed to delete user', 'error');
    } finally {
      setCrudLoading(false);
    }
  };

  // Utility to verify if user subscription is expiring within 7 days
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isExpiring = (expiryDateStr?: string) => {
    if (!expiryDateStr) return false;
    const expiry = new Date(expiryDateStr);
    return expiry > now && expiry <= sevenDaysFromNow;
  };

  // Core metrics
  const totalUsersCount = users.length;
  const activeSubsCount = users.filter(u => u.subscriptionStatus === 'Active' && u.role !== 'admin').length;
  const expiredSubsCount = users.filter(u => u.subscriptionStatus === 'Expired' && u.role !== 'admin').length;
  const affiliatePartnersCount = users.filter(u => u.isAffiliate).length;

  // Filter subscriptions tab
  const filteredUsersForSubs = users.filter(user => {
    if (subStatusFilter === 'All') return true;
    if (subStatusFilter === 'Active') return user.subscriptionStatus === 'Active';
    if (subStatusFilter === 'Expired') return user.subscriptionStatus === 'Expired';
    if (subStatusFilter === 'Disabled') return user.subscriptionStatus === 'Disabled';
    if (subStatusFilter === 'Expiring') return isExpiring(user.subscriptionExpiryDate);
    return true;
  });

  // Calculate Reports Business Intelligence
  const activePayingMembers = users.filter(u => u.subscriptionStatus === 'Active' && u.role !== 'admin').length;
  const totalRevenueSimulated = activePayingMembers * 600;
  
  const pendingCommVolume = commissions.filter(c => c.status === 'Pending').reduce((acc, c) => acc + parseFloat(c.amount), 0);
  const approvedCommVolume = commissions.filter(c => c.status === 'Approved').reduce((acc, c) => acc + parseFloat(c.amount), 0);
  const paidCommVolume = commissions.filter(c => c.status === 'Paid').reduce((acc, c) => acc + parseFloat(c.amount), 0);
  const totalCommExpense = pendingCommVolume + approvedCommVolume + paidCommVolume;

  // Calculate Conversion Rate
  const totalReferredRegistrations = users.filter(u => u.referredBy).length;
  const paidReferredCount = users.filter(u => u.referredBy && (u.subscriptionStatus === 'Active' || u.paymentStatus === 'Paid')).length;
  const referralConversionRate = totalReferredRegistrations > 0 
    ? ((paidReferredCount / totalReferredRegistrations) * 100).toFixed(1) 
    : '0.0';

  // Calculate Top Affiliates
  const affiliateRecordsMap: Record<string, { name: string; username: string; code: string; count: number; total: number }> = {};
  commissions.forEach(c => {
    const code = c.affiliateCode || 'N/A';
    if (!affiliateRecordsMap[code]) {
      affiliateRecordsMap[code] = {
        name: c.affiliateName || 'Partner User',
        username: c.affiliateUsername || '',
        code: code,
        count: 0,
        total: 0
      };
    }
    affiliateRecordsMap[code].count += 1;
    affiliateRecordsMap[code].total += parseFloat(c.amount);
  });
  const sortedTopAffiliates = Object.values(affiliateRecordsMap).sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen bg-[#090a0f] py-4 sm:py-8 px-3 sm:px-6 lg:px-8 selection:bg-rose-600 selection:text-white relative" id="admin-dashboard-root">
      
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] max-w-sm w-full bg-[#11131e]/95 backdrop-blur-md border-l-4 ${toast.type === 'success' ? 'border-emerald-500' : 'border-rose-500'} rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300`}>
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
              {toast.type === 'success' ? 'Action Successful' : 'Action Failed'}
            </h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-normal">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-500 hover:text-white transition font-bold text-xs p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Top Header Controls bar */}
      <nav className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-slate-800/60 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <button 
              onClick={onBackToPortal}
              className="flex-1 sm:flex-none text-slate-300 hover:text-white transition flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-rose-500" /> Portal
            </button>
            <button 
              onClick={() => { window.location.hash = '#landing'; }}
              className="flex-1 sm:flex-none text-slate-300 hover:text-white transition flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider cursor-pointer bg-slate-900 border border-slate-800 px-3.5 py-2.5 rounded-xl shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-500" /> Landing
            </button>
          </div>
          <div className="h-6 w-[1px] bg-slate-800/80 hidden sm:block"></div>
          <h1 className="font-display font-extrabold text-sm sm:text-lg tracking-tight text-white text-center sm:text-left">
            Administrator Central Console
          </h1>
        </div>
        
        <div className="flex items-center justify-center md:justify-end w-full md:w-auto">
          <span className="text-[10px] sm:text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 py-2 px-4 rounded-xl font-semibold tracking-wider uppercase">
            Overseer Control Mode
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Core Administrative Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="admin-stats-container">
          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 hidden sm:block">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Members</span>
              <span className="text-2xl font-extrabold text-white">{totalUsersCount}</span>
            </div>
          </div>

          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hidden sm:block">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Active Streamers</span>
              <span className="text-2xl font-extrabold text-white">{activeSubsCount}</span>
            </div>
          </div>

          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 hidden sm:block">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Expired Accounts</span>
              <span className="text-2xl font-extrabold text-white">{expiredSubsCount}</span>
            </div>
          </div>

          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hidden sm:block">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Affiliate Partners</span>
              <span className="text-2xl font-extrabold text-white">{affiliatePartnersCount}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">×</button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Tab Controls Navigation */}
        <div className="flex border-b border-slate-800/80 gap-2 overflow-x-auto pb-px" id="admin-tabs">
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'subscriptions' ? 'border-rose-500 text-rose-400 bg-rose-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Tv className="w-4 h-4" /> Subscription Control
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'payments' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <CreditCard className="w-4 h-4" /> Verify Payments
            {users.filter(u => u.paymentStatus === 'Pending Verification').length > 0 && (
              <span className="bg-rose-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-full min-w-4 text-center ml-1 animate-pulse">
                {users.filter(u => u.paymentStatus === 'Pending Verification').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('payment_settings')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'payment_settings' ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <CreditCard className="w-4 h-4" /> Payment Settings & Monnify
          </button>
          <button
            onClick={() => setActiveTab('support_config')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'support_config' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <HelpCircle className="w-4 h-4" /> Support & Chatbot
          </button>
          <button
            onClick={() => setActiveTab('mobile_app')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'mobile_app' ? 'border-rose-400 text-rose-300 bg-rose-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Smartphone className="w-4 h-4" /> Mobile Apps
          </button>
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'affiliates' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Percent className="w-4 h-4" /> Affiliates Program
          </button>
          <button
            onClick={() => setActiveTab('affiliates_dashboard')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'affiliates_dashboard' ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Award className="w-4 h-4" /> Affiliate Partners
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'commissions' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <DollarSign className="w-4 h-4" /> Commissions Ledger
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'reports' ? 'border-violet-500 text-violet-400 bg-violet-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <TrendingUp className="w-4 h-4" /> BI Reports
          </button>
          <button
            onClick={() => setActiveTab('media_requests')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'media_requests' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <PlusCircle className="w-4 h-4" /> Content Requests
            {mediaRequests.filter(r => r.status === 'Pending').length > 0 && (
              <span className="bg-cyan-600 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-full min-w-4 text-center ml-1 animate-pulse">
                {mediaRequests.filter(r => r.status === 'Pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'notifications' ? 'border-sky-500 text-sky-400 bg-sky-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <MessageSquare className="w-4 h-4" /> Send Broadcasts
          </button>
          <button
            onClick={() => setActiveTab('smtp_email')}
            className={`py-3 px-5 border-b-2 font-display font-bold text-xs uppercase tracking-wider transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'smtp_email' ? 'border-purple-500 text-purple-400 bg-purple-500/5' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Mail className="w-4 h-4" /> SMTP & Verification
          </button>
        </div>        {/* TAB 1: SUBSCRIPTION CONTROL */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            
            {/* Action Bar */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
              
              <div className="flex flex-wrap items-center gap-3">
                {/* View Toggler */}
                <div className="flex bg-[#07080c] p-1 rounded-xl border border-slate-800/80">
                  <button
                    onClick={() => setSubViewMode('list')}
                    className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${subViewMode === 'list' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Registry List
                  </button>
                  <button
                    onClick={() => setSubViewMode('calendar')}
                    className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${subViewMode === 'calendar' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Expiry Calendar
                  </button>
                </div>

                {/* Filter Tabs */}
                {subViewMode === 'list' && (
                  <div className="flex items-center gap-1 overflow-x-auto bg-[#07080c] p-1 rounded-xl border border-slate-800/80">
                    {(['All', 'Active', 'Expiring', 'Expired', 'Disabled'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSubStatusFilter(filter)}
                        className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap ${subStatusFilter === filter ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Auditor, Creator & Search */}
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap xl:flex-nowrap">
                <button
                  type="button"
                  onClick={openAddModal}
                  className="bg-emerald-600 hover:bg-emerald-700 border border-emerald-500/20 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Member
                </button>

                <button
                  type="button"
                  onClick={runManualExpiryCheck}
                  disabled={auditLoading}
                  className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-rose-500" />}
                  Audit Expiries
                </button>

                {subViewMode === 'list' && (
                  <div className="relative">
                    <Search className="absolute inset-y-0 left-3.5 h-full w-3.5 text-slate-500 flex items-center" />
                    <input 
                      type="text" 
                      placeholder="Search members..." 
                      className="w-full sm:w-48 bg-[#07080c] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>

            </div>

            {/* Subscriptions Table List View */}
            {subViewMode === 'list' && (
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
                <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-[#07080c]">
                  <table className="min-w-full divide-y divide-slate-800/60">
                    <thead className="bg-[#0e1018]">
                      <tr className="text-left text-xs font-semibold text-slate-400 tracking-wider">
                        <th className="px-6 py-4">Subscriber Details</th>
                        <th className="px-6 py-4">Signed Up Date & Day</th>
                        <th className="px-6 py-4">Plan Status</th>
                        <th className="px-6 py-4">Server Link ID</th>
                        <th className="px-6 py-4 text-right">Expiration Action Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-sm">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                            <span className="text-xs">Fetching records...</span>
                          </td>
                        </tr>
                      ) : filteredUsersForSubs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium text-xs">
                            No subscriber accounts match this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredUsersForSubs.map((user) => {
                          const expiringNow = isExpiring(user.subscriptionExpiryDate);
                          const isNew = isNewUser(user.registrationDate);
                          return (
                            <tr key={user.id} className="hover:bg-[#11131e]/50 transition text-xs">
                              <td 
                                className="px-6 py-4 cursor-pointer group hover:bg-[#151726]/80 transition-colors"
                                onClick={() => setSelectedUserForView(user)}
                                title="Click to open Birds-eye View & User Management"
                              >
                                <span className="font-bold text-white text-sm group-hover:text-rose-400 group-hover:underline transition-colors flex items-center gap-1.5 flex-wrap">
                                  {user.fullName}
                                  {isNew && (
                                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                      (NEW)
                                    </span>
                                  )}
                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-rose-500/15 text-rose-300 font-normal px-1.5 py-0.5 rounded border border-rose-500/20 font-sans">
                                    Manage
                                  </span>
                                </span>
                                <span className="block text-[11px] text-slate-400 mt-0.5">@{user.username} • {user.email}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="text-slate-200 font-medium text-xs flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    {formatSignupDateAndDay(user.registrationDate)}
                                  </span>
                                  {isNew && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                      Registered Recently
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1 items-start">
                                  {user.role === 'admin' ? (
                                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded">ADMIN</span>
                                  ) : user.subscriptionStatus === 'Active' ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> ACTIVE {expiringNow && '• EXPIRING'}
                                    </span>
                                  ) : user.subscriptionStatus === 'Disabled' ? (
                                    <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-bold px-2 py-0.5 rounded">LOCKED</span>
                                  ) : (
                                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 rounded">EXPIRED</span>
                                  )}
                                  
                                  {user.subscriptionExpiryDate && user.role !== 'admin' && (
                                    <span className={`block text-[10px] mt-0.5 font-semibold ${expiringNow ? 'text-amber-400' : 'text-slate-500'}`}>
                                      Expiry: {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                                {user.role === 'admin' ? (
                                  <span className="text-slate-600 font-medium font-sans">Bypassed</span>
                                ) : (
                                  <span className="truncate block max-w-[130px]" title={user.jellyfinUserId}>{user.jellyfinUserId || 'Sync Pending'}</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                  {/* Row edit/delete buttons */}
                                  <button
                                    onClick={() => openEditModal(user)}
                                    title="Edit Profile"
                                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-amber-400" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setTargetUser(user);
                                      setIsDeleteModalOpen(true);
                                    }}
                                    title="Delete Member"
                                    className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 hover:text-rose-200 font-bold p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </button>

                                  <div className="h-4 w-[1px] bg-slate-800 mx-1"></div>

                                  {user.role !== 'admin' && (
                                    <>
                                      {user.subscriptionStatus !== 'Active' ? (
                                        <button
                                          onClick={() => handleUserAction(user.id, 'activate')}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1 shadow-md"
                                        >
                                          <PlusCircle className="w-3 h-3" /> Activate
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => handleUserAction(user.id, 'extend')}
                                            className="bg-[#11131e] hover:bg-[#151726] border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                                          >
                                            <RefreshCw className="w-3 h-3 text-rose-500" /> Renew 30 Days
                                          </button>
                                          <button
                                            onClick={() => handleUserAction(user.id, 'disable')}
                                            className="bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1"
                                          >
                                            <Ban className="w-3 h-3" /> Lock Accounts
                                          </button>
                                        </>
                                      )}
                                      {user.subscriptionStatus === 'Disabled' && (
                                        <button
                                          onClick={() => handleUserAction(user.id, 'reactivate')}
                                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer"
                                        >
                                          Unlock
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expiry Calendar View */}
            {subViewMode === 'calendar' && (
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* Calendar Header with month selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-rose-500" />
                      <span>Subscription Expiry Calendar</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Visual calendar showing which user subscriptions expire on each day of the month.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-center sm:self-auto bg-[#07080c] border border-slate-800 rounded-xl p-1.5">
                    <button
                      onClick={() => {
                        const prevMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                        setCalendarDate(prevMonth);
                        setSelectedCalendarDay(null);
                      }}
                      className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-white px-3 tracking-wider uppercase">
                      {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => {
                        const nextMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                        setCalendarDate(nextMonth);
                        setSelectedCalendarDay(null);
                      }}
                      className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Days grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Days of week headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest py-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar cells */}
                  {(() => {
                    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
                    const startDayOfWeek = startOfMonth.getDay();
                    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
                    
                    // Helpers to get users expiring on day
                    const getUsersExpiringOnDay = (day: number) => {
                      return users.filter(u => {
                        if (!u.subscriptionExpiryDate || u.role === 'admin') return false;
                        const expDate = new Date(u.subscriptionExpiryDate);
                        return expDate.getFullYear() === calendarDate.getFullYear() &&
                               expDate.getMonth() === calendarDate.getMonth() &&
                               expDate.getDate() === day;
                      });
                    };

                    const cells = [];
                    // Empty cells before start day of week
                    for (let i = 0; i < startDayOfWeek; i++) {
                      cells.push(<div key={`empty-${i}`} className="aspect-square bg-[#07080c]/30 rounded-xl border border-transparent"></div>);
                    }

                    // Days of month cells
                    for (let day = 1; day <= daysInMonth; day++) {
                      const expiringUsers = getUsersExpiringOnDay(day);
                      const hasExpiries = expiringUsers.length > 0;
                      const isSelected = selectedCalendarDay === day;

                      cells.push(
                        <button
                          key={`day-${day}`}
                          onClick={() => setSelectedCalendarDay(isSelected ? null : day)}
                          className={`aspect-square p-2 rounded-xl border flex flex-col justify-between items-start text-left transition relative cursor-pointer group ${
                            isSelected 
                              ? 'bg-rose-500/15 border-rose-500 shadow-lg shadow-rose-500/5' 
                              : hasExpiries
                              ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                              : 'bg-[#07080c] border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span className={`text-xs font-bold ${hasExpiries ? 'text-amber-400 font-extrabold' : 'text-slate-500'}`}>
                            {day}
                          </span>

                          {hasExpiries && (
                            <div className="w-full">
                              {/* Show small badge/summary */}
                              <div className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/10 px-1 py-0.5 rounded truncate w-full block sm:hidden">
                                {expiringUsers.length} Exp
                              </div>
                              <div className="hidden sm:block space-y-0.5 mt-1 w-full">
                                {expiringUsers.slice(0, 2).map(u => (
                                  <div key={u.id} className="text-[8px] bg-amber-500/10 text-amber-300 px-1 py-0.5 rounded truncate w-full font-semibold border border-amber-500/10">
                                    {u.fullName.split(' ')[0]}
                                  </div>
                                ))}
                                {expiringUsers.length > 2 && (
                                  <div className="text-[8px] text-slate-500 font-extrabold pl-1 uppercase">
                                    + {expiringUsers.length - 2} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    }
                    return cells;
                  })()}
                </div>

                {/* Expiry Details for Selected Calendar Day */}
                {selectedCalendarDay !== null && (() => {
                  const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
                  const getUsersExpiringOnDay = (day: number) => {
                    return users.filter(u => {
                      if (!u.subscriptionExpiryDate || u.role === 'admin') return false;
                      const expDate = new Date(u.subscriptionExpiryDate);
                      return expDate.getFullYear() === calendarDate.getFullYear() &&
                             expDate.getMonth() === calendarDate.getMonth() &&
                             expDate.getDate() === day;
                    });
                  };
                  const expiringUsers = getUsersExpiringOnDay(selectedCalendarDay);
                  return (
                    <div className="bg-[#07080c] border border-slate-800/80 rounded-xl p-5 mt-4 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-rose-500" />
                          <span>Expiries on {calendarDate.toLocaleString('default', { month: 'long' })} {selectedCalendarDay}, {calendarDate.getFullYear()}</span>
                        </h4>
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold px-2.5 py-1 rounded-xl uppercase">
                          {expiringUsers.length} Expiring Member{expiringUsers.length !== 1 && 's'}
                        </span>
                      </div>

                      {expiringUsers.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">No user subscriptions expire on this day.</p>
                      ) : (
                        <div className="divide-y divide-slate-800/40 max-h-72 overflow-y-auto pr-1">
                          {expiringUsers.map(user => (
                            <div key={user.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div>
                                <span className="font-bold text-white text-sm block">{user.fullName}</span>
                                <span className="text-slate-400 block text-[10px]">@{user.username} • {user.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUserAction(user.id, 'extend')}
                                  className="bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 font-bold py-1.5 px-3 rounded-lg text-[10px] transition cursor-pointer"
                                >
                                  Renew 30 Days
                                </button>
                                <button
                                  onClick={() => openEditModal(user)}
                                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center"
                                >
                                  <Edit className="w-3.5 h-3.5 text-amber-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}

          </div>
        )}

        {/* TAB: PAYMENT SETTINGS & MONNIFY */}
        {activeTab === 'payment_settings' && (
          <div className="space-y-6">
            
            {/* Monnify Payment Gateway Configuration */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-sky-500"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                    <CreditCard className="w-4.5 h-4.5 text-sky-400" />
                    <span>Monnify Web Checkout Gateway</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                    Configure Monnify API credentials to enable instant automated payments via Card, Bank Transfer, USSD, and Mobile Wallet.
                  </p>
                </div>
                
                {/* Gateway Feature Toggle */}
                <div className="flex items-center gap-3 bg-[#07080c] p-2.5 px-4 rounded-xl border border-slate-800">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gateway Status</div>
                    <div className={`text-xs font-bold ${monnifyEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {monnifyEnabled ? 'FEATURE ENABLED' : 'FEATURE TOTALLY OFF'}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={monnifyEnabled}
                      onChange={(e) => setMonnifyEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                  </label>
                </div>
              </div>

              {/* Mode & Subscription Fee */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#08090f] p-4 rounded-xl border border-slate-800/80">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Environment Mode <span className="text-sky-400">*</span>
                  </label>
                  <select
                    value={monnifyMode}
                    onChange={(e: any) => setMonnifyMode(e.target.value)}
                    className="w-full bg-[#11131e] border border-slate-700 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition cursor-pointer font-bold"
                  >
                    <option value="live">🟢 Live / Production Mode</option>
                    <option value="test">🟡 Test / Sandbox Mode</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {monnifyMode === 'test' ? 'Test mode uses Monnify sandbox endpoints and test card/transfer simulations.' : 'Live mode accepts real monetary payments from subscribers.'}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Subscription Fee (₦ NGN) <span className="text-sky-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="600.00"
                    className="w-full bg-[#11131e] border border-slate-700 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition font-mono font-bold"
                    value={subscriptionAmount}
                    onChange={(e) => setSubscriptionAmount(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Amount charged per 30-day access period.
                  </p>
                </div>
              </div>

              {/* Required Keys */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Public Key / API Key <span className="text-sky-400">*</span></span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MK_PROD_FLX4P92EDF or MK_TEST_..."
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition font-mono"
                    value={monnifyApiKey}
                    onChange={(e) => setMonnifyApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Contract Key / Code <span className="text-sky-400">*</span></span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 626609763141"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition font-mono"
                    value={monnifyContractCode}
                    onChange={(e) => setMonnifyContractCode(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Secret Key <span className="text-sky-400">*</span></span>
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. MK_SECRET_..."
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition font-mono"
                    value={monnifySecretKey}
                    onChange={(e) => setMonnifySecretKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Webhook Configuration Field */}
              <div className="mt-5 p-4 rounded-xl bg-[#080a12] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-sky-400" />
                    <span>Monnify Webhook URL (Full Production & Sandbox Endpoint)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Copy & paste into Monnify Developer Dashboard</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getFullWebhookUrl()}
                    className="w-full bg-[#030407] border border-slate-800 text-slate-200 text-xs font-mono py-2 px-3 rounded-lg focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-3.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copiedWebhook ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  In your Monnify portal under <strong>Settings &gt; Webhook URL</strong>, set this exact URL. Our server also listens to <code className="text-slate-400">/api/monnify/webhook</code> for maximum compatibility.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-800/60">
                <span className="text-[11px] text-slate-400">
                  Status: {monnifyEnabled ? <span className="text-emerald-400 font-bold">Active ({monnifyMode.toUpperCase()} MODE)</span> : <span className="text-rose-400 font-bold">Disabled</span>}
                </span>
                <button
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 h-[36px]"
                >
                  {configSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Monnify Settings</span>
                </button>
              </div>
            </div>

            {/* Configurable Banking Details & Pay Instructions */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500"></div>
              <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                <DollarSign className="w-4.5 h-4.5 text-rose-400" />
                <span>Banking Configuration for Manual Payments</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                Set up the bank account information and manual payment instructions shown to new members when they choose to renew manually.
              </p>
              
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Zenith Bank" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1234567890" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beneficiary Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. John Doe" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={bankBeneficiary}
                    onChange={(e) => setBankBeneficiary(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Additional Instructions</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Send receipt via WhatsApp to +234..." 
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition resize-none"
                  value={bankInstructions}
                  onChange={(e) => setBankInstructions(e.target.value)}
                />
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 h-[36px]"
                >
                  <Check className="w-3.5 h-3.5" /> Save Banking Info
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SUPPORT & CHATBOT CONFIGURATION */}
        {activeTab === 'support_config' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500"></div>
              <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                <MessageSquare className="w-4.5 h-4.5 text-indigo-400" />
                <span>Support Contact & Chatbot Configuration</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                Configure global contact methods and support chatbot links shown across all pages to guide users when they need assistance.
              </p>
              
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Support Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. support@example.com" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Support Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +1 (555) 000-0000" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Contact URL / Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. https://wa.me/..." 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition"
                    value={contactWhatsApp}
                    onChange={(e) => setContactWhatsApp(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Contact / Support Notes</label>
                <textarea 
                  rows={2}
                  placeholder="e.g. Support hours: 9 AM - 6 PM UTC" 
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition resize-none"
                  value={contactOther}
                  onChange={(e) => setContactOther(e.target.value)}
                />
              </div>

              <div className="mt-5 border-t border-slate-800/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Telegram / Chatbot Username or URL</label>
                  <input 
                    type="text" 
                    placeholder="e.g. https://t.me/MyJellyfinSupportBot" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition"
                    value={chatbotInfo}
                    onChange={(e) => setChatbotInfo(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Instructions alongside chatbot</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Start the bot and send /register or /help" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition"
                    value={chatbotInstructions}
                    onChange={(e) => setChatbotInstructions(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 h-[36px]"
                >
                  <Check className="w-3.5 h-3.5" /> Save Contact & Chatbot Info
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: MOBILE CLIENT DOWNLOAD LINKS */}
        {activeTab === 'mobile_app' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500"></div>
              <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Smartphone className="w-4.5 h-4.5 text-rose-400" />
                <span>Mobile Client Download Configuration (iOS & Android)</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                Specify the custom download or install URLs for the iOS and Android mobile applications advertised on the landing page and portal.
              </p>
              
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-rose-300 uppercase tracking-wider">iOS App Store / TestFlight / IPA Link</label>
                  <input 
                    type="text" 
                    placeholder="e.g. https://apps.apple.com/app/cinode..." 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={iosDownloadUrl}
                    onChange={(e) => setIosDownloadUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-rose-300 uppercase tracking-wider">Android Google Play / APK Download Link</label>
                  <input 
                    type="text" 
                    placeholder="e.g. https://play.google.com/store/apps/details..." 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={androidDownloadUrl}
                    onChange={(e) => setAndroidDownloadUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 h-[36px]"
                >
                  <Check className="w-3.5 h-3.5" /> Save Mobile Download Links
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AFFILIATES PROGRAM */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6">
            
            {/* Configurable Default Commission Rate */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500"></div>
              <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-emerald-400" />
                <span>Default Affiliate Commission Rate</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                Configure the reward amount automatically allocated to a referral partner immediately upon their referred user completing their first 30-day paid subscription.
              </p>
              
              <div className="mt-5 flex flex-col sm:flex-row items-end gap-3 max-w-sm">
                <div className="space-y-1 w-full">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commission Reward (₦ NGN)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required
                    placeholder="100.00" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                    value={defaultCommission}
                    onChange={(e) => setDefaultCommission(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSaveConfig}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer whitespace-nowrap h-[36px]"
                >
                  Save Comm. Rate
                </button>
              </div>
            </div>

            {/* Affiliates Directory */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-display font-extrabold text-white">Affiliate Partner Registry</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Toggle users as active referral affiliates, view and edit their customizable promotional codes.</p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute inset-y-0 left-3.5 h-full w-3.5 text-slate-500 flex items-center" />
                  <input 
                    type="text" 
                    placeholder="Search partners..." 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-[#07080c]">
                <table className="min-w-full divide-y divide-slate-800/60">
                  <thead className="bg-[#0e1018]">
                    <tr className="text-left text-xs font-semibold text-slate-400 tracking-wider">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Affiliate Program Status</th>
                      <th className="px-6 py-4">Unique Promotional Code</th>
                      <th className="px-6 py-4">Referred By</th>
                      <th className="px-6 py-4 text-right">Referral Configuration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                          <span className="text-xs">Fetching records...</span>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                          No users registered.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-[#11131e]/50 transition text-xs">
                          <td className="px-6 py-4">
                            <span className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                              {user.fullName}
                              {isNewUser(user.registrationDate) && (
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                  (NEW)
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] text-slate-500">@{user.username} • {user.email}</span>
                            <span className="block text-[10px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
                              <CalendarDays className="w-3 h-3 text-emerald-400 shrink-0" />
                              Signed up: {formatSignupDateAndDay(user.registrationDate)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {user.isAffiliate ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                Active Partner
                              </span>
                            ) : (
                              <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                Standard Member
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-white text-xs">
                            {user.isAffiliate ? (user.affiliateCode || 'NOT_ASSIGNED') : '—'}
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                            {user.referredBy || '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setEditingAffiliateUser(user);
                                setEditIsAffiliate(!!user.isAffiliate);
                                setEditAffiliateCode(user.affiliateCode || '');
                              }}
                              className="bg-[#11131e] hover:bg-[#151726] border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-1.5 px-3 rounded-lg text-[11px] transition cursor-pointer flex items-center gap-1.5 ml-auto"
                            >
                              <Edit className="w-3 h-3 text-emerald-400" /> Configure Affiliate
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: COMMISSIONS LEDGER */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-display font-extrabold text-white">Referral Commissions Ledger</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Track, audit, approve and execute referral commission payouts securely.</p>
                </div>
                <button
                  onClick={fetchCommissions}
                  className="bg-[#07080c] hover:bg-[#121422] border border-slate-800 text-xs text-slate-300 font-bold py-1.5 px-3.5 rounded-xl flex items-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Sync Ledger
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-[#07080c]">
                <table className="min-w-full divide-y divide-slate-800/60">
                  <thead className="bg-[#0e1018]">
                    <tr className="text-left text-xs font-semibold text-slate-400 tracking-wider">
                      <th className="px-6 py-4">Affiliate Partner</th>
                      <th className="px-6 py-4">Referred Member</th>
                      <th className="px-6 py-4">Commission Amount</th>
                      <th className="px-6 py-4">Creation Date</th>
                      <th className="px-6 py-4">Current Status</th>
                      <th className="px-6 py-4 text-right">Execute Status transitions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-sm">
                    {commissionsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                          <span className="text-xs">Loading ledger...</span>
                        </td>
                      </tr>
                    ) : commissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                          No commission ledger items recorded in DB.
                        </td>
                      </tr>
                    ) : (
                      commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-[#11131e]/50 transition text-xs">
                          <td className="px-6 py-4">
                            <span className="block font-bold text-white text-sm">{c.affiliateName || 'Unknown User'}</span>
                            <span className="block text-[10px] text-emerald-400 font-mono">CODE: {c.affiliateCode || '—'}</span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-300 text-xs">
                            {c.referredName || 'Referred Subscriber'}
                          </td>
                          <td className="px-6 py-4 font-extrabold text-white text-xs">
                            ₦{parseFloat(c.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-[11px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                              c.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              c.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end">
                              <select
                                value={c.status}
                                onChange={(e) => handleCommissionStatus(c.id, e.target.value as any)}
                                className={`bg-[#07080c] border rounded-lg py-1 px-2 text-[10px] font-extrabold uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition cursor-pointer ${
                                  c.status === 'Paid' ? 'border-emerald-500/40 text-emerald-400' :
                                  c.status === 'Approved' ? 'border-blue-500/40 text-blue-400' :
                                  'border-amber-500/40 text-amber-400'
                                }`}
                              >
                                <option value="Pending" className="bg-[#0e1018] text-amber-400">Pending</option>
                                <option value="Approved" className="bg-[#0e1018] text-blue-400">Approved</option>
                                <option value="Paid" className="bg-[#0e1018] text-emerald-400">Paid</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BI REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6" id="reports-tab-section">
            
            {/* Earnings bento stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-rose-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estimated Revenue Volume</span>
                    <h4 className="text-3xl font-black text-white mt-1">₦{totalRevenueSimulated}</h4>
                  </div>
                  <TrendingUp className="w-6 h-6 text-rose-500" />
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Calculated based on {activePayingMembers} active, non-administrator streaming subscribers at standard ₦500 monthly fees.
                </p>
              </div>

              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Referral Partner Expense</span>
                    <h4 className="text-3xl font-black text-white mt-1">₦{totalCommExpense}</h4>
                  </div>
                  <Percent className="w-6 h-6 text-amber-500" />
                </div>
                <div className="space-y-1 text-[10px] text-slate-400 mt-1">
                  <div className="flex justify-between"><span>Paid out:</span> <span className="font-bold text-emerald-400">₦{paidCommVolume}</span></div>
                  <div className="flex justify-between"><span>Approved (Unpaid):</span> <span className="font-bold text-blue-400">₦{approvedCommVolume}</span></div>
                  <div className="flex justify-between"><span>Pending verification:</span> <span className="font-bold text-amber-400">₦{pendingCommVolume}</span></div>
                </div>
              </div>

              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-violet-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Referral Conversion Rate</span>
                    <h4 className="text-3xl font-black text-white mt-1">{referralConversionRate}%</h4>
                  </div>
                  <Award className="w-6 h-6 text-violet-500" />
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Out of {totalReferredRegistrations} referral code user registrations, {paidReferredCount} completed paid server activations.
                </p>
              </div>

            </div>

            {/* Top referral partners */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Leaderboard */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                  <Award className="w-4.5 h-4.5 text-rose-500" /> Referral Partner Leaderboard
                </h3>
                {sortedTopAffiliates.length === 0 ? (
                  <p className="text-xs text-slate-500 py-10 text-center">No referral partner rewards recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {sortedTopAffiliates.map((aff, index) => (
                      <div key={aff.code} className="flex justify-between items-center text-xs p-3 bg-[#07080c] border border-slate-800/60 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center font-bold text-[11px]">
                            #{index + 1}
                          </span>
                          <div>
                            <span className="block font-bold text-white text-sm">{aff.name}</span>
                            <span className="block text-[10px] text-slate-400">Code: {aff.code} • @{aff.username}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block font-black text-emerald-400 text-sm">₦{aff.total.toFixed(2)}</span>
                          <span className="block text-[10px] text-slate-500">{aff.count} paid referrals</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Server configuration quick info */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                    <ShieldAlert className="w-4.5 h-4.5 text-rose-500" /> Admin Business Insights
                  </h3>
                  <div className="space-y-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Active Jellyfin Endpoint</span>
                      <span className="font-mono text-slate-300 break-all block">{serverUrl || 'Not configured'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Payment Plan Cost</span>
                      <span className="text-rose-400 font-bold">₦600.00 NGN per 30 days</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Database System Status</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Healthy Connection
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-4 border-t border-slate-800/40">
                  Data updated dynamically from private MySQL tables.
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 5: VERIFY PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 mb-6">
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-emerald-500" />
                    <span>Payment Verification Queue</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Carefully review manual bank transfers and receipt images uploaded by users. Accepting a payment activates their subscription for 30 days and logs commissions for affiliates.
                  </p>
                </div>
                <div className="bg-[#07080c] px-4 py-2 border border-slate-800 rounded-xl shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Pending Tasks</span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    {users.filter(u => u.paymentStatus === 'Pending Verification').length} Requests
                  </span>
                </div>
              </div>

              {users.filter(u => u.paymentStatus === 'Pending Verification').length === 0 ? (
                <div className="text-center py-12 bg-[#07080c] rounded-2xl border border-slate-800/40">
                  <CheckCircle className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                  <h4 className="text-white font-bold text-sm">All caught up!</h4>
                  <p className="text-slate-500 text-xs mt-1">There are no pending subscription payment verifications right now.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {users
                    .filter(u => u.paymentStatus === 'Pending Verification')
                    .map((user) => (
                      <div
                        key={user.id}
                        className="bg-[#07080c] border border-slate-800/60 hover:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-stretch justify-between transition"
                      >
                        {/* Left side: User details */}
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-display font-black text-emerald-400">
                              {user.fullName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-sm">{user.fullName}</h4>
                              <span className="text-slate-500 text-xs">@{user.username} • {user.email}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-800/40 pt-4 text-xs">
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Reported Phone</span>
                              <span className="text-white font-semibold font-mono">{user.phone || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Reference ID</span>
                              <span className="text-amber-400 font-bold font-mono truncate block max-w-[120px]" title={user.transactionRef || 'N/A'}>
                                {user.transactionRef || 'None Provided'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Submitted On</span>
                              <span className="text-white">
                                {user.lastPaymentTime ? new Date(user.lastPaymentTime).toLocaleString() : 'Recently'}
                              </span>
                            </div>
                          </div>

                          {user.referredBy && (
                            <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-lg inline-flex items-center gap-2 text-[11px] text-slate-300">
                              <span className="bg-emerald-600/10 text-emerald-400 py-0.5 px-2 rounded border border-emerald-500/20 font-bold uppercase tracking-wider text-[9px]">Referred</span>
                              <span>Affiliate Code: <strong className="text-emerald-400 font-bold">{user.referredBy}</strong></span>
                            </div>
                          )}
                        </div>

                        {/* Middle: Receipt Screenshot */}
                        <div className="w-full md:w-48 shrink-0 flex flex-col justify-center items-center bg-slate-950 rounded-xl p-3 border border-slate-800/80 relative group">
                          {user.receiptUrl ? (
                            <>
                              <div className="w-full h-24 overflow-hidden rounded bg-slate-900 border border-slate-800/40 relative">
                                <img
                                  src={user.receiptUrl}
                                  alt="Receipt Screenshot"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                                  onClick={() => setFullScreenReceiptUrl(user.receiptUrl || null)}
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition cursor-pointer" onClick={() => setFullScreenReceiptUrl(user.receiptUrl || null)}>
                                  <span className="text-[10px] text-white font-bold tracking-wider bg-slate-900/80 py-1 px-2.5 rounded border border-slate-700">View Fullscreen</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-500 mt-2 truncate max-w-[160px]">receipt_screenshot.png</span>
                            </>
                          ) : (
                            <div className="text-center py-4 text-slate-600">
                              <ShieldAlert className="w-8 h-8 mx-auto mb-1 opacity-50" />
                              <span className="text-[10px] block">No screenshot uploaded</span>
                            </div>
                          )}
                        </div>

                        {/* Right side: Action Buttons */}
                        <div className="w-full md:w-52 shrink-0 flex md:flex-col justify-end gap-3 items-stretch border-t md:border-t-0 md:border-l border-slate-800/40 pt-4 md:pt-0 md:pl-6">
                          <button
                            onClick={() => handleVerifyPayment(user.id, 'accept')}
                            disabled={verificationLoadingUserId !== null}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {verificationLoadingUserId === user.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" /> Accept Payment
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={() => setDeclineTargetUser(user)}
                            disabled={verificationLoadingUserId !== null}
                            className="flex-1 bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-800 hover:border-rose-900/40 text-slate-400 font-bold py-3.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" /> Decline Request
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: AFFILIATE PARTNERS MANAGEMENT */}
        {activeTab === 'affiliates_dashboard' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 mb-6">
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                    <Award className="w-6 h-6 text-indigo-400" />
                    <span>Affiliate Partner Directory</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    See real-time performance tracking for all registered affiliates. Track referred registrations, active subscriptions, and pending commission settlements.
                  </p>
                </div>
                <div className="bg-[#07080c] px-4 py-2 border border-slate-800 rounded-xl shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Active Affiliates</span>
                  <span className="text-xl font-extrabold text-indigo-400">{affiliates.length} Partners</span>
                </div>
              </div>

              {affiliatesLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                  <span className="text-xs">Loading partner data...</span>
                </div>
              ) : affiliates.length === 0 ? (
                <div className="text-center py-12 bg-[#07080c] rounded-2xl border border-slate-800/40">
                  <Award className="w-12 h-12 text-indigo-500/20 mx-auto mb-3" />
                  <h4 className="text-white font-bold text-sm">No affiliate accounts yet</h4>
                  <p className="text-slate-500 text-xs mt-1">Mark a user as an affiliate to allow them to refer new members and earn rewards.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: List of Affiliates */}
                  <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select a Partner</h4>
                    {affiliates.map((partner) => (
                      <div
                        key={partner.id}
                        onClick={() => setSelectedAffiliate(partner)}
                        className={`p-4 rounded-xl border transition cursor-pointer text-left ${selectedAffiliate?.id === partner.id ? 'bg-indigo-500/10 border-indigo-500' : 'bg-[#07080c] border-slate-800/80 hover:border-slate-700'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-xs text-white block">{partner.fullName}</span>
                            <span className="text-slate-400 text-[10px] block">@{partner.username}</span>
                          </div>
                          <span className="bg-indigo-500/20 text-indigo-300 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">
                            {partner.affiliateCode || 'NONE'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/60 text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Referred</span>
                            <span className="text-slate-200 font-bold">{partner.registeredCount} members</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Total Earnings</span>
                            <span className="text-emerald-400 font-bold">₦{Number(partner.totalCommission).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right Column: Detailed Partner Dashboard View */}
                  <div className="lg:col-span-2">
                    {selectedAffiliate ? (
                      <div className="bg-[#07080c] border border-slate-800 rounded-2xl p-6 space-y-6">
                        {/* Header info */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
                          <div>
                            <h4 className="text-lg font-extrabold text-white">{selectedAffiliate.fullName}</h4>
                            <p className="text-slate-400 text-xs mt-0.5">Partner Email: {selectedAffiliate.email} | ID: {selectedAffiliate.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-xs">Affiliate Code:</span>
                            <span className="bg-indigo-500 text-white font-mono font-extrabold text-xs px-3 py-1 rounded-lg uppercase">
                              {selectedAffiliate.affiliateCode}
                            </span>
                          </div>
                        </div>

                        {/* Earnings breakdown bento widgets */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-[#11131e] border border-slate-800/80 p-4 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider">Total Commission</span>
                            <span className="text-lg font-black text-slate-100">₦{Number(selectedAffiliate.totalCommission).toLocaleString()}</span>
                          </div>
                          <div className="bg-[#11131e] border border-slate-800/80 p-4 rounded-xl">
                            <span className="text-[9px] font-bold text-amber-500 uppercase block tracking-wider">Pending (Verify)</span>
                            <span className="text-lg font-black text-amber-400">₦{Number(selectedAffiliate.pendingCommission).toLocaleString()}</span>
                          </div>
                          <div className="bg-[#11131e] border border-slate-800/80 p-4 rounded-xl">
                            <span className="text-[9px] font-bold text-emerald-500 uppercase block tracking-wider">Approved (Unpaid)</span>
                            <span className="text-lg font-black text-emerald-400">₦{Number(selectedAffiliate.approvedCommission).toLocaleString()}</span>
                          </div>
                          <div className="bg-[#11131e] border border-slate-800/80 p-4 rounded-xl">
                            <span className="text-[9px] font-bold text-indigo-500 uppercase block tracking-wider">Total Paid Out</span>
                            <span className="text-lg font-black text-indigo-400">₦{Number(selectedAffiliate.paidCommission).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Referred Users lists */}
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1">Referred Members ({selectedAffiliate.referredUsers.length})</h5>
                          {selectedAffiliate.referredUsers.length === 0 ? (
                            <p className="text-slate-500 text-xs">No users referred by this partner yet.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-800 text-slate-500 font-bold">
                                    <th className="pb-2">Name</th>
                                    <th className="pb-2">Username</th>
                                    <th className="pb-2">Subscription</th>
                                    <th className="pb-2">Payment Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                  {selectedAffiliate.referredUsers.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-slate-900/10">
                                      <td className="py-2 text-white font-semibold">{u.fullName}</td>
                                      <td className="py-2 text-slate-400 font-mono">@{u.username}</td>
                                      <td className="py-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.subscriptionStatus === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                          {u.subscriptionStatus}
                                        </span>
                                      </td>
                                      <td className="py-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-400' : u.paymentStatus === 'Pending Verification' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                                          {u.paymentStatus}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Commissions ledger for this affiliate */}
                        <div className="space-y-3 pt-4 border-t border-slate-800">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1">Commissions History</h5>
                          {selectedAffiliate.commissions.length === 0 ? (
                            <p className="text-slate-500 text-xs">No recorded commissions ledger entries.</p>
                          ) : (
                            <div className="space-y-2 max-h-[250px] overflow-y-auto">
                              {selectedAffiliate.commissions.map((comm: any) => (
                                <div key={comm.id} className="flex justify-between items-center p-2.5 bg-[#11131e] border border-slate-800/80 rounded-lg text-xs">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">{new Date(comm.createdAt).toLocaleString()}</span>
                                    <span className="text-white font-semibold">₦{Number(comm.amount).toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${comm.status === 'Paid' ? 'bg-indigo-500/10 text-indigo-400' : comm.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                      {comm.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    ) : (
                      <div className="bg-[#07080c] border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
                        <Info className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-xs">Click any partner on the left directory to view their complete earnings dashboard, payouts, and referred members.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CONTENT REQUESTS (MOVIES & SHOWS) */}
        {activeTab === 'media_requests' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-6 mb-6">
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                    <PlusCircle className="w-6 h-6 text-cyan-400" />
                    <span>User Content Requests</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Manage requests submitted by members for movies or TV shows they wish to see on your streaming server.
                  </p>
                </div>
                <div className="bg-[#07080c] px-4 py-2 border border-slate-800 rounded-xl shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">Pending Requests</span>
                  <span className="text-xl font-extrabold text-cyan-400">
                    {mediaRequests.filter(r => r.status === 'Pending').length} Pending
                  </span>
                </div>
              </div>

              {requestsLoading ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
                  <span className="text-xs">Loading movie/show requests...</span>
                </div>
              ) : mediaRequests.length === 0 ? (
                <div className="text-center py-12 bg-[#07080c] rounded-2xl border border-slate-800/40">
                  <Tv className="w-12 h-12 text-cyan-500/20 mx-auto mb-3" />
                  <h4 className="text-white font-bold text-sm">No media requests yet</h4>
                  <p className="text-slate-500 text-xs mt-1">Requests sent by users from their portals will appear here instantly.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 pl-2">User</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Title</th>
                        <th className="pb-3">Details / Season</th>
                        <th className="pb-3">Date Submitted</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right pr-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {mediaRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-900/10">
                          <td className="py-4 pl-2 font-semibold text-white">
                            <span>{req.username}</span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${req.type === 'show' ? 'bg-violet-500/10 text-violet-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {req.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 font-bold text-slate-100">{req.title}</td>
                          <td className="py-4 text-slate-400">
                            {req.type === 'movie' ? (
                              <span>Released: {req.releaseYear || 'Unknown'}</span>
                            ) : (
                              <span>
                                {req.season ? `Season: ${req.season}` : ''} 
                                {req.episode ? ` | Episode: ${req.episode}` : ' (Full Season)'}
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-slate-500 font-mono">
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'Declined' ? 'bg-rose-500/10 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-4 text-right pr-2">
                            {req.status === 'Pending' ? (
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => handleUpdateRequestStatus(req.id, 'Approved')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleUpdateRequestStatus(req.id, 'Declined')}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: SEND BROADCASTS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="border-b border-slate-800/60 pb-6 mb-6">
                <h3 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-sky-400" />
                  <span>Send Broadcast & Target Notifications</span>
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Draft rich announcements featuring customizable body text and images. Push to specific target categories or a single selected member.
                </p>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">Notification Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. New Movies Added this Weekend!"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">Target Audience</label>
                    <select
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition"
                      value={notifTargetType}
                      onChange={(e: any) => {
                        setNotifTargetType(e.target.value);
                        setNotifTargetUserId('');
                        setNotifUserSearchQuery('');
                      }}
                    >
                      <option value="all">Everyone (All registered users)</option>
                      <option value="paid">Paid Users Only (Active subscription)</option>
                      <option value="free">Free Users Only (Unpaid or Expired)</option>
                      <option value="affiliate">Affiliates Only (Partners)</option>
                      <option value="user">Specific Registered User (Search single user)</option>
                    </select>
                  </div>
                </div>

                {notifTargetType === 'user' && (
                  <div className="bg-[#07080c] p-4 border border-slate-800 rounded-xl space-y-3">
                    <label className="block text-xs font-bold text-slate-300">Search & Select Target User</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Type name, email or username to search..."
                        className="w-full bg-[#11131e] border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-sky-500 transition"
                        value={notifUserSearchQuery}
                        onChange={(e) => setNotifUserSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {users
                        .filter(u => 
                          u.fullName.toLowerCase().includes(notifUserSearchQuery.toLowerCase()) ||
                          u.username.toLowerCase().includes(notifUserSearchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(notifUserSearchQuery.toLowerCase())
                        )
                        .slice(0, 15)
                        .map(u => (
                          <div
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setNotifTargetUserId(u.id);
                              setNotifUserSearchQuery(u.fullName + ` (@${u.username})`);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${notifTargetUserId === u.id ? 'bg-sky-500/10 border border-sky-500/50 text-sky-300' : 'bg-[#11131e]/50 hover:bg-[#11131e] border border-slate-800/80 text-slate-300'}`}
                          >
                            <div>
                              <span className="font-bold block">{u.fullName}</span>
                              <span className="text-[10px] text-slate-500">@{u.username} | {u.email}</span>
                            </div>
                            {notifTargetUserId === u.id && (
                              <span className="bg-sky-500/20 text-sky-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Selected</span>
                            )}
                          </div>
                        ))
                      }
                      {users.filter(u => 
                        u.fullName.toLowerCase().includes(notifUserSearchQuery.toLowerCase()) ||
                        u.username.toLowerCase().includes(notifUserSearchQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(notifUserSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <span className="text-xs text-slate-500 block text-center py-2">No users found.</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-300">Notification Content</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Write the notification details here. Users will see this instantly in their dashboard notifications feed."
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition resize-none"
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                  />
                </div>

                <div className="bg-[#07080c] border border-slate-800/80 p-4 rounded-xl space-y-4">
                  <span className="text-xs font-bold text-slate-400 block">Rich Media Attachment (Image)</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Image Web URL</label>
                      <input
                        type="url"
                        placeholder="e.g. https://example.com/banner.jpg"
                        className="w-full bg-[#11131e] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition"
                        value={notifImageUrl}
                        onChange={(e) => {
                          setNotifImageUrl(e.target.value);
                          if (e.target.value) setNotifImageFile(null);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Or Upload from computer</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 text-xs"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setNotifImageFile(e.target.files[0]);
                            setNotifImageUrl('');
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={broadcastLoading || (notifTargetType === 'user' && !notifTargetUserId)}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {broadcastLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Send Notification Now
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Notification History Panel */}
            <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="border-b border-slate-800/60 pb-4 mb-4">
                <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span>Notification History ({sentNotifications.length})</span>
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  View and verify all announcements and targeted direct alerts sent to date.
                </p>
              </div>

              {loadingSentNotifications ? (
                <div className="py-12 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  <span className="text-xs">Loading history logs...</span>
                </div>
              ) : sentNotifications.length === 0 ? (
                <div className="text-center py-12 bg-[#07080c] rounded-2xl border border-slate-800/40 text-slate-500 text-xs">
                  No notifications found in the database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3 pl-2">Sent Date</th>
                        <th className="pb-3">Title</th>
                        <th className="pb-3">Target Audience</th>
                        <th className="pb-3">Message Snippet</th>
                        <th className="pb-3 pr-2">Attachment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {sentNotifications.map((notif) => {
                        let audienceLabel = 'All Users';
                        if (notif.targetType === 'affiliate') audienceLabel = 'Affiliates Only';
                        if (notif.targetType === 'paid') audienceLabel = 'Paid Subscribers';
                        if (notif.targetType === 'free') audienceLabel = 'Free Users';
                        if (notif.targetType === 'user') {
                          const matchedUser = users.find(u => u.id === notif.targetUserId);
                          audienceLabel = matchedUser ? `User: ${matchedUser.fullName} (@${matchedUser.username})` : `User ID: ${notif.targetUserId}`;
                        }

                        return (
                          <tr key={notif.id} className="hover:bg-slate-900/10">
                            <td className="py-3 pl-2 text-slate-500 font-mono">
                              {new Date(notif.createdAt).toLocaleString()}
                            </td>
                            <td className="py-3 font-bold text-white">{notif.title}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${notif.targetType === 'user' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-slate-800 text-slate-400'}`}>
                                {audienceLabel}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 max-w-xs truncate" title={notif.message}>
                              {notif.message}
                            </td>
                            <td className="py-3 pr-2">
                              {notif.imageUrl ? (
                                <a 
                                  href={notif.imageUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-sky-400 hover:underline font-bold"
                                >
                                  View Media
                                </a>
                              ) : (
                                <span className="text-slate-600">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: SMTP & EMAIL VERIFICATION CONFIGURATION */}
        {activeTab === 'smtp_email' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveConfig} className="space-y-6">
              
              {/* Card 1: SMTP Server Configuration */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
                  <div>
                    <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-purple-400" />
                      <span>SMTP Mail Server Credentials</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Configure your custom SMTP host to deliver automated email verifications, welcome messages, and subscriber alerts.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-3 cursor-pointer bg-[#07080c] border border-slate-800 py-2 px-4 rounded-xl">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                      checked={smtpEnabled}
                      onChange={(e) => setSmtpEnabled(e.target.checked)}
                    />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {smtpEnabled ? 'SMTP Active' : 'SMTP Disabled'}
                    </span>
                  </label>
                </div>

                {smtpEnabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <label className="block text-xs font-bold text-slate-300">SMTP Server Host</label>
                        <input
                          type="text"
                          placeholder="e.g. mail.zerolord.com or smtp.gmail.com"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300">SMTP Port</label>
                        <input
                          type="number"
                          placeholder="587"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300">SMTP Username / Email</label>
                        <input
                          type="text"
                          placeholder="e.g. noreply@zerolord.com"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300">SMTP Password</label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpPass}
                          onChange={(e) => setSmtpPass(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300">Sender Display Name</label>
                        <input
                          type="text"
                          placeholder="e.g. CINJELLY Stream Support"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-300">Sender From Email Address</label>
                        <input
                          type="email"
                          placeholder="e.g. noreply@zerolord.com"
                          className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpFromEmail}
                          onChange={(e) => setSmtpFromEmail(e.target.value)}
                        />
                      </div>

                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer bg-[#07080c] border border-slate-800 p-2.5 rounded-xl w-full">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-purple-600 cursor-pointer"
                            checked={smtpSecure}
                            onChange={(e) => setSmtpSecure(e.target.checked)}
                          />
                          <span className="text-xs font-semibold text-slate-300">
                            Use SSL/TLS Security (Port 465)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* SMTP Live Connection Testing Tool */}
                    <div className="bg-[#07080c] border border-slate-800/80 p-4 rounded-xl space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-purple-400" />
                          <span>Test SMTP Server Connection</span>
                        </span>
                        <span className="text-[10px] text-slate-500">Delivers an immediate diagnostic test message</span>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="Enter target test email address (e.g. admin@example.com)"
                          className="flex-1 bg-[#11131e] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                          value={smtpTestEmail}
                          onChange={(e) => setSmtpTestEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={smtpTesting || !smtpTestEmail}
                          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shrink-0"
                        >
                          {smtpTesting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              Send Test Email
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Email Verification & Signup Toggles */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
                  <div>
                    <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Signup Email Verification Toggle & Template</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      When enabled, new users will automatically receive a verification email upon signup and must confirm it before access.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-3 cursor-pointer bg-[#07080c] border border-slate-800 py-2 px-4 rounded-xl">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                      checked={emailVerificationEnabled}
                      onChange={(e) => setEmailVerificationEnabled(e.target.checked)}
                    />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {emailVerificationEnabled ? 'Verification Enabled' : 'Verification Disabled'}
                    </span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">Verification Email Subject</label>
                    <input
                      type="text"
                      placeholder="Verify Your Email Address - CINJELLY Stream"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                      value={emailVerificationSubject}
                      onChange={(e) => setEmailVerificationSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#07080c] p-2.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Verification HTML Email Template</span>
                      </label>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="bg-[#11131e] p-1 rounded-lg border border-slate-800 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setVerifViewMode('edit')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${verifViewMode === 'edit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Code className="w-3 h-3" /> Code
                          </button>
                          <button
                            type="button"
                            onClick={() => setVerifViewMode('preview')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${verifViewMode === 'preview' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Eye className="w-3 h-3" /> Live Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setVerifViewMode('split')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${verifViewMode === 'split' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Layout className="w-3 h-3" /> Split View
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleResetVerifTemplate}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Reset to Factory Default"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" /> Reset
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendTestTemplate('verif')}
                          disabled={testingTemplate === 'verif' || !smtpTestEmail}
                          className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={smtpTestEmail ? `Send live test email to ${smtpTestEmail}` : 'Enter test recipient email in SMTP section above to send'}
                        >
                          {testingTemplate === 'verif' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          <span>Test Send</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEmailModal({
                            title: 'Signup Verification Email Live Preview',
                            subject: emailVerificationSubject || 'Verify Your Email Address',
                            html: renderSampleEmailHtml(emailVerificationTemplate)
                          })}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" /> Fullscreen
                        </button>
                      </div>
                    </div>

                    {/* Verification Email View Modes */}
                    {verifViewMode === 'edit' && (
                      <textarea
                        rows={12}
                        placeholder="Paste HTML or plain text email content here..."
                        className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-3 text-emerald-300 text-xs font-mono focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                        value={emailVerificationTemplate}
                        onChange={(e) => setEmailVerificationTemplate(e.target.value)}
                      />
                    )}

                    {verifViewMode === 'preview' && (
                      <div className="bg-white rounded-xl overflow-hidden border border-slate-700 shadow-inner p-2 min-h-[350px]">
                        <iframe
                          title="Verification Email Live Preview"
                          className="w-full h-[380px] border-0 rounded-lg"
                          srcDoc={renderSampleEmailHtml(emailVerificationTemplate)}
                        />
                      </div>
                    )}

                    {verifViewMode === 'split' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">HTML Code Editor (Edit Anytime)</span>
                          <textarea
                            rows={14}
                            placeholder="Paste HTML email content..."
                            className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-3 text-emerald-300 text-xs font-mono focus:outline-none focus:border-emerald-500 transition leading-relaxed"
                            value={emailVerificationTemplate}
                            onChange={(e) => setEmailVerificationTemplate(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                            <span>Live Rendered Email Preview</span>
                            <span className="text-emerald-400 font-normal">Real-time update</span>
                          </div>
                          <div className="bg-[#0b0d17] p-2 rounded-xl border border-slate-800 h-[280px] sm:h-[330px]">
                            <iframe
                              title="Verification Email Live Preview"
                              className="w-full h-full border-0 bg-white rounded-lg shadow-inner"
                              srcDoc={renderSampleEmailHtml(emailVerificationTemplate)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 3: Welcome & Payment Confirmation Email Settings */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                <div className="border-b border-slate-800/60 pb-5">
                  <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-400" />
                    <span>Welcome & Payment Approval Notification Email</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Automatically sent to subscribers whenever an admin approves their payment verification or activates their account.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-300">Welcome Email Subject</label>
                    <input
                      type="text"
                      placeholder="Welcome to CINJELLY Stream! Payment Confirmed"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-sky-500 transition"
                      value={welcomeEmailSubject}
                      onChange={(e) => setWelcomeEmailSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#07080c] p-2.5 rounded-xl border border-slate-800">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-sky-400" />
                        <span>Welcome HTML Email Template</span>
                      </label>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="bg-[#11131e] p-1 rounded-lg border border-slate-800 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setWelcomeViewMode('edit')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${welcomeViewMode === 'edit' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Code className="w-3 h-3" /> Code
                          </button>
                          <button
                            type="button"
                            onClick={() => setWelcomeViewMode('preview')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${welcomeViewMode === 'preview' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Eye className="w-3 h-3" /> Live Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setWelcomeViewMode('split')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${welcomeViewMode === 'split' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Layout className="w-3 h-3" /> Split View
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleResetWelcomeTemplate}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Reset to Factory Default"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-400" /> Reset
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendTestTemplate('welcome')}
                          disabled={testingTemplate === 'welcome' || !smtpTestEmail}
                          className="px-2.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={smtpTestEmail ? `Send live test email to ${smtpTestEmail}` : 'Enter test recipient email in SMTP section above to send'}
                        >
                          {testingTemplate === 'welcome' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          <span>Test Send</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setEmailModal({
                            title: 'Welcome & Payment Approval Email Live Preview',
                            subject: welcomeEmailSubject || 'Welcome to CINJELLY Stream!',
                            html: renderSampleEmailHtml(welcomeEmailTemplate)
                          })}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" /> Fullscreen
                        </button>
                      </div>
                    </div>

                    {/* Welcome Email View Modes */}
                    {welcomeViewMode === 'edit' && (
                      <textarea
                        rows={12}
                        placeholder="Paste Welcome HTML content here..."
                        className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-3 text-sky-300 text-xs font-mono focus:outline-none focus:border-sky-500 transition leading-relaxed"
                        value={welcomeEmailTemplate}
                        onChange={(e) => setWelcomeEmailTemplate(e.target.value)}
                      />
                    )}

                    {welcomeViewMode === 'preview' && (
                      <div className="bg-white rounded-xl overflow-hidden border border-slate-700 shadow-inner p-2 min-h-[350px]">
                        <iframe
                          title="Welcome Email Live Preview"
                          className="w-full h-[380px] border-0 rounded-lg"
                          srcDoc={renderSampleEmailHtml(welcomeEmailTemplate)}
                        />
                      </div>
                    )}

                    {welcomeViewMode === 'split' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">HTML Code Editor (Edit Anytime)</span>
                          <textarea
                            rows={14}
                            placeholder="Paste Welcome HTML content..."
                            className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-3 text-sky-300 text-xs font-mono focus:outline-none focus:border-sky-500 transition leading-relaxed"
                            value={welcomeEmailTemplate}
                            onChange={(e) => setWelcomeEmailTemplate(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                            <span>Live Rendered Email Preview</span>
                            <span className="text-sky-400 font-normal">Real-time update</span>
                          </div>
                          <div className="bg-[#0b0d17] p-2 rounded-xl border border-slate-800 h-[280px] sm:h-[330px]">
                            <iframe
                              title="Welcome Email Live Preview"
                              className="w-full h-full border-0 bg-white rounded-lg shadow-inner"
                              srcDoc={renderSampleEmailHtml(welcomeEmailTemplate)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Variables Reference Cheat Sheet */}
              <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 shadow-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>Dynamic Template Variables Cheat Sheet</span>
                </h4>
                <p className="text-slate-400 text-xs mb-4">
                  Insert these variable placeholders into your HTML email templates. They will automatically be populated with each recipient's actual details upon delivery:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-amber-400 font-bold block">{`{username}`}</span>
                    <span className="text-slate-500 text-[10px]">User's login username</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-amber-400 font-bold block">{`{fullName}`}</span>
                    <span className="text-slate-500 text-[10px]">User's full display name</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-amber-400 font-bold block">{`{email}`}</span>
                    <span className="text-slate-500 text-[10px]">User's email address</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-purple-400 font-bold block">{`{support_email}`}</span>
                    <span className="text-slate-500 text-[10px]">Support contact email</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-purple-400 font-bold block">{`{website_url}`}</span>
                    <span className="text-slate-500 text-[10px]">Portal/Server website URL</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-purple-400 font-bold block">{`{current_year}`}</span>
                    <span className="text-slate-500 text-[10px]">Current year (e.g. 2026)</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold block">{`{verification_code}`}</span>
                    <span className="text-slate-500 text-[10px]">6-digit OTP security code</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold block">{`{verification_link}`}</span>
                    <span className="text-slate-500 text-[10px]">Direct 1-click verification link</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-sky-400 font-bold block">{`{ios_app_link}`}</span>
                    <span className="text-slate-500 text-[10px]">iOS Apple Store app link</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-sky-400 font-bold block">{`{android_app_link}`}</span>
                    <span className="text-slate-500 text-[10px]">Android APK / Store app link</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-rose-400 font-bold block">{`{app_name}`}</span>
                    <span className="text-slate-500 text-[10px]">CINJELLY Stream</span>
                  </div>
                  <div className="bg-[#07080c] p-2.5 rounded-lg border border-slate-800">
                    <span className="text-rose-400 font-bold block">{`{login_url}`}</span>
                    <span className="text-slate-500 text-[10px]">Portal login portal URL</span>
                  </div>
                </div>
              </div>

              {/* Global Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-xl"
                >
                  {configSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving Settings...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save SMTP & Email Settings
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Media Server Connection card served at bottom of page */}
        {activeTab === 'subscriptions' && (
          <div className="bg-[#11131e] border border-slate-800/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl" id="server-config-card">
            <div>
              <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-rose-500" />
                <span>Media Server Connection Settings</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Directly adjust the connection parameters to your streaming server. Settings are stored securely in your active database.
              </p>
            </div>

            {configError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
                {configError}
              </div>
            )}

            {configSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
                {configSuccess}
              </div>
            )}

            {configLoading ? (
              <div className="py-8 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-500" />
                <span className="text-xs">Loading active configuration...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="serverUrl" className="block text-xs font-semibold text-slate-300">
                      Media Server URL
                    </label>
                    <input
                      type="url"
                      id="serverUrl"
                      required
                      placeholder="e.g. https://cinode.zerolord.com"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="jellyfinAdminUser" className="block text-xs font-semibold text-slate-300">
                      Server Admin Username
                    </label>
                    <input
                      type="text"
                      id="jellyfinAdminUser"
                      required
                      placeholder="e.g. admin"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                      value={jellyfinAdminUser}
                      onChange={(e) => setJellyfinAdminUser(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="jellyfinAdminPass" className="block text-xs font-semibold text-slate-300">
                      Server Admin Password (Optional)
                    </label>
                    <input
                      type="password"
                      id="jellyfinAdminPass"
                      placeholder="Enter password"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                      value={jellyfinAdminPass}
                      onChange={(e) => setJellyfinAdminPass(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="apiKey" className="block text-xs font-semibold text-slate-300">
                      Server API Key
                    </label>
                    <input
                      type="password"
                      id="apiKey"
                      required
                      placeholder="Paste your Server API Key"
                      className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={configSaving}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    {configSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" /> Save Connection Settings
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </main>

      {/* EDIT AFFILIATE PARTNER MODAL */}
      {editingAffiliateUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setEditingAffiliateUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full mb-3">
                <Percent className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-extrabold text-white">Configure Referral Settings</h3>
              <p className="text-slate-400 text-xs mt-1">
                Customize affiliate properties for <span className="text-rose-400 font-bold">{editingAffiliateUser.fullName}</span>.
              </p>
            </div>

            <form onSubmit={handleSaveAffiliate} className="space-y-4">
              
              {/* Toggle Affiliate Status */}
              <div className="flex items-center justify-between p-3 bg-[#07080c] rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-300">Is Active Affiliate?</span>
                <input 
                  type="checkbox"
                  className="w-4 h-4 accent-rose-600 cursor-pointer"
                  checked={editIsAffiliate}
                  onChange={(e) => {
                    setEditIsAffiliate(e.target.checked);
                    if (e.target.checked && !editAffiliateCode) {
                      // Generate a default code from full name if blank
                      const initials = editingAffiliateUser.username.substring(0, 4).toUpperCase();
                      const rand = Math.floor(100 + Math.random() * 900);
                      setEditAffiliateCode(`${initials}${rand}`);
                    }
                  }}
                />
              </div>

              {/* Customize Affiliate Code */}
              {editIsAffiliate && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Unique Affiliate Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. DUWI123" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs uppercase"
                    value={editAffiliateCode}
                    onChange={(e) => setEditAffiliateCode(e.target.value.toUpperCase())}
                  />
                  <span className="text-[9px] text-slate-500 block">This unique code will be tracked inside user signup referral links.</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={affSaving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-xs disabled:opacity-50"
              >
                {affSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm Settings'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUBSCRIBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full mb-3">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-extrabold text-white">Create New Subscriber</h3>
              <p className="text-slate-400 text-xs mt-1">
                Add a new user locally and configure their synced streaming account.
              </p>
            </div>

            {crudError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl mb-4">
                {crudError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Username</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. johndoe"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. john@example.com"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter password"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Subscription Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formSubscriptionStatus}
                    onChange={(e) => setFormSubscriptionStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Subscription Expiry Date</label>
                  <input 
                    type="date" 
                    required={formSubscriptionStatus === 'Active'}
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formSubscriptionExpiryDate}
                    onChange={(e) => setFormSubscriptionExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Payment Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Account Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formAccountStatus}
                    onChange={(e) => setFormAccountStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">System Role</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Referred By (Affiliate Code)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CODER123"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formReferredBy}
                    onChange={(e) => setFormReferredBy(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#07080c] rounded-xl border border-slate-800 self-end h-[38px]">
                  <span className="text-xs font-semibold text-slate-300">Is Active Affiliate?</span>
                  <input 
                    type="checkbox"
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                    checked={formIsAffiliate}
                    onChange={(e) => {
                      setFormIsAffiliate(e.target.checked);
                      if (e.target.checked && !formAffiliateCode) {
                        const initials = formUsername ? formUsername.substring(0, 4).toUpperCase() : 'AFF';
                        const rand = Math.floor(100 + Math.random() * 900);
                        setFormAffiliateCode(`${initials}${rand}`);
                      }
                    }}
                  />
                </div>
              </div>

              {formIsAffiliate && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Unique Affiliate Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. DUWI123" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs uppercase"
                    value={formAffiliateCode}
                    onChange={(e) => setFormAffiliateCode(e.target.value.toUpperCase())}
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={crudLoading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-xs disabled:opacity-50"
              >
                {crudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SUBSCRIBER MODAL */}
      {isEditModalOpen && targetUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => {
                setIsEditModalOpen(false);
                setTargetUser(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full mb-3">
                <Edit className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-extrabold text-white">Modify Subscriber Profile</h3>
              <p className="text-slate-400 text-xs mt-1">
                Update account details for <span className="text-rose-400 font-bold">{targetUser.fullName}</span>.
              </p>
            </div>

            {crudError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl mb-4">
                {crudError}
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Username</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. johndoe"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. john@example.com"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Password (Leave blank to keep current)</label>
                  <input 
                    type="password" 
                    placeholder="Enter new password"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Subscription Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formSubscriptionStatus}
                    onChange={(e) => setFormSubscriptionStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Subscription Expiry Date</label>
                  <input 
                    type="date" 
                    required={formSubscriptionStatus === 'Active'}
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formSubscriptionExpiryDate}
                    onChange={(e) => setFormSubscriptionExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Payment Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value as any)}
                  >
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Account Status</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formAccountStatus}
                    onChange={(e) => setFormAccountStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">System Role</label>
                  <select 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Referred By (Affiliate Code)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. CODER123"
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-rose-500 transition"
                    value={formReferredBy}
                    onChange={(e) => setFormReferredBy(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#07080c] rounded-xl border border-slate-800 self-end h-[38px]">
                  <span className="text-xs font-semibold text-slate-300">Is Active Affiliate?</span>
                  <input 
                    type="checkbox"
                    className="w-4 h-4 accent-rose-600 cursor-pointer"
                    checked={formIsAffiliate}
                    onChange={(e) => {
                      setFormIsAffiliate(e.target.checked);
                      if (e.target.checked && !formAffiliateCode) {
                        const initials = formUsername ? formUsername.substring(0, 4).toUpperCase() : 'AFF';
                        const rand = Math.floor(100 + Math.random() * 900);
                        setFormAffiliateCode(`${initials}${rand}`);
                      }
                    }}
                  />
                </div>
              </div>

              {formIsAffiliate && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Unique Affiliate Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. DUWI123" 
                    className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-2 px-3 text-white text-xs uppercase"
                    value={formAffiliateCode}
                    onChange={(e) => setFormAffiliateCode(e.target.value.toUpperCase())}
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={crudLoading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-[#090a0f] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-xs disabled:opacity-50"
              >
                {crudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Modifications'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BIRDS-EYE VIEW & USER MANAGEMENT MODAL */}
      {selectedUserForView && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-indigo-500"></div>
            
            <button 
              onClick={() => setSelectedUserForView(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="flex items-center gap-4 mb-6 border-b border-slate-800/60 pb-5">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-lg">
                {selectedUserForView.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-display font-extrabold text-white">{selectedUserForView.fullName}</h3>
                <p className="text-slate-400 text-xs">@{selectedUserForView.username} • {selectedUserForView.email}</p>
              </div>
            </div>

            {/* Birds-eye View Grid */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account Summary & Birds-eye View</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#07080c] border border-slate-800/60 p-3 rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Role</span>
                  <span className={`inline-block text-[11px] font-bold mt-1 px-2 py-0.5 rounded ${selectedUserForView.role === 'admin' ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                    {selectedUserForView.role.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#07080c] border border-slate-800/60 p-3 rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Plan Access Status</span>
                  <span className={`inline-block text-[11px] font-bold mt-1 px-2 py-0.5 rounded ${selectedUserForView.subscriptionStatus === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : selectedUserForView.subscriptionStatus === 'Disabled' ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {selectedUserForView.subscriptionStatus.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#07080c] border border-slate-800/60 p-3 rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Payment Status</span>
                  <span className={`inline-block text-[11px] font-bold mt-1 px-2 py-0.5 rounded ${selectedUserForView.paymentStatus === 'Paid' ? 'bg-emerald-500/15 text-emerald-400' : selectedUserForView.paymentStatus === 'Pending Verification' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-rose-500/15 text-rose-400'}`}>
                    {selectedUserForView.paymentStatus.toUpperCase()}
                  </span>
                </div>

                <div className="bg-[#07080c] border border-slate-800/60 p-3 rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Account State</span>
                  <span className={`inline-block text-[11px] font-bold mt-1 px-2 py-0.5 rounded ${selectedUserForView.accountStatus === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                    {selectedUserForView.accountStatus ? selectedUserForView.accountStatus.toUpperCase() : 'DISABLED'}
                  </span>
                </div>
              </div>

              {/* Extended Details */}
              <div className="bg-[#07080c] border border-slate-800/60 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-500">Synced Server ID:</span>
                  <span className="font-mono text-slate-300 truncate max-w-[200px]" title={selectedUserForView.jellyfinUserId || 'None'}>
                    {selectedUserForView.jellyfinUserId || 'Not Synced'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-500">Affiliate Status:</span>
                  <span className="text-slate-300">
                    {selectedUserForView.isAffiliate ? (
                      <span className="text-emerald-400 font-bold">Yes (Code: {selectedUserForView.affiliateCode})</span>
                    ) : 'No'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-500">Signed Up Date & Day:</span>
                  <span className="text-slate-200 font-medium flex items-center gap-1.5 text-right">
                    {formatSignupDateAndDay(selectedUserForView.registrationDate)}
                    {isNewUser(selectedUserForView.registrationDate) && (
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-extrabold px-1.5 py-0.5 rounded font-mono">
                        (NEW)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-500">Referred By Code:</span>
                  <span className="text-slate-300 font-bold">{selectedUserForView.referredBy || 'None (Direct)'}</span>
                </div>

                <div className="flex justify-between items-center border-b border-slate-800/40 pb-2">
                  <span className="text-slate-500">Subscription Started:</span>
                  <span className="text-slate-300 font-mono">
                    {selectedUserForView.subscriptionStartDate ? new Date(selectedUserForView.subscriptionStartDate).toLocaleDateString() + ' ' + new Date(selectedUserForView.subscriptionStartDate).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Subscription Expiry:</span>
                  <span className="text-slate-300 font-mono font-bold">
                    {selectedUserForView.subscriptionExpiryDate ? new Date(selectedUserForView.subscriptionExpiryDate).toLocaleDateString() + ' ' + new Date(selectedUserForView.subscriptionExpiryDate).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="pt-4 border-t border-slate-800/60">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Instant Subscription Operations</span>
                
                <div className="flex flex-wrap gap-2">
                  {selectedUserForView.role !== 'admin' && (
                    <>
                      {selectedUserForView.subscriptionStatus !== 'Active' ? (
                        <button
                          onClick={() => {
                            handleUserAction(selectedUserForView.id, 'activate');
                            setSelectedUserForView(prev => prev ? { ...prev, subscriptionStatus: 'Active', paymentStatus: 'Paid', accountStatus: 'Active' } : null);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Activate Plan
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              handleUserAction(selectedUserForView.id, 'extend');
                              const exp = selectedUserForView.subscriptionExpiryDate ? new Date(selectedUserForView.subscriptionExpiryDate) : new Date();
                              exp.setDate(exp.getDate() + 30);
                              setSelectedUserForView(prev => prev ? { ...prev, subscriptionExpiryDate: exp.toISOString() } : null);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-rose-500" /> Renew 30 Days
                          </button>
                          <button
                            onClick={() => {
                              handleUserAction(selectedUserForView.id, 'disable');
                              setSelectedUserForView(prev => prev ? { ...prev, subscriptionStatus: 'Disabled', accountStatus: 'Disabled' } : null);
                            }}
                            className="bg-rose-950/40 hover:bg-rose-950/60 border border-rose-900/30 text-rose-400 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <Ban className="w-3.5 h-3.5" /> Lock Access
                          </button>
                        </>
                      )}
                      
                      {selectedUserForView.subscriptionStatus === 'Disabled' && (
                        <button
                          onClick={() => {
                            handleUserAction(selectedUserForView.id, 'reactivate');
                            setSelectedUserForView(prev => prev ? { ...prev, subscriptionStatus: 'Active', accountStatus: 'Active' } : null);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
                        >
                          Unlock Access
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => {
                      const user = selectedUserForView;
                      setSelectedUserForView(null);
                      openEditModal(user);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Profile Details
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedUserForView(null)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUBSCRIBER CONFIRMATION MODAL */}
      {isDeleteModalOpen && targetUser && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#11131e] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => {
                setIsDeleteModalOpen(false);
                setTargetUser(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-extrabold text-white">Delete Subscriber</h3>
              <p className="text-slate-400 text-xs mt-2">
                Are you absolutely sure you want to delete <span className="text-rose-400 font-bold">{targetUser.fullName}</span> (@{targetUser.username})?
              </p>
              <p className="text-slate-500 text-[10px] mt-2">
                This action is irreversible. The account will be deleted locally from the database AND removed from your streaming server.
              </p>
            </div>

            {crudError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl mb-4">
                {crudError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTargetUser(null);
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={crudLoading}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {crudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Payment Modal */}
      {declineTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11131e] border border-slate-800 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => {
                setDeclineTargetUser(null);
                setDeclineReasonText('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer font-bold text-lg"
            >
              ×
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full mb-3">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-display font-extrabold text-white">Decline Payment Request</h3>
              <p className="text-slate-400 text-xs mt-2">
                Specify why you are declining the payment request from <strong className="text-white">{declineTargetUser.fullName}</strong>. This reason will be visible to the user on their dashboard.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Decline Reason <span className="text-slate-600">(Optional)</span>
                </label>
                <textarea
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  placeholder="e.g., Image uploaded is blurry, session ID is invalid, or payment was not received."
                  rows={3}
                  className="w-full bg-[#07080c] border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs transition"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeclineTargetUser(null);
                  setDeclineReasonText('');
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifyPayment(declineTargetUser.id, 'decline', declineReasonText)}
                disabled={verificationLoadingUserId !== null}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                {verificationLoadingUserId === declineTargetUser.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Decline Payment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Modal */}
      {fullScreenReceiptUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setFullScreenReceiptUrl(null)}
        >
          <div className="max-w-4xl max-h-[90vh] w-full h-full flex flex-col justify-center items-center relative">
            <button
              onClick={() => setFullScreenReceiptUrl(null)}
              className="absolute top-0 right-0 bg-slate-900 hover:bg-slate-800 text-white font-black text-xl p-2.5 rounded-full border border-slate-800/80 z-10"
            >
              ×
            </button>
            <img 
              src={fullScreenReceiptUrl} 
              alt="Fullscreen Receipt Screenshot" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800"
              onClick={(e) => e.stopPropagation()} 
            />
            <p className="text-xs text-slate-400 mt-3 font-medium bg-slate-950/80 py-1.5 px-4 rounded-full border border-slate-800">
              Click anywhere outside the image to close.
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Email Live Preview Modal */}
      {emailModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setEmailModal(null)}
        >
          <div 
            className="w-full max-w-5xl bg-[#11131e] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800/80 bg-[#07080c]">
              <div>
                <h3 className="text-sm font-display font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>{emailModal.title}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Subject: <span className="text-slate-200 font-semibold">{emailModal.subject}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Device Selector */}
                <div className="bg-[#11131e] p-1 rounded-lg border border-slate-800 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setModalDevice('desktop')}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${modalDevice === 'desktop' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalDevice('mobile')}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${modalDevice === 'mobile' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Mobile View (375px)
                  </button>
                </div>

                <button
                  onClick={() => setEmailModal(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-[#07080c] p-6 flex justify-center items-center overflow-auto">
              <div 
                className="w-full h-full transition-all duration-300 mx-auto shadow-2xl rounded-xl overflow-hidden bg-white"
                style={{ maxWidth: modalDevice === 'mobile' ? '390px' : '100%' }}
              >
                <iframe
                  title="Fullscreen Email Live Preview"
                  className="w-full h-full border-0"
                  srcDoc={emailModal.html}
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
