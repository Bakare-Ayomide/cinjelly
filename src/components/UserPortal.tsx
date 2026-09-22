import React, { useState, useEffect } from 'react';
import { 
  Tv, LogOut, CheckCircle, AlertTriangle, Play, ShieldAlert, CreditCard, 
  Loader2, RefreshCw, Key, HelpCircle, ArrowLeft, ExternalLink, X, Info, UserCheck, Calendar,
  Users, DollarSign, Gift, Clock, Share2, Copy, Check, Percent, MessageSquare, PlusCircle, Bell,
  Smartphone, Download, Building2, Landmark, ShieldCheck, Menu, Film, Compass, ChevronRight, Settings, Sparkles,
  Wallet, Banknote, ArrowUpRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { User, SquadMandate, AffiliateWithdrawal } from '../types';
import { apiFetch } from '../lib/api';

const NIGERIAN_BANKS = [
  'Access Bank',
  'Access Bank (Diamond)',
  'ALAT by WEMA',
  'Bowen Microfinance Bank',
  'Carbon',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'FairMoney Microfinance Bank',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Globus Bank',
  'Guaranty Trust Bank (GTBank)',
  'Heritage Bank',
  'Jaiz Bank',
  'Keystone Bank',
  'Kuda Microfinance Bank',
  'Lotus Bank',
  'Moniepoint Microfinance Bank',
  'OPay (PayCom)',
  'Optimus Bank',
  'Palmpay',
  'Parallex Bank',
  'Polaris Bank',
  'PremiumTrust Bank',
  'Providus Bank',
  'Rubies Bank',
  'Safe Haven Microfinance Bank',
  'Signature Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'SunTrust Bank',
  'TAJ Bank',
  'Titan Trust Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'VFD Microfinance Bank',
  'Wema Bank',
  'Zenith Bank',
  'Other Bank (Type Custom Name)'
];

interface UserPortalProps {
  user: User;
  jellyfinToken: string;
  onLogout: () => void;
  onReloadUser: () => void;
  setJellyfinToken: (token: string) => void;
  systemStatus?: any;
}

export default function UserPortal({ user, jellyfinToken, onLogout, onReloadUser, setJellyfinToken, systemStatus }: UserPortalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Affiliate stats state
  // Native Mobile App Screen Tab Navigation State
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription' | 'direct_debit' | 'requests' | 'affiliate' | 'apps' | 'support' | 'account'>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [affiliateStats, setAffiliateStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joiningAffiliate, setJoiningAffiliate] = useState(false);

  // Affiliate Manual Withdrawal State
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawBankName, setWithdrawBankName] = useState('Guaranty Trust Bank (GTBank)');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawCustomBank, setWithdrawCustomBank] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Credentials sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // Bank Info & manual payment state
  const [bankInfo, setBankInfo] = useState<any>(null);
  const [showManualPay, setShowManualPay] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Monnify Form Modal state
  const [showMonnifyModal, setShowMonnifyModal] = useState(false);
  const [monnifyFullName, setMonnifyFullName] = useState('');
  const [monnifyEmail, setMonnifyEmail] = useState('');
  const [monnifyPhone, setMonnifyPhone] = useState('');

  // Squad Direct Debit State
  const [showDirectDebitModal, setShowDirectDebitModal] = useState(false);
  const [directDebitBanks, setDirectDebitBanks] = useState<{ code: string; name: string }[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [directDebitAccountNo, setDirectDebitAccountNo] = useState('');
  const [directDebitAccountName, setDirectDebitAccountName] = useState('');
  const [directDebitMandateId, setDirectDebitMandateId] = useState<string | null>(null);
  const [directDebitOtp, setDirectDebitOtp] = useState('');
  const [directDebitStep, setDirectDebitStep] = useState<'input' | 'otp' | 'success'>('input');
  const [directDebitLoading, setDirectDebitLoading] = useState(false);
  const [directDebitError, setDirectDebitError] = useState<string | null>(null);
  const [directDebitSuccess, setDirectDebitSuccess] = useState<string | null>(null);
  const [userMandate, setUserMandate] = useState<SquadMandate | null>(null);
  const [loadingUserMandate, setLoadingUserMandate] = useState(false);
  const [cancellingMandate, setCancellingMandate] = useState(false);
  const [renewingMandate, setRenewingMandate] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);

  // Notification states
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationType, setNotificationType] = useState<'accepted' | 'declined' | null>(null);
  const [notificationDeclineReason, setNotificationDeclineReason] = useState<string>('');
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Device selection modal state
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  // Email verification state
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleResendEmailVerification = async () => {
    setResendingEmail(true);
    setEmailMsg(null);
    try {
      const res = await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email || user.username })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend verification email');
      setEmailMsg({ text: 'Verification email sent! Please check your inbox and spam folder.', type: 'success' });
    } catch (err: any) {
      setEmailMsg({ text: err.message || 'Could not resend email.', type: 'error' });
    } finally {
      setResendingEmail(false);
    }
  };

  // Broadcast & media request states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showHeaderNotifs, setShowHeaderNotifs] = useState(false);
  const [selectedModalNotif, setSelectedModalNotif] = useState<any | null>(null);

  // Load read notification IDs from localStorage & check for payment redirect query params
  useEffect(() => {
    if (user && user.id) {
      try {
        const stored = localStorage.getItem(`read_notifications_${user.id}`);
        if (stored) {
          setReadNotifIds(JSON.parse(stored));
        } else {
          setReadNotifIds([]);
        }
      } catch (e) {
        console.error('Error loading read notifications', e);
      }
    }

    // Check payment redirect query params
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const ref = params.get('ref');
    if (payment === 'success') {
      setSuccess(`Payment Verified Successfully! Your subscription is active${ref ? ` (Ref: ${ref})` : ''}.`);
      if (onReloadUser) onReloadUser();
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (payment === 'failed') {
      setError('Paystack payment verification failed or payment was cancelled. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (payment === 'missing_reference') {
      setError('Transaction reference missing from payment gateway callback.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (payment === 'config_error') {
      setError('Paystack integration key is not configured on the server. Please contact support.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }

    // Fetch user's direct debit mandate
    fetchUserMandate();
  }, [user]);

  const fetchUserMandate = async () => {
    if (!user || !user.id) return;
    setLoadingUserMandate(true);
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/mandate');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.mandate) {
          setUserMandate(data.mandate);
        } else {
          setUserMandate(null);
        }
      }
    } catch (e) {
      console.warn('Error loading direct debit mandate:', e);
    } finally {
      setLoadingUserMandate(false);
    }
  };

  const fetchDirectDebitBanks = async () => {
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/banks');
      if (res.ok) {
        const data = await res.json();
        if (data.banks && Array.isArray(data.banks)) {
          setDirectDebitBanks(data.banks);
          if (data.banks.length > 0 && !selectedBankCode) {
            setSelectedBankCode(data.banks[0].code);
          }
        }
      }
    } catch (e) {
      console.warn('Error loading Nigerian banks:', e);
    }
  };

  const handleOpenDirectDebitModal = async () => {
    setDirectDebitError(null);
    setDirectDebitSuccess(null);
    setDirectDebitOtp('');
    setDirectDebitStep('input');
    setShowDirectDebitModal(true);
    if (directDebitBanks.length === 0) {
      await fetchDirectDebitBanks();
    }
  };

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectDebitLoading(true);
    setDirectDebitError(null);
    setDirectDebitSuccess(null);

    if (!selectedBankCode) {
      setDirectDebitError('Please select your bank.');
      setDirectDebitLoading(false);
      return;
    }

    if (!directDebitAccountNo || directDebitAccountNo.trim().length < 10) {
      setDirectDebitError('Please enter a valid 10-digit NUBAN account number.');
      setDirectDebitLoading(false);
      return;
    }

    const selectedBank = directDebitBanks.find(b => b.code === selectedBankCode);

    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/create-mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: directDebitAccountNo.trim(),
          bankCode: selectedBankCode,
          bankName: selectedBank?.name || '',
          accountName: directDebitAccountName || user.fullName || user.username,
          username: user.username,
          email: user.email,
          userId: user.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDirectDebitError(data.error || 'Failed to initiate Direct Debit authorization.');
        setDirectDebitLoading(false);
        return;
      }

      setDirectDebitMandateId(data.mandateId);
      setDirectDebitSuccess(data.message || 'Mandate initiated. Please enter the OTP sent by your bank.');
      setDirectDebitStep('otp');
    } catch (err: any) {
      setDirectDebitError(err.message || 'Error connecting to Direct Debit service.');
    } finally {
      setDirectDebitLoading(false);
    }
  };

  const handleValidateMandateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directDebitMandateId) {
      setDirectDebitError('Mandate reference missing. Please try again.');
      return;
    }

    if (!directDebitOtp || directDebitOtp.trim().length < 4) {
      setDirectDebitError('Please enter the OTP code sent to your phone/email.');
      return;
    }

    setDirectDebitLoading(true);
    setDirectDebitError(null);
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/validate-mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandateId: directDebitMandateId,
          otp: directDebitOtp.trim(),
          userId: user.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setDirectDebitError(data.error || 'Failed to validate OTP.');
        setDirectDebitLoading(false);
        return;
      }

      setDirectDebitSuccess('Automated monthly Direct Debit mandate activated successfully! Your streaming access is enabled.');
      setDirectDebitStep('success');
      await fetchUserMandate();
      if (onReloadUser) {
        await onReloadUser();
      }
    } catch (err: any) {
      setDirectDebitError(err.message || 'Error validating OTP with bank.');
    } finally {
      setDirectDebitLoading(false);
    }
  };

  const handleResendMandateOtp = async () => {
    if (!directDebitMandateId) return;
    setResendingOtp(true);
    setDirectDebitError(null);
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandateId: directDebitMandateId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDirectDebitSuccess('A new OTP has been dispatched by your bank.');
      } else {
        setDirectDebitError(data.error || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      setDirectDebitError('Error requesting OTP resend.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleCancelUserMandate = async () => {
    if (!userMandate) return;
    const confirmCancel = window.confirm('Are you sure you want to cancel automated monthly Direct Debit renewal? You will need to renew manually when your subscription expires.');
    if (!confirmCancel) return;

    setCancellingMandate(true);
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/cancel-mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandateId: userMandate.mandateId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Automated Direct Debit mandate has been cancelled successfully.');
        await fetchUserMandate();
      } else {
        setError(data.error || 'Failed to cancel mandate.');
      }
    } catch (err: any) {
      setError('Error communicating with direct debit service.');
    } finally {
      setCancellingMandate(false);
    }
  };

  const handleTriggerManualRenewalDebit = async () => {
    if (!userMandate) return;
    setRenewingMandate(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/payment/squad-direct-debit/debit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Direct Debit processed successfully! Your subscription has been extended by 30 days.');
        await fetchUserMandate();
        if (onReloadUser) {
          await onReloadUser();
        }
      } else {
        setError(data.error || 'Failed to process Direct Debit renewal.');
      }
    } catch (err: any) {
      setError('Network error processing renewal.');
    } finally {
      setRenewingMandate(false);
    }
  };

  const handleOpenNotification = (notif: any) => {
    setSelectedModalNotif(notif);
    if (user && user.id && !readNotifIds.includes(notif.id)) {
      const updated = [...readNotifIds, notif.id];
      setReadNotifIds(updated);
      try {
        localStorage.setItem(`read_notifications_${user.id}`, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving read notification ID', e);
      }
    }
  };

  const unreadCount = notifications.filter(n => !readNotifIds.includes(n.id)).length;
  
  const [requestTitle, setRequestTitle] = useState('');
  const [requestType, setRequestType] = useState<'movie' | 'show'>('movie');
  const [requestYear, setRequestYear] = useState('');
  const [requestSeason, setRequestSeason] = useState('');
  const [requestEpisode, setRequestEpisode] = useState('');
  const [requestIsFullSeason, setRequestIsFullSeason] = useState(true);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [loadingUserRequests, setLoadingUserRequests] = useState(false);

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const res = await apiFetch('/api/notifications/broadcast');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const fetchUserRequests = async () => {
    setLoadingUserRequests(true);
    try {
      const res = await apiFetch('/api/media/requests');
      if (res.ok) {
        const data = await res.json();
        setUserRequests(data);
      }
    } catch (e) {
      console.error('Error loading user requests:', e);
    } finally {
      setLoadingUserRequests(false);
    }
  };

  const handleMediaRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRequest(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        type: requestType,
        title: requestTitle,
        releaseYear: requestType === 'movie' ? requestYear : null,
        season: requestType === 'show' ? requestSeason : null,
        episode: (requestType === 'show' && !requestIsFullSeason) ? requestEpisode : null
      };
      const res = await apiFetch('/api/media/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }
      setSuccess(`Media request for "${requestTitle}" submitted successfully!`);
      setShowRequestModal(false);
      setRequestTitle('');
      setRequestYear('');
      setRequestSeason('');
      setRequestEpisode('');
      fetchUserRequests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, JPEG, etc.)');
      return;
    }
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const [monnifyLoading, setMonnifyLoading] = useState(false);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [squadLoading, setSquadLoading] = useState(false);

  const loadSquadScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window.squad || window.Squad)) {
        return resolve();
      }
      const existingScript = document.getElementById('squad-sdk-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Squad Payment SDK')));
        // In case it already loaded
        if ((window as any).squad || (window as any).Squad) {
          return resolve();
        }
        return;
      }
      const script = document.createElement('script');
      script.id = 'squad-sdk-script';
      script.src = 'https://checkout.squadco.com/widget/squad.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Squad Payment SDK from checkout.squadco.com'));
      document.body.appendChild(script);
    });
  };

  const verifySquadPayment = async (reference: string) => {
    try {
      setSquadLoading(true);
      setError('');
      const res = await apiFetch('/api/payment/squad-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionReference: reference })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Your subscription has been successfully renewed and activated with Squad!');
        setError('');
        if (onReloadUser) {
          await onReloadUser();
        }
      } else {
        setError(data.error || 'Squad payment verification was not confirmed. Please contact support if debited.');
      }
    } catch (err: any) {
      setError('Failed to verify payment with server. If your account was debited, your subscription will activate shortly via automated webhook.');
    } finally {
      setSquadLoading(false);
    }
  };

  const handlePayWithSquad = async () => {
    try {
      setSquadLoading(true);
      setError('');

      // 1. Ensure Squad SDK script is loaded
      try {
        await loadSquadScript();
      } catch (scriptErr: any) {
        console.warn('Squad SDK load warning:', scriptErr);
      }

      // 2. Initiate payment session on backend (never expose secret key)
      const res = await apiFetch('/api/payment/squad-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          userId: user.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to initialize Squad payment session.');
        setSquadLoading(false);
        return;
      }

      const squadConstructor = (window as any).squad || (window as any).Squad;
      
      if (!squadConstructor) {
        // Fallback to checkout URL if modal widget is somehow blocked by browser extensions
        if (data.checkout_url || data.checkoutUrl) {
          window.location.href = data.checkout_url || data.checkoutUrl;
          return;
        }
        setError('Squad payment widget is currently unavailable. Please refresh or try another payment method.');
        setSquadLoading(false);
        return;
      }

      const amountKobo = Math.round(Number(data.amount || 600) * 100);
      const transactionRef = data.transactionReference || data.transactionRef;

      // 3. Launch official Squad Payment Modal
      const squadInstance = new squadConstructor({
        key: data.publicKey,
        email: data.customerEmail || user.email || `${user.username}@cinjelly.com`,
        amount: amountKobo,
        currency_code: data.currency || 'NGN',
        transaction_ref: transactionRef,
        customer_name: data.customerName || user.fullName || user.username,
        callback_url: data.callbackUrl || `${window.location.origin}/api/payment/squad-callback`,
        payment_channels: ['card', 'bank', 'ussd', 'transfer'],
        metadata: {
          user_id: user.id,
          username: user.username,
          email: user.email,
          gateway: 'squad'
        },
        onLoad: () => {
          console.log('[SQUAD] Payment modal loaded');
        },
        onClose: () => {
          console.log('[SQUAD] Payment modal closed');
          setSquadLoading(false);
        },
        onSuccess: async (response: any) => {
          console.log('[SQUAD] Modal success received:', response);
          // Never trust frontend alone: verify securely with server
          await verifySquadPayment(transactionRef);
        }
      });

      if (typeof squadInstance.setup === 'function') {
        squadInstance.setup();
      }
      if (typeof squadInstance.open === 'function') {
        squadInstance.open();
      } else if (typeof squadInstance === 'function') {
        squadInstance();
      }
    } catch (err: any) {
      console.error('[SQUAD] Error initiating payment:', err);
      setError('Error initiating Squad payment. Please try again.');
      setSquadLoading(false);
    }
  };

  const loadPaystackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && ((window as any).PaystackPop || (window as any).Paystack)) {
        return resolve();
      }
      const existingScript = document.getElementById('paystack-sdk-script') as HTMLScriptElement | null;
      if (existingScript) {
        if ((window as any).PaystackPop || (window as any).Paystack) {
          return resolve();
        }
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Paystack InlineJS SDK')));
        setTimeout(() => {
          if ((window as any).PaystackPop || (window as any).Paystack) {
            resolve();
          }
        }, 150);
        return;
      }
      const script = document.createElement('script');
      script.id = 'paystack-sdk-script';
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paystack InlineJS SDK from js.paystack.co'));
      document.body.appendChild(script);
    });
  };

  const verifyPaystackPayment = async (reference: string) => {
    try {
      setPaystackLoading(true);
      setError('');
      // 1. Primary dedicated endpoint for InlineJS verification
      const res = await apiFetch('/api/payment/paystack-inlinejs-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, userId: user.id, username: user.username })
      });
      const data = await res.json();
      if (res.ok && (data.success || data.status === 'success')) {
        setSuccess('Your subscription has been successfully activated with Paystack!');
        setError('');
        if (onReloadUser) {
          await onReloadUser();
        }
        return;
      }

      // 2. Secondary fallback verification endpoint
      const fallbackRes = await apiFetch('/api/payment/paystack-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, userId: user.id, username: user.username })
      });
      const fallbackData = await fallbackRes.json();
      if (fallbackRes.ok && (fallbackData.success || fallbackData.status === 'success')) {
        setSuccess('Your subscription has been successfully activated with Paystack!');
        setError('');
        if (onReloadUser) {
          await onReloadUser();
        }
      } else {
        setError(data.error || fallbackData.error || 'Paystack payment verification was not confirmed. Please contact support if debited.');
      }
    } catch (err: any) {
      setError('Payment completed! If your streaming subscription does not activate automatically in 30 seconds, please refresh or contact support.');
    } finally {
      setPaystackLoading(false);
    }
  };

  const handlePayWithPaystack = async () => {
    try {
      setPaystackLoading(true);
      setError('');

      // 1. Ensure Paystack InlineJS SDK script is loaded (V2: https://js.paystack.co/v2/inline.js)
      try {
        await loadPaystackScript();
      } catch (scriptErr: any) {
        console.warn('Paystack SDK script load warning:', scriptErr);
      }

      // 2. Initiate payment session on backend (never expose secret key)
      const res = await apiFetch('/api/payment/paystack-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          userId: user.id
        })
      });

      const data = await res.json();
      const pubKey = data?.publicKey || bankInfo?.paystackPublicKey;

      if (!pubKey) {
        setError('Paystack Public Key is not configured on the server. Please contact administrator.');
        setPaystackLoading(false);
        return;
      }

      const transactionRef = data?.reference || `PS_${user.username.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const amountKobo = Math.round(Number(bankInfo?.subscriptionAmount || 600) * 100);
      const userEmail = user.email || `${user.username}@cinjelly.com`;
      const nameParts = (user.fullName || '').trim().split(' ');
      const firstName = nameParts[0] || user.username;
      const lastName = nameParts.slice(1).join(' ') || '';

      const PaystackConstructor = (window as any).PaystackPop || (window as any).Paystack;

      if (!PaystackConstructor) {
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
          return;
        }
        setError('Paystack InlineJS popup is currently unavailable. Please check your browser connection.');
        setPaystackLoading(false);
        return;
      }

      // 3. Launch official Paystack InlineJS V2 modal
      const paystack = new PaystackConstructor();

      const transactionOptions = {
        key: pubKey,
        email: userEmail,
        amount: amountKobo,
        currency: 'NGN',
        firstName: firstName,
        lastName: lastName,
        reference: transactionRef,
        accessCode: data?.access_code || undefined,
        metadata: {
          cinjelly_user_id: user.id,
          username: user.username,
          payment_gateway: 'paystack_inlinejs',
          payment_purpose: 'subscription',
          custom_fields: [
            { display_name: 'Username', variable_name: 'username', value: user.username },
            { display_name: 'User ID', variable_name: 'user_id', value: user.id }
          ]
        },
        onLoad: (response: any) => {
          console.log('[Paystack InlineJS] Modal loaded:', response);
        },
        onSuccess: async (transaction: any) => {
          console.log('[Paystack InlineJS] Modal success callback received:', transaction);
          const confirmedRef = transaction?.reference || transaction?.trxref || transactionRef;
          await verifyPaystackPayment(confirmedRef);
        },
        onCancel: () => {
          console.log('[Paystack InlineJS] Payment modal closed by user');
          setPaystackLoading(false);
        },
        onError: (error: any) => {
          console.error('[Paystack InlineJS] Payment error:', error);
          setError(error?.message || 'Error occurred during Paystack checkout.');
          setPaystackLoading(false);
        }
      };

      // V2 newTransaction synchronous initiation
      if (typeof paystack.newTransaction === 'function') {
        paystack.newTransaction(transactionOptions);
        return;
      }

      // V2 checkout asynchronous initiation
      if (typeof paystack.checkout === 'function') {
        paystack.checkout(transactionOptions);
        return;
      }

      // V2 resumeTransaction with accessCode
      if (typeof paystack.resumeTransaction === 'function' && data?.access_code) {
        paystack.resumeTransaction(data.access_code, {
          onSuccess: async (transaction: any) => {
            const confirmedRef = transaction?.reference || transaction?.trxref || transactionRef;
            await verifyPaystackPayment(confirmedRef);
          },
          onCancel: () => {
            setPaystackLoading(false);
          }
        });
        return;
      }

      // Legacy fallback if available
      if (typeof PaystackConstructor.setup === 'function') {
        const handler = PaystackConstructor.setup({
          ...transactionOptions,
          callback: async (response: any) => {
            const confirmedRef = response?.reference || response?.trxref || transactionRef;
            await verifyPaystackPayment(confirmedRef);
          },
          onClose: () => {
            setPaystackLoading(false);
          }
        });
        if (handler && typeof handler.openIframe === 'function') {
          handler.openIframe();
          return;
        }
      }

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }

      setError('Unable to launch Paystack checkout. Please try again.');
    } catch (err: any) {
      console.error('[Paystack] Error initiating payment:', err);
      setError('Error initiating Paystack payment. Please try again.');
    } finally {
      setPaystackLoading(false);
    }
  };

  const loadMonnifyScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const getSDK = () => (window as any).MonnifySDK || (window as any).Monnify || (window as any).monnify;
      const currentSdk = getSDK();
      if (typeof window !== 'undefined' && currentSdk && typeof currentSdk.initialize === 'function') {
        resolve();
        return;
      }
      const existingScript = document.getElementById('monnify-sdk-script') as HTMLScriptElement | null;
      if (existingScript) {
        let checks = 0;
        const interval = setInterval(() => {
          checks++;
          const sdk = getSDK();
          if (sdk && typeof sdk.initialize === 'function') {
            clearInterval(interval);
            resolve();
          } else if (checks > 30) {
            clearInterval(interval);
            console.warn("[Monnify] Timeout waiting for existing script element. Injecting dynamic backup script.");
            const backupScript = document.createElement('script');
            backupScript.src = 'https://sdk.monnify.com/plugin/monnify.js?v=' + Date.now();
            backupScript.async = true;
            backupScript.onload = () => {
              const recheck = getSDK();
              if (recheck && typeof recheck.initialize === 'function') {
                resolve();
              } else {
                reject(new Error('Monnify SDK loaded but initialize function is missing on window.MonnifySDK'));
              }
            };
            backupScript.onerror = () => reject(new Error('Failed to load Monnify Checkout plugin'));
            document.body.appendChild(backupScript);
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.id = 'monnify-sdk-script';
      script.src = 'https://sdk.monnify.com/plugin/monnify.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Monnify Checkout plugin'));
      document.body.appendChild(script);
    });
  };

  const handlePayWithMonnify = () => {
    if (!bankInfo || bankInfo.monnifyEnabled === false || bankInfo.monnifyEnabled === 0) {
      setError('Monnify payment feature is currently turned off by admin. Please use the manual bank transfer option.');
      return;
    }

    if (!bankInfo.monnifyApiKey || !bankInfo.monnifyContractCode) {
      setError('Monnify gateway is missing API Key or Contract Code. Please contact Admin or use manual transfer.');
      return;
    }

    setMonnifyFullName(user.fullName || user.username || '');
    setMonnifyEmail(user.email || `${user.username}@cinjelly.com`);
    setMonnifyPhone((user as any).phone || userPhone || '');
    setError(null);
    setSuccess(null);
    setShowMonnifyModal(true);
  };

  const handleExecuteMonnifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monnifyFullName.trim()) {
      setError('Please enter your full name for Monnify payment.');
      return;
    }
    if (!monnifyEmail.trim()) {
      setError('Please enter your email address for Monnify payment.');
      return;
    }

    setMonnifyLoading(true);
    setError(null);

    try {
      // Step 1: Initialize transaction with backend
      const initUrl = '/api/payment/monnify-initiate';
      console.log("[Monnify] Request URL:", initUrl);

      const initRes = await apiFetch(initUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          fullName: monnifyFullName.trim(),
          email: monnifyEmail.trim(),
          phone: monnifyPhone.trim(),
          amount: Number(bankInfo?.subscriptionAmount) || 600
        })
      });

      console.log("[Monnify] HTTP Status Code:", initRes.status);
      const headersObj: Record<string, string> = {};
      initRes.headers.forEach((value, key) => { headersObj[key] = value; });
      console.log("[Monnify] Response Headers:", headersObj);

      const initText = await initRes.text();
      console.log("Raw Response (monnify-initiate):", initText);

      let initData: any = null;
      if (initText && initText.trim().length > 0) {
        try {
          initData = JSON.parse(initText);
        } catch (jsonErr: any) {
          console.error("Failed to parse JSON response:", jsonErr, "Raw Text:", initText);
          throw new Error(`Invalid JSON response from server (Status ${initRes.status}). Raw output: ${initText.substring(0, 150)}`);
        }
      } else {
        throw new Error(`Server returned empty response (Status ${initRes.status}). Please check server logs.`);
      }

      if (!initRes.ok || !initData || !initData.success) {
        throw new Error(initData?.error || `Monnify payment initialization failed (Status ${initRes.status}).`);
      }

      // Step 2: Ensure Monnify SDK script is loaded
      await loadMonnifyScript();

      const sdkObj = (window as any).MonnifySDK || (window as any).Monnify || (window as any).monnify;
      console.log("================ MONNIFY DEBUG LOGS ================");
      console.log("window.MonnifySDK:", (window as any).MonnifySDK);
      console.log("typeof window.MonnifySDK:", typeof (window as any).MonnifySDK);
      console.log("typeof window.MonnifySDK?.initialize:", typeof (window as any).MonnifySDK?.initialize);
      console.log("Resolved sdkObj:", sdkObj);
      console.log("typeof sdkObj?.initialize:", typeof sdkObj?.initialize);

      if (!sdkObj || typeof sdkObj.initialize !== 'function') {
        throw new Error('Monnify Checkout SDK is unavailable or initialize function is not defined on window.MonnifySDK. Please refresh page and try again.');
      }

      const paymentRef = initData.paymentReference || initData.reference;
      const subAmount = Number(initData.amount) || 600;
      const isTestEnv = initData.isTestMode === true || initData.mode === 'TEST' || (typeof initData.apiKey === 'string' && initData.apiKey.startsWith('MK_TEST_'));

      console.log("[Monnify SDK] Initializing checkout with parameters:", {
        paymentRef,
        subAmount,
        customerFullName: initData.customerFullName,
        customerEmail: initData.customerEmail,
        apiKey: initData.apiKey ? `${initData.apiKey.substring(0, 8)}...` : 'MISSING',
        contractCode: initData.contractCode,
        isTestEnv
      });

      const handleMonnifyComplete = async (response: any) => {
        console.log("[Monnify SDK] handleMonnifyComplete triggered:", response);
        setMonnifyLoading(true);
        try {
          const completeUrl = '/api/payment/monnify-complete';
          console.log("[Monnify Complete] Request URL:", completeUrl);

          const res = await apiFetch(completeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              paymentReference: response?.paymentReference || response?.reference || paymentRef,
              transactionReference: response?.transactionReference || response?.paymentReference || paymentRef,
              paymentStatus: response?.paymentStatus || 'PAID',
              response
            })
          });

          console.log("[Monnify Complete] HTTP Status Code:", res.status);
          const resText = await res.text();
          console.log("Raw Response (monnify-complete):", resText);

          let data: any = null;
          if (resText && resText.trim().length > 0) {
            try {
              data = JSON.parse(resText);
            } catch (parseErr) {
              console.error("Failed to parse JSON response (monnify-complete):", parseErr, "Raw Text:", resText);
              throw new Error(`Invalid response from server (Status ${res.status}): ${resText.substring(0, 150)}`);
            }
          }

          if (!res.ok || !data?.success) {
            throw new Error(data?.error || 'Failed to complete subscription update');
          }
          setSuccess('Payment successful! Your subscription is now active for 30 days.');
          setShowMonnifyModal(false);
          if (onReloadUser) {
            onReloadUser();
          }
        } catch (err: any) {
          setError(err.message || 'Payment received but account update failed. Contact support.');
        } finally {
          setMonnifyLoading(false);
        }
      };

      const monnifyOptions: any = {
        amount: subAmount,
        currency: 'NGN',
        reference: paymentRef,
        paymentReference: paymentRef,
        customerFullName: initData.customerFullName || 'Subscriber',
        customerName: initData.customerFullName || 'Subscriber',
        customerEmail: initData.customerEmail,
        apiKey: initData.apiKey,
        contractCode: initData.contractCode,
        paymentDescription: 'CINJELLY Stream 30-Day Access Renewal',
        isTestMode: isTestEnv,
        mode: isTestEnv ? 'TEST' : 'LIVE',
        onLoadStart: function() {
          console.log("[Monnify SDK] onLoadStart triggered");
        },
        onLoadComplete: function() {
          console.log("[Monnify SDK] onLoadComplete triggered");
          setMonnifyLoading(false);
        },
        onComplete: function(response: any) {
          console.log("[Monnify SDK] Synchronous onComplete called with response:", response);
          handleMonnifyComplete(response);
        },
        onClose: function(data: any) {
          console.log("[Monnify SDK] onClose triggered:", data);
          setMonnifyLoading(false);
        }
      };

      if (initData.customerPhoneNumber && String(initData.customerPhoneNumber).trim().length > 0) {
        monnifyOptions.customerPhoneNumber = String(initData.customerPhoneNumber).trim();
        monnifyOptions.customerMobileNumber = String(initData.customerPhoneNumber).trim();
        monnifyOptions.phoneNumber = String(initData.customerPhoneNumber).trim();
      }

      console.log("================ EXACT OBJECT PASSED TO MonnifySDK.initialize() ================");
      console.log("typeof monnifyOptions.onComplete:", typeof monnifyOptions.onComplete);
      console.log("monnifyOptions.onComplete function:", monnifyOptions.onComplete);
      console.log("JSON representation:", JSON.stringify(monnifyOptions, null, 2));
      console.log("Direct JS Object:", monnifyOptions);

      // Step 3: Trigger Monnify SDK initialize
      try {
        console.log("Calling sdkObj.initialize(monnifyOptions)...");
        sdkObj.initialize(monnifyOptions);
      } catch (sdkInitErr: any) {
        console.error("================ MonnifySDK.initialize EXCEPTION CAUGHT ================");
        console.error("Exception Object:", sdkInitErr);
        console.error("Exception Message:", sdkInitErr?.message || sdkInitErr);
        console.error("Full Stack Trace:", sdkInitErr?.stack);
        setMonnifyLoading(false);
        throw new Error(`Failed to initialize Monnify checkout: ${sdkInitErr?.message || sdkInitErr}`);
      }

      // Safety timeout to reset button loading state so form doesn't stay stuck
      setTimeout(() => {
        setMonnifyLoading(false);
      }, 1500);

    } catch (err: any) {
      setMonnifyLoading(false);
      setError(err.message || 'Failed to launch Monnify payment gateway.');
    }
  };

  const fetchBankInfo = async () => {
    try {
      const response = await apiFetch('/api/payment/bank-info');
      if (response.ok) {
        const data = await response.json();
        setBankInfo(data);
        if (data && (data.manualPaymentEnabled === false || data.manualPaymentEnabled === 0)) {
          setShowManualPay(false);
        }
      }
    } catch (err) {
      console.error('Error fetching bank info:', err);
    }
  };

  const handleNotifyAdmin = async () => {
    setError(null);
    setSuccess(null);

    if (!userPhone.trim()) {
      setError('Please enter your phone number so we can link your transfer');
      return;
    }
    if (!receiptBase64) {
      setError('Please upload a screenshot of your transfer receipt');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/api/payment/upload-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: receiptBase64,
          fileName: receiptFileName,
          phone: userPhone,
          transactionRef: transactionRef
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit receipt');
      }

      setSuccess('Payment receipt successfully uploaded! Opening WhatsApp to notify admin...');

      const messageText = `Hello Admin, I have made a subscription payment. Here are my details:

User's Full Name: ${user.fullName}
Username: ${user.username}
Registered Email: ${user.email}
Subscription Plan: Premium 30 Days
Amount Paid: ₦600.00 NGN
Payment Date/Time: ${new Date().toLocaleString()}
Transaction Reference: ${transactionRef || 'None'}

Note: My payment receipt has been uploaded to the portal.`;

      const encodedMessage = encodeURIComponent(messageText);
      const whatsAppPhone = bankInfo?.contactWhatsApp || '';
      const cleanWhatsAppPhone = whatsAppPhone.replace(/[^0-9]/g, '');
      
      const whatsAppUrl = cleanWhatsAppPhone 
        ? `https://wa.me/${cleanWhatsAppPhone}?text=${encodedMessage}`
        : `https://wa.me/?text=${encodedMessage}`;

      setTimeout(() => {
        window.open(whatsAppUrl, '_blank');
        onReloadUser();
      }, 1500);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.isAffiliate) {
      fetchAffiliateStats();
    }
    fetchBankInfo();
    fetchNotifications();
    fetchUserRequests();
  }, [user.isAffiliate, user.subscriptionStatus, user.role]);

  // Listen for system notifications
  useEffect(() => {
    if (user.systemNotification) {
      setNotificationType(user.systemNotification as 'accepted' | 'declined');
      setNotificationDeclineReason(user.declineReason || '');
      setShowNotificationModal(true);
      
      if (user.systemNotification === 'accepted') {
        setShowManualPay(false);
        setRedirectCountdown(5);
      } else {
        setRedirectCountdown(null);
      }

      // Clear notification on backend
      apiFetch('/api/auth/clear-notification', { method: 'POST' })
        .then(res => {
          if (res.ok) {
            onReloadUser();
          }
        })
        .catch(err => console.error('Error clearing system notification:', err));
    }
  }, [user.systemNotification, user.declineReason, onReloadUser]);

  // Countdown for automatic redirect when accepted
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      setShowNotificationModal(false);
      setShowManualPay(false);
      setRedirectCountdown(null);
      setDeviceNotice(null);
      setShowDeviceModal(true);
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown]);

  // Poll for verification updates if status is Pending Verification
  useEffect(() => {
    let interval: any;
    if (user.paymentStatus === 'Pending Verification') {
      interval = setInterval(() => {
        onReloadUser();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user.paymentStatus, onReloadUser]);

  const handleJoinAffiliate = async () => {
    setJoiningAffiliate(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await apiFetch('/api/affiliate/join', {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join affiliate program');
      }
      setSuccess('Congratulations! You are now a registered affiliate partner. Here is your referral dashboard!');
      onReloadUser();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoiningAffiliate(false);
    }
  };

  const fetchAffiliateStats = async () => {
    setLoadingStats(true);
    try {
      const response = await apiFetch('/api/affiliate/stats');
      if (response.ok) {
        const data = await response.json();
        setAffiliateStats(data);
      }
    } catch (err) {
      console.error('Error fetching affiliate stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const copyReferralLink = () => {
    if (!affiliateStats?.affiliateCode && !user.affiliateCode) return;
    const code = affiliateStats?.affiliateCode || user.affiliateCode;
    const link = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWithdrawModal = () => {
    setWithdrawError(null);
    setWithdrawSuccess(null);
    
    // Prefill bank details if previously saved
    if (affiliateStats?.bankDetails?.bankName) {
      if (NIGERIAN_BANKS.includes(affiliateStats.bankDetails.bankName)) {
        setWithdrawBankName(affiliateStats.bankDetails.bankName);
        setWithdrawCustomBank('');
      } else {
        setWithdrawBankName('Other Bank (Type Custom Name)');
        setWithdrawCustomBank(affiliateStats.bankDetails.bankName);
      }
    } else if (!withdrawBankName) {
      setWithdrawBankName('Guaranty Trust Bank (GTBank)');
    }

    if (affiliateStats?.bankDetails?.accountNumber) {
      setWithdrawAccountNumber(affiliateStats.bankDetails.accountNumber);
    }
    if (affiliateStats?.bankDetails?.accountName) {
      setWithdrawAccountName(affiliateStats.bankDetails.accountName);
    } else if (!withdrawAccountName) {
      setWithdrawAccountName(user.fullName || '');
    }

    setShowWithdrawModal(true);
  };

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    const effectiveBankName = withdrawBankName === 'Other Bank (Type Custom Name)' 
      ? withdrawCustomBank.trim() 
      : withdrawBankName.trim();

    if (!effectiveBankName) {
      setWithdrawError('Please specify your destination bank name.');
      return;
    }

    if (!withdrawAccountNumber.trim() || withdrawAccountNumber.trim().length < 5) {
      setWithdrawError('Please enter a valid bank account number (10 digits).');
      return;
    }

    if (!withdrawAccountName.trim()) {
      setWithdrawError('Please enter the exact bank account holder name.');
      return;
    }

    const available = Number(affiliateStats?.availableEarnings ?? 0);
    if (available <= 0) {
      setWithdrawError('You do not have any available earnings to withdraw.');
      return;
    }

    setWithdrawLoading(true);
    try {
      const response = await apiFetch('/api/affiliate/withdrawal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: effectiveBankName,
          account_number: withdrawAccountNumber.trim(),
          account_name: withdrawAccountName.trim(),
          amount: available
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit withdrawal request.');
      }

      setWithdrawSuccess(data.message || 'Withdrawal request submitted successfully.');
      await fetchAffiliateStats();
      setTimeout(() => {
        setShowWithdrawModal(false);
      }, 2500);
    } catch (err: any) {
      setWithdrawError(err.message || 'An error occurred while submitting withdrawal.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const isExplicitlyDisabled = user.accountStatus === 'Disabled' || user.subscriptionStatus === 'Disabled';
  const isActive = user.role === 'admin' || (!isExplicitlyDisabled && (user.subscriptionStatus === 'Active' || user.accountStatus === 'Active' || user.paymentStatus === 'Paid'));

  // Handle simulated payment
  const handlePayment = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await apiFetch('/api/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setSuccess('Subscription activated successfully! Your unlimited streaming server access is now unlocked.');
      setTimeout(() => {
        onReloadUser();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize Jellyfin session using password
  const handleSessionSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSyncLoading(true);

    try {
      const response = await apiFetch('/api/auth/jellyfin-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: syncPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setJellyfinToken(data.jellyfinToken);
      setShowSyncModal(false);
      setSyncPassword('');
      
      // Launch streaming
      launchStreaming(data.jellyfinToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Launch Jellyfin by writing to localStorage and redirecting
  const launchStreaming = (tokenToUse: string) => {
    const activeToken = tokenToUse || jellyfinToken;
    if (!activeToken) {
      // Prompt user to enter password to fetch token from backend
      setShowSyncModal(true);
      return;
    }

    try {
      const serverUrl = window.location.origin + '/jellyfin';
      const serverId = 'jellyfin_server';
      const serverName = 'Stream Portal Server';

      const servers = [
        {
          Id: serverId,
          Name: serverName,
          Url: serverUrl,
          ManualAddress: serverUrl,
          UserId: user.jellyfinUserId,
          AccessToken: activeToken
        }
      ];

      // Inject standard Jellyfin web client keys
      window.localStorage.setItem('servers', JSON.stringify(servers));
      window.localStorage.setItem('activeServerId', serverId);
      window.localStorage.setItem('api_key', activeToken);
      window.localStorage.setItem('userId', user.jellyfinUserId || '');
      window.localStorage.setItem('serverId', serverId);
      window.localStorage.setItem('serverAddress', serverUrl);
      window.localStorage.setItem('serverName', serverName);

      window.localStorage.setItem('jellyfin_credentials', JSON.stringify({
        servers,
        activeServerId: serverId
      }));

      // Redirect directly to Jellyfin interface served on the same origin (proxied)
      window.location.href = '/jellyfin/web/index.html';
    } catch (err: any) {
      console.error('Failed to set localStorage credentials:', err);
      setError('An error occurred setting up automatic login on this browser. Please try again.');
    }
  };

  const hasPaidBefore = Boolean(user.subscriptionExpiryDate);

  return (
    <div className="min-h-screen bg-[#0a0304] text-white flex flex-col md:flex-row selection:bg-[#d31d38] selection:text-white relative" id="user-portal-root">
      
      {/* MOBILE TOPBAR */}
      <header className="md:hidden sticky top-0 z-30 bg-[#120507]/95 backdrop-blur-md border-b border-[#2e1015] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#180608] border border-[#2e1015] text-zinc-300 hover:text-white cursor-pointer"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-[#d31d38]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-full flex items-center justify-center text-white shadow-[0_0_12px_rgba(211,29,56,0.5)]">
              <Tv className="w-4 h-4" />
            </div>
            <span className="font-display font-black text-lg tracking-wider text-white">
              CIN<span className="text-[#d31d38]">ODE</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowHeaderNotifs(!showHeaderNotifs)}
              className="p-2 rounded-xl bg-[#180608] border border-[#2e1015] text-zinc-300 hover:text-white relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4 text-[#d31d38]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#d31d38] text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            {showHeaderNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHeaderNotifs(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[#120507] border border-[#2e1015] rounded-2xl shadow-2xl z-50 overflow-hidden text-left py-2">
                  <div className="px-4 py-2.5 border-b border-[#2e1015] flex items-center justify-between bg-[#0a0304]">
                    <span className="font-extrabold text-xs text-white uppercase tracking-wider font-display">Notifications</span>
                    <span className="text-[10px] bg-[#d31d38]/15 text-[#ff4d64] px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#2e1015]/60">
                    {notifications.map((notif, idx) => (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          handleOpenNotification(notif);
                          setShowHeaderNotifs(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-[#1c080b] transition block cursor-pointer"
                      >
                        <div className="text-[9px] text-[#ff4d64] font-extrabold uppercase">Notification {idx + 1}</div>
                        <div className="font-bold text-xs text-white truncate">{notif.title}</div>
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">{notif.message}</div>
                      </button>
                    ))}
                    {notifications.length === 0 && (
                      <div className="py-6 text-center text-xs text-zinc-500">No notifications</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setActiveTab('account')}
            className="w-8 h-8 rounded-full bg-[#1c080b] border border-[#d31d38]/40 text-[#ff4d64] font-bold text-xs flex items-center justify-center uppercase cursor-pointer"
            title="Account Settings"
          >
            {user.fullName ? user.fullName[0] : 'U'}
          </button>
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#120507] border-r border-[#2e1015] p-5 flex flex-col justify-between shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#2e1015] mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-full flex items-center justify-center text-white shadow-[0_0_15px_rgba(211,29,56,0.5)]">
                    <Tv className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-display font-black text-xl tracking-wider text-white">
                    CIN<span className="text-[#d31d38]">ODE</span>
                  </span>
                </div>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg bg-[#180608] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User badge */}
              <div className="bg-[#180608] border border-[#2e1015] rounded-xl p-3 mb-4">
                <div className="text-xs font-bold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">@{user.username}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  {isActive ? (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Subscriber
                    </span>
                  ) : (
                    <span className="text-[9px] bg-[#d31d38]/15 text-[#ff4d64] font-bold px-2 py-0.5 rounded-full border border-[#d31d38]/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span> Subscription Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Nav Items */}
              <nav className="space-y-1">
                {[
                  { id: 'overview', label: 'Overview & Stream', icon: Tv },
                  { id: 'subscription', label: 'Subscription & Pay', icon: CreditCard },
                  { id: 'direct_debit', label: 'Direct Debit Mandate', icon: Landmark },
                  { id: 'requests', label: 'Media Requests', icon: Film },
                  { id: 'affiliate', label: 'Affiliate & Earnings', icon: Gift },
                  { id: 'apps', label: 'Apps & Devices', icon: Smartphone },
                  { id: 'support', label: 'Help & Support', icon: HelpCircle },
                  { id: 'account', label: 'Account & Security', icon: Key },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_15px_rgba(211,29,56,0.35)]' 
                          : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'text-white' : 'text-zinc-600'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#2e1015] space-y-2">
              <button
                onClick={() => { window.location.hash = '#landing'; }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Back to Landing Page
              </button>
              {user.role === 'admin' && (
                <button
                  onClick={() => { window.location.hash = '#admin'; }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#d31d38]/15 hover:bg-[#d31d38]/25 text-[#ff4d64] text-xs font-bold border border-[#d31d38]/30 transition cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin Control Suite
                </button>
              )}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-rose-950/40 text-rose-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#d31d38]" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP APP SIDEBAR */}
      <aside className="hidden md:flex md:w-64 lg:w-72 md:sticky md:top-0 md:h-screen flex-col justify-between bg-[#120507] border-r border-[#2e1015] p-5 shrink-0 z-20">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-5 border-b border-[#2e1015] mb-5">
            <div className="w-9 h-9 bg-gradient-to-tr from-[#d31d38] to-[#ff2b47] rounded-xl flex items-center justify-center text-white shadow-[0_0_18px_rgba(211,29,56,0.6)] shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-wider text-white block leading-none">
                CIN<span className="text-[#d31d38]">ODE</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mt-1">Streaming Portal</span>
            </div>
          </div>

          {/* User mini badge */}
          <div className="bg-[#180608] border border-[#2e1015] rounded-2xl p-3.5 mb-5 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d31d38]/30 to-[#b0162c]/10 border border-[#d31d38]/40 flex items-center justify-center font-bold text-sm text-[#ff4d64] shrink-0">
                {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-white truncate">{user.fullName}</div>
                <div className="text-[10px] text-zinc-400 truncate">@{user.username}</div>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-[#2e1015]/80 flex items-center justify-between">
              {isActive ? (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
                </span>
              ) : (
                <span className="text-[9px] bg-[#d31d38]/15 text-[#ff4d64] font-extrabold px-2 py-0.5 rounded-full border border-[#d31d38]/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span> Expired
                </span>
              )}
              <button
                onClick={onReloadUser}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3 h-3 text-[#d31d38]" /> Refresh
              </button>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="space-y-1.5">
            {[
              { id: 'overview', label: 'Overview & Stream', icon: Tv },
              { id: 'subscription', label: 'Subscription & Pay', icon: CreditCard },
              { id: 'direct_debit', label: 'Direct Debit Auto-Renew', icon: Landmark },
              { id: 'requests', label: 'Media Requests', icon: Film },
              { id: 'affiliate', label: 'Affiliate & Earnings', icon: Gift },
              { id: 'apps', label: 'Apps & Devices', icon: Smartphone },
              { id: 'support', label: 'Help & Support', icon: HelpCircle },
              { id: 'account', label: 'Account & Security', icon: Key },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected 
                      ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_20px_rgba(211,29,56,0.35)]' 
                      : 'text-zinc-400 hover:text-white hover:bg-[#180608]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-[#d31d38]'}`} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isSelected ? 'text-white' : 'text-zinc-600'}`} />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 border-t border-[#2e1015] space-y-2">
          <button
            onClick={() => { window.location.hash = '#landing'; }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-[#220a0e] text-zinc-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#d31d38]" /> Landing Page
          </button>
          {user.role === 'admin' && (
            <button
              onClick={() => { window.location.hash = '#admin'; }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#d31d38]/15 hover:bg-[#d31d38]/25 text-[#ff4d64] text-xs font-bold border border-[#d31d38]/30 transition cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Admin Control Suite
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#180608] hover:bg-rose-950/40 text-rose-300 text-xs font-bold border border-[#2e1015] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#d31d38]" /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN SCREEN CANVAS */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full pb-24 md:pb-8">
        
        {/* Desktop Screen Header Bar */}
        <div className="hidden md:flex items-center justify-between pb-6 mb-6 border-b border-[#2e1015]">
          <div>
            <div className="text-[10px] text-[#ff4d64] font-extrabold uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d31d38]"></span>
              CINODE MEMBER APP / {activeTab.replace('_', ' ').toUpperCase()}
            </div>
            <h2 className="text-2xl font-display font-extrabold text-white mt-1 capitalize">
              {activeTab === 'overview' && 'Streaming Hub & Overview'}
              {activeTab === 'subscription' && 'Subscription & Payments'}
              {activeTab === 'direct_debit' && 'Direct Debit Auto-Renewal'}
              {activeTab === 'requests' && 'Movie & Series Requests'}
              {activeTab === 'affiliate' && 'Affiliate Program & Commissions'}
              {activeTab === 'apps' && 'Download Mobile & TV Apps'}
              {activeTab === 'support' && 'Support & Community Assistance'}
              {activeTab === 'account' && 'Account Credentials & Sync'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowHeaderNotifs(!showHeaderNotifs)}
                className="p-2.5 rounded-xl bg-[#120507] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-center relative shadow"
                title="View Announcements"
              >
                <Bell className="w-4 h-4 text-[#d31d38]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-[#d31d38] text-[9px] font-extrabold text-white rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showHeaderNotifs && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowHeaderNotifs(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-[#120507] border border-[#2e1015] rounded-2xl shadow-2xl z-50 overflow-hidden text-left py-2">
                    <div className="px-4 py-2.5 border-b border-[#2e1015] flex items-center justify-between bg-[#0a0304]">
                      <span className="font-extrabold text-xs text-white uppercase tracking-wider font-display">Notifications</span>
                      <span className="text-[10px] bg-[#d31d38]/15 text-[#ff4d64] px-2 py-0.5 rounded-full font-bold">{unreadCount} unread</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#2e1015]/60">
                      {notifications.map((notif, idx) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            handleOpenNotification(notif);
                            setShowHeaderNotifs(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[#1c080b] transition block cursor-pointer"
                        >
                          <div className="text-[9px] text-[#ff4d64] font-extrabold uppercase">Notification {idx + 1}</div>
                          <div className="font-bold text-xs text-white truncate">{notif.title}</div>
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5">{notif.message}</div>
                        </button>
                      ))}
                      {notifications.length === 0 && (
                        <div className="py-6 text-center text-xs text-zinc-500">No notifications</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onReloadUser}
              className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 text-zinc-300 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#d31d38]" /> Refresh
            </button>
          </div>
        </div>

        {/* Global Notifications / Alerts */}
        {error && (
          <div className="p-4 bg-[#d31d38]/10 border border-[#d31d38]/25 text-[#ff8093] text-xs font-bold rounded-2xl flex justify-between items-center mb-6 shadow-lg">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-[#ff4d64] hover:text-white font-bold text-sm cursor-pointer">×</button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold rounded-2xl flex justify-between items-center mb-6 shadow-lg">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white font-bold text-sm cursor-pointer">×</button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW & STREAM ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Email Verification Banner */}
        {user.emailVerified === 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-300">Email Verification Required</h4>
                <p className="text-xs text-zinc-300 mt-0.5">
                  Please verify your email address <strong className="text-white">({user.email || user.username})</strong> to secure your account. Check your inbox for the confirmation link.
                </p>
                {emailMsg && (
                  <p className={`text-xs mt-2 font-semibold ${emailMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {emailMsg.text}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                onClick={handleResendEmailVerification}
                disabled={resendingEmail}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  'Resend Email'
                )}
              </button>
              <button
                onClick={onReloadUser}
                className="bg-[#180608] hover:bg-[#1c080b] text-zinc-300 border border-[#2e1015] text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                title="Refresh Status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
            {/* Welcome Header */}
        <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-xl shadow-black/60">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
          
          <div>
            <span className="text-xs text-[#ff4d64] font-semibold uppercase tracking-wider">Member Dashboard</span>
            <h1 className="text-3xl font-display font-extrabold text-white tracking-tight mt-1">Hello, {user.fullName}!</h1>
            <p className="text-zinc-400 text-sm mt-1">Ready to explore? Instantly access your personal film stream.</p>
          </div>

          <div className="flex items-center gap-2.5">
            {isActive ? (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-2 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Account Active
              </span>
            ) : (
              <span className="bg-[#d31d38]/15 text-[#ff4d64] border border-[#d31d38]/30 py-2 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 animate-pulse shadow-[0_0_15px_rgba(211,29,56,0.2)]">
                <AlertTriangle className="w-4 h-4 text-[#ff4d64]" /> {hasPaidBefore ? 'Plan Expired' : 'Payment Required'}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-[#d31d38]/10 border border-[#d31d38]/30 text-[#ff8093] text-xs rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl">
            {success}
          </div>
        )}
            
            {/* Quick Action Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setActiveTab('subscription')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-[#d31d38]/15 border border-[#d31d38]/30 flex items-center justify-center text-[#ff4d64] mb-3 group-hover:scale-110 transition">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Renew / Pay</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">₦600 Unlimited Pass</div>
              </button>

              <button
                onClick={() => setActiveTab('direct_debit')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 group-hover:scale-110 transition">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Direct Debit</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Auto-Renew Monthly</div>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition">
                  <Film className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Request Movie</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Add to Cinode Server</div>
              </button>

              <button
                onClick={() => setActiveTab('apps')}
                className="bg-[#120507] hover:bg-[#1c080b] border border-[#2e1015] hover:border-[#d31d38]/50 p-4 rounded-2xl text-left transition cursor-pointer group shadow-lg"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition">
                  <Download className="w-4 h-4" />
                </div>
                <div className="text-xs font-extrabold text-white">Mobile APK</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Android & TV Guide</div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player Launch Card */}
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-8 md:col-span-2 flex flex-col justify-between shadow-xl relative">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#d31d38]/60 via-transparent to-transparent"></div>
              
              <div>
                <div className="w-11 h-11 flex items-center justify-center bg-[#d31d38]/15 text-[#ff4d64] border border-[#d31d38]/30 rounded-xl mb-5 shadow-[0_0_15px_rgba(211,29,56,0.3)]">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <h3 className="text-2xl font-display font-extrabold text-white">Stream Player Terminal</h3>
                <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
                  Your private connection is healthy and ready. Launch the player to open our elegant film interface with automatic secure single sign-on!
                </p>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setDeviceNotice(null);
                    setShowDeviceModal(true);
                  }}
                  className="bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-2 transition shadow-xl shadow-[#d31d38]/30 cursor-pointer text-sm"
                  id="launch-jellyfin-button"
                >
                  Open Stream Player <ExternalLink className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => { setShowSyncModal(true); }}
                  className="bg-[#080203] hover:bg-[#180608] border border-[#2e1015] text-zinc-300 font-bold py-4 px-6 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer hover:border-[#d31d38]/50"
                >
                  <RefreshCw className="w-4 h-4 text-[#d31d38]" /> Re-Sync Session
                </button>
              </div>
            </div>
                          {/* Side Membership Details Card */}
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center gap-2 text-[#ff4d64] border-b border-[#2e1015] pb-3 mb-5">
                  <UserCheck className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Account Details</h4>
                </div>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="block text-zinc-500 font-medium mb-0.5">USERNAME</span>
                    <span className="text-white font-bold">@{user.username}</span>
                  </div>
                  <div>
                    <span className="block text-zinc-500 font-medium mb-0.5">EMAIL</span>
                    <span className="text-white font-medium truncate block">{user.email}</span>
                  </div>
                  {user.subscriptionExpiryDate && (
                    <div>
                      <span className="block text-zinc-500 font-medium mb-0.5">RENEWAL DATE</span>
                      <span className="text-[#ff4d64] font-bold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 inline" /> {new Date(user.subscriptionExpiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="block text-zinc-500 font-medium mb-0.5">ACCOUNT ID</span>
                    <span className="text-zinc-400 block truncate font-mono text-[11px] bg-[#080203] p-2 rounded-lg mt-1 border border-[#2e1015]">{user.jellyfinUserId || 'Direct Connection'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#2e1015] flex items-center justify-between text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                <span>Secure Server Connection</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">Online</span>
              </div>
            </div>
            </div>

            {/* Broadcast feed widget */}
            {/* Targeted Broadcast Notifications Feed */}
          <div className="lg:col-span-2 bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#d31d38]/40 via-transparent to-transparent"></div>
            
            <div className="flex items-center justify-between border-b border-[#2e1015] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#ff4d64]" />
                <h3 className="text-lg font-display font-extrabold text-white">Broadcast Announcements</h3>
              </div>
              <button
                onClick={fetchNotifications}
                disabled={loadingNotifs}
                className="text-zinc-500 hover:text-zinc-300 transition text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingNotifs ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {loadingNotifs && notifications.length === 0 ? (
              <div className="py-12 text-center text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff4d64]" />
                <span className="text-xs">Checking for announcements...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 bg-[#080203] rounded-2xl border border-[#2e1015]">
                <Info className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <h4 className="text-zinc-300 font-semibold text-xs">No active broadcasts</h4>
                <p className="text-zinc-500 text-[10px] mt-1">Announcements or system updates will appear here when pushed by administrators.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isVideo = notif.imageUrl && (
                    notif.imageUrl.endsWith('.mp4') || 
                    notif.imageUrl.endsWith('.webm') || 
                    notif.imageUrl.endsWith('.ogg') || 
                    notif.imageUrl.endsWith('.mov') ||
                    notif.imageUrl.includes('/video/')
                  );

                  const isUnread = !readNotifIds.includes(notif.id);

                  return (
                    <div 
                      key={notif.id} 
                      onClick={() => handleOpenNotification(notif)}
                      className={`border rounded-xl p-5 hover:border-[#d31d38]/50 transition text-left cursor-pointer hover:bg-[#180608] group relative ${isUnread ? 'bg-[#d31d38]/10 border-[#d31d38]/40' : 'bg-[#080203] border-[#2e1015]'}`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm group-hover:text-[#ff4d64] transition">{notif.title}</h4>
                          {isUnread && (
                            <span className="bg-[#d31d38] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>
                          )}
                        </div>
                        <span className="text-[9px] text-zinc-500 font-mono shrink-0">{new Date(notif.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">{notif.message}</p>
                      
                      {notif.imageUrl && (
                        <div className="mt-3.5 rounded-lg overflow-hidden border border-[#2e1015] bg-[#050102] w-fit max-w-full">
                          {isVideo ? (
                            <video 
                              src={notif.imageUrl} 
                              controls 
                              onClick={(e) => e.stopPropagation()} // don't open modal when clicking video controls
                              className="max-w-full h-auto rounded-lg block" 
                            />
                          ) : (
                            <img 
                              src={notif.imageUrl} 
                              alt={notif.title} 
                              referrerPolicy="no-referrer" 
                              className="max-w-full h-auto rounded-lg block" 
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        )}

        {/* ================= TAB 2: SUBSCRIPTION & PAY ================= */}
        {activeTab === 'subscription' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-[#ff4d64] font-extrabold uppercase tracking-wider">Unlimited Streaming Pass</span>
                  <h3 className="text-xl font-display font-extrabold text-white mt-0.5">Subscription Plan Details</h3>
                  <p className="text-xs text-zinc-400 mt-1">Get 30 days unthrottled access to 4K streams, movies, series, and anime with zero ads.</p>
                </div>
                <div className="text-right sm:text-right">
                  <div className="text-2xl font-black font-display text-white">₦600 <span className="text-xs text-zinc-400 font-normal">/ 30 days</span></div>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">All-Inclusive Pass</span>
                </div>
              </div>
            </div>

            {/* Dynamic Card Area */}
        {!isActive ? (
          user.paymentStatus === 'Pending Verification' ? (
            /* Pending Verification Panel */
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-8 text-center max-w-xl mx-auto shadow-2xl relative">
              <div className="absolute top-0 right-0 bg-amber-500 text-black font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-bl-xl">
                Pending Verification
              </div>
              
              <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
              
              <h3 className="text-xl font-display font-extrabold text-white">Payment Awaiting Verification</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                Thank you! We have received your payment submission. An administrator has been notified to verify your bank transfer. Once confirmed, your full streaming access will be unlocked instantly.
              </p>

              <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5 my-6 text-left text-xs space-y-3 max-w-sm mx-auto text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Monthly Plan Subscription:</span>
                  <span className="text-white font-bold">₦600.00 NGN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Payment Status:</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Pending Approval
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#2e1015] pt-3">
                  <span className="text-zinc-400">Media Platform:</span>
                  <span className="text-[#ff4d64] font-bold">Cinode Private Server</span>
                </div>
              </div>

              <button
                onClick={onReloadUser}
                disabled={loading}
                className="w-full bg-[#1c080b] hover:bg-[#2e1015] text-white border border-[#2e1015] font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-sm"
                id="refresh-verification-button"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Check Verification Status
              </button>
              
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                If your payment isn't verified within 15 minutes, please contact support.
              </p>
            </div>
          ) : (showManualPay && (bankInfo?.manualPaymentEnabled !== false && bankInfo?.manualPaymentEnabled !== 0)) ? (
            /* Manual Bank Transfer Instructions Panel */
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 text-left max-w-xl mx-auto shadow-2xl relative">
              <div className="absolute top-0 right-0 bg-[#d31d38] text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-bl-xl">
                Manual Transfer & Upload
              </div>

              <h3 className="text-xl font-display font-extrabold text-white mb-2 text-center">Bank Payment Instructions</h3>
              <p className="text-zinc-400 text-xs text-center mb-6 leading-relaxed">
                Please transfer exactly <strong className="text-[#ff4d64] font-bold text-sm">₦600.00 NGN</strong> to the bank details below. Once completed, fill the form, upload your receipt screenshot, and click "I've Paid".
              </p>

              <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4 mb-6 space-y-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Bank Name</span>
                    <span className="text-white text-sm font-extrabold">{bankInfo?.bankName || 'Not Set (Contact Admin)'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Beneficiary Name</span>
                    <span className="text-white text-sm font-extrabold">{bankInfo?.bankBeneficiary || 'Not Set (Contact Admin)'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider">Account Number</span>
                  <span className="text-[#ff4d64] text-base font-mono font-black tracking-widest block py-2 bg-[#050102] px-3 rounded mt-1 select-all border border-[#2e1015] text-center">
                    {bankInfo?.bankAccountNo || 'Not Set (Contact Admin)'}
                  </span>
                </div>
                {bankInfo?.bankInstructions && (
                  <div className="border-t border-[#2e1015] pt-2.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-1">Additional Instructions</span>
                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{bankInfo.bankInstructions}</p>
                  </div>
                )}
              </div>

              {/* Form inputs for verification */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Your Phone Number <span className="text-[#d31d38]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="Enter your phone number (e.g., 08031234567)"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#d31d38] focus:ring-1 focus:ring-[#d31d38] text-xs transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Transaction Reference / Session ID <span className="text-zinc-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter transaction reference or session ID"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#d31d38] focus:ring-1 focus:ring-[#d31d38] text-xs transition"
                  />
                </div>

                {/* File upload drag and drop area */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Upload Payment Receipt Screenshot <span className="text-[#d31d38]">*</span>
                  </label>
                  
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('receipt-file-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      dragActive 
                        ? 'border-[#d31d38] bg-[#d31d38]/10' 
                        : receiptBase64 
                          ? 'border-emerald-500/50 bg-emerald-500/5' 
                          : 'border-[#2e1015] hover:border-[#d31d38]/60 bg-[#080203]'
                    }`}
                  >
                    <input
                      id="receipt-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {receiptBase64 ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-lg overflow-hidden border border-emerald-500/30">
                          <img src={receiptBase64} alt="Receipt Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-xs">
                          <span className="text-emerald-400 font-bold block">Receipt Selected!</span>
                          <span className="text-zinc-500 text-[10px] block truncate max-w-xs mx-auto">{receiptFileName}</span>
                        </div>
                        <span className="inline-block text-[10px] bg-[#180608] text-zinc-300 py-1 px-3 rounded-lg hover:bg-[#220a0e] border border-[#2e1015]">
                          Change screenshot
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-10 h-10 bg-[#120507] border border-[#2e1015] rounded-lg flex items-center justify-center mx-auto text-zinc-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="text-xs">
                          <span className="text-zinc-300 font-medium">Drag & drop receipt screenshot here</span>
                          <span className="text-zinc-500 block text-[10px] mt-1">or click to choose image file</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowManualPay(false)}
                  className="flex-1 bg-[#0f0406] hover:bg-[#1c080b] border border-[#2e1015] text-zinc-400 font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNotifyAdmin}
                  disabled={loading}
                  className="flex-[2] bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 text-xs shadow-lg shadow-[#d31d38]/30"
                  id="notify-admin-button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting & Opening WhatsApp...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> I've Paid
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : showMonnifyModal ? (
            /* Monnify Interactive Payment Form Modal */
            <div className="bg-[#120507] border border-sky-500/30 rounded-2xl p-6 sm:p-8 text-left max-w-xl mx-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowMonnifyModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-[#180608] hover:bg-[#220a0e] p-2 rounded-xl transition cursor-pointer border border-[#2e1015]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-extrabold text-white">Monnify Payment Details</h3>
                  <p className="text-xs text-sky-400/90 font-medium">Instant Gateway (Card, Bank Transfer, USSD)</p>
                </div>
              </div>

              <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4 mb-6 space-y-2 text-xs text-zinc-300">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Subscription Plan:</span>
                  <span className="font-bold text-white">30-Day Streaming Access</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#2e1015] pt-2">
                  <span className="text-zinc-400">Amount Due:</span>
                  <span className="font-extrabold text-sky-400 text-sm">₦{bankInfo?.subscriptionAmount || 600}.00 NGN</span>
                </div>
              </div>

              <form onSubmit={handleExecuteMonnifyPayment} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-sky-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={monnifyFullName}
                    onChange={(e) => setMonnifyFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-sky-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={monnifyEmail}
                    onChange={(e) => setMonnifyEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Phone Number <span className="text-zinc-500">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={monnifyPhone}
                    onChange={(e) => setMonnifyPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-xs transition"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-[#d31d38]/10 border border-[#d31d38]/30 rounded-xl text-[#ff8093] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMonnifyModal(false)}
                    className="flex-1 bg-[#0f0406] hover:bg-[#1c080b] border border-[#2e1015] text-zinc-400 font-bold py-3.5 px-4 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={monnifyLoading}
                    className="flex-[2] bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 text-xs shadow-lg shadow-sky-950/30 border border-sky-400/30"
                    id="monnify-pay-now-button"
                  >
                    {monnifyLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" /> Opening Monnify Gateway...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 text-sky-200" /> Pay Now
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Billing Options Selector Panel */
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-8 text-center max-w-xl mx-auto shadow-2xl relative">
              <div className="absolute top-0 right-0 bg-[#d31d38] text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-bl-xl shadow-md">
                {hasPaidBefore ? 'Access Suspended' : 'Payment Required'}
              </div>
              
              {hasPaidBefore ? (
                <ShieldAlert className="w-12 h-12 text-[#ff4d64] mx-auto mb-4" />
              ) : (
                <CreditCard className="w-12 h-12 text-[#ff4d64] mx-auto mb-4 animate-bounce" />
              )}
              
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white">
                {hasPaidBefore ? 'Streaming Access Paused' : 'Pay ₦600 to Start Enjoying'}
              </h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                {hasPaidBefore 
                  ? 'Your ₦600 monthly plan is expired. Please renew your access to continue watching unlimited premium movies instantly.'
                  : 'Subscribe now for ₦600 NGN to unlock instant 30-day access to our complete library of 4K movies, TV series, and live streaming.'}
              </p>

              <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5 my-6 text-left text-xs space-y-3 max-w-sm mx-auto text-zinc-300">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Monthly Plan Subscription:</span>
                  <span className="text-white font-bold">₦600.00 NGN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Duration:</span>
                  <span className="text-white font-bold">30 Days Unlimited Access</span>
                </div>
                <div className="flex justify-between border-t border-[#2e1015] pt-3">
                  <span className="text-zinc-400">Media Platform:</span>
                  <span className="text-[#ff4d64] font-bold">Cinode Private Server</span>
                </div>
              </div>

              <div className="max-w-sm mx-auto space-y-3">
                {bankInfo?.squadEnabled && (
                  <button
                    onClick={handlePayWithSquad}
                    disabled={squadLoading}
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer text-sm shadow-xl shadow-purple-950/30 border border-purple-400/30"
                    id="pay-squad-button"
                  >
                    {squadLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" /> Opening Squad Gateway...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4.5 h-4.5 text-purple-200" />
                        <span>Pay via Squad (HabariPay)</span>
                      </>
                    )}
                  </button>
                )}

                {bankInfo?.squadEnabled && (
                  <button
                    onClick={handleOpenDirectDebitModal}
                    className="w-full bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 hover:from-violet-600 hover:to-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer text-sm shadow-xl shadow-purple-950/30 border border-purple-400/40"
                    id="pay-direct-debit-button"
                  >
                    <Landmark className="w-4.5 h-4.5 text-purple-200" />
                    <span>Set Up Auto-Renewal (Direct Debit)</span>
                  </button>
                )}

                {bankInfo?.monnifyEnabled && (
                  <button
                    onClick={handlePayWithMonnify}
                    disabled={monnifyLoading}
                    className="w-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer text-sm shadow-xl shadow-sky-950/30 border border-sky-400/30"
                    id="pay-monnify-button"
                  >
                    {monnifyLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" /> Opening Monnify Gateway...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4.5 h-4.5 text-sky-200" />
                        <span>Pay via Monnify (Instant Activation)</span>
                      </>
                    )}
                  </button>
                )}

                {/* Primary Paystack InlineJS Gateway */}
                {bankInfo?.paystackEnabled && (
                  <button
                    onClick={handlePayWithPaystack}
                    disabled={paystackLoading}
                    className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer text-sm shadow-xl shadow-emerald-950/30 border border-emerald-400/30"
                    id="pay-paystack-inline-button"
                  >
                    {paystackLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" /> Opening Paystack Checkout...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4.5 h-4.5 text-emerald-200" />
                        <span>Pay via Paystack (Instant Activation)</span>
                      </>
                    )}
                  </button>
                )}

                {/* 2. Separate Paystack Payment Link / Payment Page Gateway */}
                {bankInfo?.customPaymentEnabled && (
                  <button
                    onClick={() => {
                      if (bankInfo?.customPaymentUrl) {
                        const target = bankInfo.customPaymentTarget === '_self' ? '_self' : '_blank';
                        window.open(bankInfo.customPaymentUrl, target);
                      } else {
                        setError('Paystack Payment Link URL is not configured. Please contact the administrator.');
                      }
                    }}
                    className={`w-full font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2.5 transition cursor-pointer text-sm ${
                      bankInfo?.paystackEnabled
                        ? 'bg-[#180608] hover:bg-[#220a0e] text-emerald-300 border border-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-950/30 border border-emerald-400/30 font-extrabold'
                    }`}
                    id="pay-custom-link-button"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    <span>{bankInfo?.customPaymentBtnName || 'Pay via Paystack Payment Page'}</span>
                  </button>
                )}

                {/* Manual Bank Transfer Payment Option */}
                {(bankInfo?.manualPaymentEnabled !== false && bankInfo?.manualPaymentEnabled !== 0) && (
                  <button
                    onClick={() => setShowManualPay(true)}
                    className={`w-full font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs ${
                      bankInfo?.squadEnabled || bankInfo?.monnifyEnabled || bankInfo?.paystackEnabled || bankInfo?.customPaymentEnabled
                        ? 'bg-[#0f0406] hover:bg-[#1c080b] text-zinc-300 border border-[#2e1015]'
                        : 'bg-[#d31d38] hover:bg-[#b0162c] text-white shadow-lg shadow-[#d31d38]/30 py-3.5 text-sm font-extrabold'
                    }`}
                    id="pay-manually-button"
                  >
                    <Building2 className="w-4 h-4 text-zinc-400" /> 
                    {bankInfo?.squadEnabled || bankInfo?.monnifyEnabled || bankInfo?.paystackEnabled || bankInfo?.customPaymentEnabled ? 'Alternative: Manual Bank Transfer' : (hasPaidBefore ? 'Renew Subscription' : 'Pay ₦600 to Start Enjoying')}
                  </button>
                )}

                {/* Notice if all payment gateways including manual bank transfer are disabled */}
                {!(bankInfo?.squadEnabled || bankInfo?.monnifyEnabled || bankInfo?.paystackEnabled || bankInfo?.customPaymentEnabled) && (bankInfo?.manualPaymentEnabled === false || bankInfo?.manualPaymentEnabled === 0) && (
                  <div className="bg-[#180608] border border-amber-500/30 rounded-xl p-4 text-amber-200/90 text-xs text-center space-y-2">
                    <p className="font-bold text-amber-300">Payment Channels Temporarily Offline</p>
                    <p className="text-[11px] text-zinc-400">Payment channels are temporarily paused or undergoing maintenance. Please reach out to customer support to activate or renew your subscription.</p>
                  </div>
                )}
              </div>
              
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed">
                {bankInfo?.squadEnabled || bankInfo?.monnifyEnabled || bankInfo?.paystackEnabled || bankInfo?.customPaymentEnabled
                  ? 'Select your preferred payment option above to complete your subscription renewal.' 
                  : (bankInfo?.manualPaymentEnabled !== false && bankInfo?.manualPaymentEnabled !== 0)
                    ? 'Unlock instant access via manual bank transfer securely. Cancel any time.'
                    : 'Payment channels are currently paused. Please contact customer support.'}
              </p>
            </div>
          )
        ) : (
          /* Active Streaming Player Controls */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          </div>
        )}
          </div>
        )}

        {/* ================= TAB 3: DIRECT DEBIT ================= */}
        {activeTab === 'direct_debit' && (
          <div className="space-y-8 animate-in fade-in duration-200">
                        <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#2e1015] pb-6 mb-6">
                <div>
                  <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Automated Recurring Renewal
                  </span>
                  <h3 className="text-xl font-display font-extrabold text-white mt-1">Squad Direct Debit Mandate</h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                    Never lose access to your streams. Set up an automated monthly ₦600 bank debit with your Nigerian bank account.
                  </p>
                </div>
                <div>
                  {userMandate && userMandate.status === 'active' ? (
                    <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Active Mandate
                    </span>
                  ) : (
                    <span className="bg-[#180608] text-zinc-400 border border-[#2e1015] text-xs font-bold px-3 py-1.5 rounded-xl">
                      No Active Mandate
                    </span>
                  )}
                </div>
              </div>

              {userMandate && userMandate.status === 'active' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Authorized Bank</div>
                      <div className="text-sm font-bold text-white mt-1">{userMandate.bankName || 'Nigerian Bank'}</div>
                    </div>
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Debit Account</div>
                      <div className="text-sm font-mono text-purple-300 mt-1">
                        {userMandate.accountNumber ? `******${userMandate.accountNumber.slice(-4)}` : '••••••••••'}
                      </div>
                    </div>
                    <div className="bg-[#180608] border border-purple-500/20 p-4 rounded-xl">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Next Renewal Date</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">
                        {userMandate.nextDebitDate ? new Date(userMandate.nextDebitDate).toLocaleDateString() : 'Active Renewal'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#2e1015]">
                    <button
                      type="button"
                      onClick={handleTriggerManualRenewalDebit}
                      disabled={renewingMandate}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                    >
                      {renewingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      <span>Trigger Renewal Debit Now (₦{userMandate.amount || '600'})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelUserMandate}
                      disabled={cancellingMandate}
                      className="bg-[#180608] hover:bg-rose-950/40 text-rose-300 border border-rose-500/30 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer"
                    >
                      {cancellingMandate ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      <span>Cancel Mandate</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-[#180608] border border-[#2e1015] p-5 rounded-xl text-xs text-zinc-300 space-y-2">
                    <div className="font-bold text-white text-sm mb-1">Why enable Automated Direct Debit?</div>
                    <p>• Seamless unthrottled streaming without manual bank transfers or monthly logins.</p>
                    <p>• Instant renewal verification and immediate Jellyfin account validity extension.</p>
                    <p>• Fully secure and regulated by the Central Bank of Nigeria via Squad / HabariPay.</p>
                    <p>• Cancel anytime in 1-click directly from this portal.</p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenDirectDebitModal}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs py-3 px-6 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                    >
                      <Landmark className="w-4 h-4" />
                      <span>Set Up Monthly Direct Debit (₦600/mo)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: MEDIA REQUESTS ================= */}
        {activeTab === 'requests' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* User Movie/Show Request Console */}
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#d31d38]/40 via-transparent to-transparent"></div>
            
            <div className="flex items-center justify-between border-b border-[#2e1015] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#ff4d64]" />
                <h3 className="text-lg font-display font-extrabold text-white">Movie/Show Request</h3>
              </div>
            </div>

            <p className="text-zinc-400 text-xs mb-5 leading-relaxed text-left">
              Can't find your favorite movie or TV show? Submit a request and our admin team will source and add it to our server!
            </p>

            <button
              onClick={() => setShowRequestModal(true)}
              className="w-full bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#d31d38]/20 mb-6"
            >
              <PlusCircle className="w-4 h-4" /> Request Movie or Show
            </button>

            {/* List User's own previous requests */}
            <div className="space-y-3 text-left">
              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Your Request History ({userRequests.length})</h4>
              
              {loadingUserRequests && userRequests.length === 0 ? (
                <div className="py-4 text-center text-zinc-600">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#ff4d64]" />
                </div>
              ) : userRequests.length === 0 ? (
                <p className="text-zinc-600 text-[11px] italic">You have not requested any content yet.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {userRequests.map((req) => (
                    <div key={req.id} className="bg-[#080203] border border-[#2e1015] p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-white truncate block">{req.title}</span>
                        <span className="text-[10px] text-zinc-500 block">
                          {req.type === 'movie' ? `Movie (${req.releaseYear || 'N/A'})` : `Show (S:${req.season || 'All'} E:${req.episode || 'All'})`}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' : req.status === 'Declined' ? 'bg-rose-500/10 text-rose-400' : 'bg-[#d31d38]/15 text-[#ff4d64]'}`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* ================= TAB 5: AFFILIATE & EARNINGS ================= */}
        {activeTab === 'affiliate' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Affiliate Referral Program Section */}
        {user.isAffiliate && (
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 mt-8 shadow-xl relative" id="affiliate-dashboard-section">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/30 via-transparent to-transparent"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2e1015] pb-6 mb-6">
              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Affiliate Program</span>
                <h3 className="text-2xl font-display font-extrabold text-white tracking-tight mt-1">Your Referral Partner Dashboard</h3>
                <p className="text-zinc-400 text-sm mt-1">Invite friends and earn commissions on active subscriptions!</p>
              </div>
              <button
                onClick={fetchAffiliateStats}
                disabled={loadingStats}
                className="bg-[#080203] hover:bg-[#180608] border border-[#2e1015] text-xs text-zinc-300 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingStats ? 'animate-spin' : ''}`} /> Refresh Stats
              </button>
            </div>

            {loadingStats && !affiliateStats ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                <span className="text-sm text-zinc-400">Loading your referral details...</span>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Promo link / Referral Code card */}
                <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Your Unique Code</span>
                    <div className="text-xl font-mono font-black text-white mt-1">
                      {affiliateStats?.affiliateCode || user.affiliateCode || 'PENDING'}
                    </div>
                  </div>
                  <div className="flex-1 w-full md:max-w-md">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Referral Partner Link</span>
                    <div className="flex mt-1">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}?ref=${affiliateStats?.affiliateCode || user.affiliateCode}`}
                        className="w-full bg-[#120507] border border-[#2e1015] border-r-0 rounded-l-xl py-2 px-3 text-xs text-zinc-300 font-mono focus:outline-none"
                      />
                      <button
                        onClick={copyReferralLink}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 rounded-r-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4.5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Earnings</span>
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-2xl font-black text-white">₦{Number(affiliateStats?.totalEarnings ?? affiliateStats?.totalCommission ?? 0).toFixed(2)}</span>
                    <span className="block text-[10px] text-zinc-500 mt-1">All commissions earned</span>
                  </div>

                  <div className="bg-[#080203] border border-emerald-500/30 rounded-xl p-4.5 bg-gradient-to-b from-emerald-950/20 to-transparent">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Available to Withdraw</span>
                      <Wallet className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-2xl font-black text-emerald-400">₦{Number(affiliateStats?.availableEarnings ?? 0).toFixed(2)}</span>
                    <span className="block text-[10px] text-emerald-500/80 mt-1 font-medium">Ready for payout</span>
                  </div>

                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4.5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-amber-500/90 uppercase tracking-wider">In Review (Pending)</span>
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-2xl font-black text-amber-400">₦{Number(affiliateStats?.pendingWithdrawal ?? 0).toFixed(2)}</span>
                    <span className="block text-[10px] text-zinc-500 mt-1">Awaiting admin transfer</span>
                  </div>

                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4.5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Paid Out</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-2xl font-black text-white">₦{Number(affiliateStats?.totalPaidOut ?? affiliateStats?.paidCommission ?? 0).toFixed(2)}</span>
                    <span className="block text-[10px] text-zinc-500 mt-1">Settled to your bank</span>
                  </div>
                </div>

                {/* Withdrawal Action Banner */}
                <div className="bg-[#0e0406] border border-[#2e1015] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-wider">
                        Manual Bank Payout
                      </span>
                      {Number(affiliateStats?.availableEarnings ?? 0) > 0 && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Balance Available
                        </span>
                      )}
                    </div>
                    <h4 className="text-lg font-display font-extrabold text-white">
                      Request Affiliate Payout
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You can withdraw your entire available earnings of <strong className="text-emerald-400 font-bold">₦{Number(affiliateStats?.availableEarnings ?? 0).toFixed(2)}</strong>. Our team will manually review and transfer the funds directly to your verified Nigerian bank account.
                    </p>
                    {Number(affiliateStats?.pendingWithdrawal ?? 0) > 0 && (
                      <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2 mt-2">
                        <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>You currently have <strong>₦{Number(affiliateStats?.pendingWithdrawal ?? 0).toFixed(2)}</strong> in review by admin.</span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleOpenWithdrawModal}
                      disabled={Number(affiliateStats?.availableEarnings ?? 0) <= 0}
                      className={`w-full md:w-auto py-3 px-6 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                        Number(affiliateStats?.availableEarnings ?? 0) > 0
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 hover:shadow-emerald-900/60'
                          : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      {Number(affiliateStats?.availableEarnings ?? 0) > 0
                        ? `Withdraw ₦${Number(affiliateStats?.availableEarnings ?? 0).toFixed(2)}`
                        : 'No Available Balance'}
                    </button>
                  </div>
                </div>

                {/* Secondary Rates & Potential Bento row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-zinc-500 block">Commission Rate</span>
                      <span className="text-zinc-400 font-semibold">Per active subscriber</span>
                    </div>
                    <span className="text-lg font-black text-white">₦{Number(affiliateStats?.defaultCommission ?? 100.00).toFixed(2)}</span>
                  </div>

                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-zinc-500 block">Active Subscribers</span>
                      <span className="text-zinc-400 font-semibold">{affiliateStats?.paidCount ?? 0} of {affiliateStats?.registeredCount ?? 0} signed up</span>
                    </div>
                    <span className="text-lg font-black text-emerald-400">{affiliateStats?.paidCount ?? 0}</span>
                  </div>

                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-zinc-500 block">Potential Future Earnings</span>
                      <span className="text-zinc-400 font-semibold">From {Math.max(0, (affiliateStats?.registeredCount ?? 0) - (affiliateStats?.paidCount ?? 0))} unpaid signups</span>
                    </div>
                    <span className="text-lg font-black text-emerald-500">₦{Number(Math.max(0, (affiliateStats?.registeredCount ?? 0) - (affiliateStats?.paidCount ?? 0)) * Number(affiliateStats?.defaultCommission ?? 100.00)).toFixed(2)}</span>
                  </div>
                </div>

                {/* Withdrawal History Section */}
                <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5">
                  <div className="flex justify-between items-center border-b border-[#2e1015] pb-3 mb-4">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      Withdrawal Requests History ({affiliateStats?.withdrawals?.length ?? 0})
                    </h4>
                    <span className="text-[10px] text-zinc-500">Direct bank transfers</span>
                  </div>

                  {!affiliateStats?.withdrawals || affiliateStats.withdrawals.length === 0 ? (
                    <div className="text-center py-8">
                      <Banknote className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">No withdrawal requests submitted yet.</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">When you request a payout, your transaction status and bank details will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {affiliateStats.withdrawals.map((w: any) => {
                        const isPending = w.status === 'pending';
                        const isPaid = w.status === 'paid';
                        const isDeclined = w.status === 'declined';
                        return (
                          <div key={w.id} className="p-3.5 bg-[#120507] border border-[#2e1015] rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-sm">₦{parseFloat(w.amount).toFixed(2)}</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                                  isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  isDeclined ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {isPending ? 'Pending Review' : isPaid ? 'Paid' : 'Declined'}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-semibold text-zinc-300">{w.bank_name}</span>
                                <span>•</span>
                                <span className="font-mono text-zinc-400">••••{String(w.account_number).slice(-4)}</span>
                                <span>•</span>
                                <span className="text-zinc-400">{w.account_name}</span>
                              </div>
                              {isDeclined && w.decline_reason && (
                                <div className="mt-1.5 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-[11px] flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                  <span><strong>Decline Reason:</strong> {w.decline_reason} (Funds returned to your available balance)</span>
                                </div>
                              )}
                              {isPaid && w.payment_reference && (
                                <div className="text-[10px] text-emerald-400 font-mono">
                                  Ref: {w.payment_reference}
                                </div>
                              )}
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                              <span className="block text-[10px] text-zinc-500">Requested: {new Date(w.requested_at || w.created_at).toLocaleDateString()}</span>
                              {w.processed_at && (
                                <span className="block text-[10px] text-zinc-500">Processed: {new Date(w.processed_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Referrals & Commissions detailed tables split */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  
                  {/* Referred Users List */}
                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider border-b border-[#2e1015] pb-3 mb-4 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-500" /> Referred Users List
                    </h4>
                    {!affiliateStats?.referredUsers || affiliateStats.referredUsers.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">No users have signed up with your code yet.</p>
                    ) : (
                      <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                        {affiliateStats.referredUsers.map((refUser: any) => {
                          const isPaid = refUser.paymentStatus === 'Paid' || refUser.subscriptionStatus === 'Active';
                          return (
                            <div key={refUser.id} className="flex justify-between items-center text-xs p-2.5 bg-[#120507] border border-[#2e1015] rounded-lg">
                              <div>
                                <span className="block font-bold text-zinc-300">{refUser.fullName}</span>
                                <span className="block text-[10px] text-zinc-500">Joined {new Date(refUser.registrationDate).toLocaleDateString()}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#180608] text-zinc-400'}`}>
                                {isPaid ? 'Paid Subscriber' : 'Signed Up'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Commissions History */}
                  <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-5">
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider border-b border-[#2e1015] pb-3 mb-4 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" /> Commission Records
                    </h4>
                    {!affiliateStats?.commissions || affiliateStats.commissions.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">No commissions have been recorded yet.</p>
                    ) : (
                      <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                        {affiliateStats.commissions.map((c: any) => (
                          <div key={c.id} className="flex justify-between items-center text-xs p-2.5 bg-[#120507] border border-[#2e1015] rounded-lg">
                            <div>
                              <span className="block font-bold text-white">₦{parseFloat(c.amount).toFixed(2)}</span>
                              <span className="block text-[10px] text-zinc-500">Ref ID: {c.id.substring(0, 8)} • {new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest ${
                              c.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              c.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}
          </div>
        )}
          </div>
        )}

        {/* ================= TAB 6: MOBILE & TV APPS ================= */}
        {activeTab === 'apps' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Mobile App Download Advertisement Banner */}
        <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 shadow-xl relative overflow-hidden mb-8">
          <div className="absolute top-0 left-0 w-[4px] h-full bg-[#d31d38]"></div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 text-center md:text-left">
              <span className="inline-flex items-center gap-1 bg-[#d31d38]/15 text-[#ff4d64] font-bold text-[9px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#d31d38]/30">
                <Smartphone className="w-3 h-3" /> Offline watch available
              </span>
              <h3 className="text-lg font-display font-black text-white">Stream & Save Content Directly on Mobile Clients</h3>
              <p className="text-zinc-400 text-xs max-w-xl leading-relaxed">
                Watch seamlessly on the move without buffering or using mobile data! Download our dedicated client apps for your iPhone, iPad, or Android smartphone/tablet.
              </p>
              
              <div className="bg-[#080203] border border-[#2e1015] rounded-xl p-3 max-w-xl space-y-1 text-left">
                <span className="text-[#ff4d64] font-bold text-[11px] uppercase tracking-wider block">
                  📱 Mobile App Connection Setup
                </span>
                <p className="text-zinc-300 text-xs">
                  When opening the mobile app for the first time, in the field requiring you to enter the <strong>Server URL</strong>, enter:
                </p>
                <div className="bg-[#180608] border border-[#2e1015] rounded-lg px-2.5 py-1.5 text-[#ff8093] font-mono text-xs flex items-center justify-between font-bold select-all">
                  <span>https://cinode.zerolord.com</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 justify-center shrink-0">
              {systemStatus?.iosDownloadUrl ? (
                <a 
                  href={systemStatus.iosDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#180608] hover:bg-[#220a0e] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 border border-[#2e1015] hover:border-[#d31d38]/50 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <span>Download iOS App</span>
                </a>
              ) : (
                <button 
                  onClick={() => alert("iOS app download URL is currently being set up by our admins. Check back soon!")}
                  className="bg-[#120507] text-zinc-600 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 border border-[#2e1015] transition cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-zinc-600" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <span>iOS App (Pending)</span>
                </button>
              )}

              {systemStatus?.androidDownloadUrl ? (
                <a 
                  href={systemStatus.androidDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#180608] hover:bg-[#220a0e] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 border border-[#2e1015] hover:border-[#d31d38]/50 transition cursor-pointer"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <span>Download Android App</span>
                </a>
              ) : (
                <button 
                  onClick={() => alert("Android app download URL is currently being set up by our admins. Check back soon!")}
                  className="bg-[#120507] text-zinc-600 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 border border-[#2e1015] transition cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-zinc-600" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <span>Android App (Pending)</span>
                </button>
              )}
            </div>
          </div>
        </div>
          </div>
        )}

        {/* ================= TAB 7: SUPPORT & HELP ================= */}
        {activeTab === 'support' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Support & Contact Details Section */}
        {bankInfo && (bankInfo.contactEmail || bankInfo.contactPhone || bankInfo.contactWhatsApp || bankInfo.contactOther || bankInfo.chatbotInfo) && (
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 mt-8 shadow-lg relative" id="support-contact-section">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-[10px] text-[#ff4d64] font-bold uppercase tracking-wider block">Customer Support & Assistance</span>
                <h4 className="text-lg font-display font-extrabold text-white mt-1">Need help or have questions?</h4>
                <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed max-w-xl">
                  Get in touch with an administrator or utilize our support helper chatbot. We are here to ensure your streaming setup remains fully operational.
                </p>
              </div>

              {bankInfo.chatbotInfo && (
                <a 
                  href={bankInfo.chatbotInfo.startsWith('http') ? bankInfo.chatbotInfo : `https://t.me/${bankInfo.chatbotInfo.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-2.5 px-5 rounded-xl text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 self-start md:self-auto shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Support Chatbot</span>
                </a>
              )}
            </div>

            {/* Chatbot Instructions */}
            {bankInfo.chatbotInfo && bankInfo.chatbotInstructions && (
              <div className="bg-[#080203] border border-[#2e1015] p-3 rounded-xl mt-4 text-[11px] text-zinc-300 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[#ff4d64] shrink-0" />
                <span><strong>Chatbot Instructions:</strong> {bankInfo.chatbotInstructions}</span>
              </div>
            )}

            {/* Contact Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#2e1015] text-xs text-zinc-300">
              {bankInfo.contactEmail && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#080203] border border-[#2e1015] flex items-center justify-center text-zinc-400 shrink-0">
                    <Tv className="w-3.5 h-3.5 text-[#d31d38]" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</span>
                    <a href={`mailto:${bankInfo.contactEmail}`} className="text-zinc-300 hover:text-[#ff4d64] font-medium transition-colors break-all">
                      {bankInfo.contactEmail}
                    </a>
                  </div>
                </div>
              )}

              {bankInfo.contactPhone && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#080203] border border-[#2e1015] flex items-center justify-center text-zinc-400 shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Phone Line</span>
                    <a href={`tel:${bankInfo.contactPhone}`} className="text-zinc-300 hover:text-[#ff4d64] font-medium transition-colors">
                      {bankInfo.contactPhone}
                    </a>
                  </div>
                </div>
              )}

              {bankInfo.contactWhatsApp && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#080203] border border-[#2e1015] flex items-center justify-center text-zinc-400 shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">WhatsApp</span>
                    <a 
                      href={bankInfo.contactWhatsApp.startsWith('http') ? bankInfo.contactWhatsApp : `https://wa.me/${bankInfo.contactWhatsApp.replace(/[^0-9]/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-zinc-300 hover:text-emerald-400 font-medium transition-colors truncate block max-w-[200px]"
                    >
                      Connect on WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </div>

            {bankInfo.contactOther && (
              <div className="mt-4 text-[10px] text-zinc-400 font-medium bg-[#080203] py-2 px-3 rounded-lg border border-[#2e1015]">
                <strong>Notice:</strong> {bankInfo.contactOther}
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {/* ================= TAB 8: ACCOUNT & SECURITY ================= */}
        {activeTab === 'account' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
              <h3 className="text-xl font-display font-extrabold text-white mb-1">Subscriber Account Profile</h3>
              <p className="text-xs text-zinc-400 mb-6">Manage your streaming credentials, email verification, and session sync.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Full Name</div>
                  <div className="text-sm font-bold text-white mt-1">{user.fullName}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Username</div>
                  <div className="text-sm font-bold text-white mt-1">@{user.username}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Registered Email</div>
                  <div className="text-sm font-bold text-white mt-1">{user.email || 'None'}</div>
                </div>
                <div className="bg-[#180608] border border-[#2e1015] p-4 rounded-xl">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">Account Status</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1">{user.accountStatus || 'Active'}</div>
                </div>
              </div>

              <div className="pt-6 border-t border-[#2e1015] flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] hover:border-[#d31d38]/50 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
                >
                  <Key className="w-4 h-4 text-[#d31d38]" /> Re-Sync Session Password
                </button>
                <button
                  onClick={() => setShowDeviceModal(true)}
                  className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] hover:border-[#d31d38]/50 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer shadow"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Device Setup Guide
                </button>
                <button
                  onClick={onLogout}
                  className="bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 cursor-pointer ml-auto"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#120507]/95 backdrop-blur-lg border-t border-[#2e1015] p-2 flex justify-around items-center z-40">
        {[
          { id: 'overview', label: 'Home', icon: Tv },
          { id: 'subscription', label: 'Pay', icon: CreditCard },
          { id: 'direct_debit', label: 'Debit', icon: Landmark },
          { id: 'requests', label: 'Request', icon: Film },
          { id: 'affiliate', label: 'Earn', icon: Gift },
          { id: 'account', label: 'More', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer min-w-12 ${
                isSelected ? 'text-[#ff4d64]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1 rounded-lg ${isSelected ? 'bg-[#d31d38]/20 border border-[#d31d38]/30 shadow-[0_0_10px_rgba(211,29,56,0.3)]' : ''}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-[9px] font-bold mt-0.5 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* REQUEST MODAL */}
      {/* Custom Movie/Show Request Modal Form */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#120507] border border-[#2e1015] rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
              <button
                onClick={() => setShowRequestModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition cursor-pointer bg-transparent border-0"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6 text-left">
                <h3 className="text-lg font-display font-extrabold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#ff4d64]" />
                  <span>Request Content</span>
                </h3>
                <p className="text-zinc-400 text-xs mt-1">Submit the movie or TV show you want to watch on Cinode.</p>
              </div>

              <form onSubmit={handleMediaRequestSubmit} className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">Content Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRequestType('movie')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${requestType === 'movie' ? 'bg-[#d31d38]/20 border-[#d31d38] text-[#ff4d64]' : 'bg-[#080203] border-[#2e1015] text-zinc-400 hover:border-zinc-700'}`}
                    >
                      Movie
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType('show')}
                      className={`py-2 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${requestType === 'show' ? 'bg-[#d31d38]/20 border-[#d31d38] text-[#ff4d64]' : 'bg-[#080203] border-[#2e1015] text-zinc-400 hover:border-zinc-700'}`}
                    >
                      TV Show
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full title of movie or show"
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-[#d31d38] transition"
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                  />
                </div>

                {requestType === 'movie' ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-300">Release Year (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2026"
                      className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-[#d31d38] transition"
                      value={requestYear}
                      onChange={(e) => setRequestYear(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="fullSeasonCheckbox"
                        className="rounded border-[#2e1015] text-[#d31d38] focus:ring-[#d31d38]"
                        checked={requestIsFullSeason}
                        onChange={(e) => setRequestIsFullSeason(e.target.checked)}
                      />
                      <label htmlFor="fullSeasonCheckbox" className="text-xs text-zinc-300 font-semibold cursor-pointer select-none">
                        Complete Season (All Episodes)
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase">Season Number</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 1"
                          className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-[#d31d38] transition"
                          value={requestSeason}
                          onChange={(e) => setRequestSeason(e.target.value)}
                        />
                      </div>
                      {!requestIsFullSeason && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase">Episode Number</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 4"
                            className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-[#d31d38] transition"
                            value={requestEpisode}
                            onChange={(e) => setRequestEpisode(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="bg-[#080203] border border-[#2e1015] text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-2.5 px-6 rounded-xl text-xs transition cursor-pointer flex items-center gap-2"
                  >
                    {submittingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* AFFILIATE WITHDRAWAL REQUEST MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#120507] border border-[#2e1015] rounded-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => { setShowWithdrawModal(false); setWithdrawError(null); setWithdrawSuccess(null); }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-[#2e1015] pb-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-display font-extrabold text-white">Affiliate Withdrawal</h3>
                <p className="text-zinc-400 text-xs mt-0.5">Request manual bank transfer of your available earnings</p>
              </div>
            </div>

            {withdrawError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-start gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            {/* Payout Amount Highlight */}
            <div className="mb-5 p-4 bg-[#080203] border border-emerald-500/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Withdrawal Amount</span>
                <span className="text-xs text-zinc-400">100% Available Balance</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  ₦{Number(affiliateStats?.availableEarnings ?? 0).toFixed(2)}
                </span>
                <span className="block text-[10px] text-zinc-500">Full payout amount</span>
              </div>
            </div>

            <div className="p-3 bg-[#180608] border border-[#2e1015] rounded-xl text-zinc-400 text-xs mb-5 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>
                Affiliate withdrawals are processed as a single transaction for the total available balance. An admin will review and manually transfer this amount to your bank account.
              </span>
            </div>

            <form onSubmit={handleWithdrawalRequest} className="space-y-4" id="affiliate-withdraw-form">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Destination Bank</label>
                <select
                  value={withdrawBankName}
                  onChange={(e) => setWithdrawBankName(e.target.value)}
                  className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b} className="bg-[#120507] text-white py-1">{b}</option>
                  ))}
                </select>
              </div>

              {withdrawBankName === 'Other Bank (Type Custom Name)' && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-300">Custom Bank Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your financial institution name"
                    value={withdrawCustomBank}
                    onChange={(e) => setWithdrawCustomBank(e.target.value)}
                    className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Account Number (10 Digits)</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="0123456789"
                  value={withdrawAccountNumber}
                  onChange={(e) => setWithdrawAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Account Holder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Johnathan Doe"
                  value={withdrawAccountName}
                  onChange={(e) => setWithdrawAccountName(e.target.value)}
                  className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowWithdrawModal(false); setWithdrawError(null); }}
                  className="bg-[#080203] border border-[#2e1015] text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={withdrawLoading || Number(affiliateStats?.availableEarnings ?? 0) <= 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {withdrawLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                  Submit Withdrawal Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALL MODALS PRESERVED INTACT */}
      {/* RE-SYNC SESSION CREDENTIALS MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#120507] border border-[#2e1015] rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => { setShowSyncModal(false); setError(null); }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center p-3 bg-[#d31d38]/15 text-[#ff4d64] border border-[#d31d38]/30 rounded-full mb-3 shadow-[0_0_15px_rgba(211,29,56,0.3)]">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-extrabold text-white">Synchronize Session</h3>
              <p className="text-zinc-400 text-xs mt-1">
                Enter your account password to refresh your server login token.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#d31d38]/10 border border-[#d31d38]/30 text-[#ff8093] text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSessionSync} className="space-y-4" id="session-sync-form">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-300">Account Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-[#d31d38] transition"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                />
              </div>

              <button 
                type="submit"
                disabled={syncLoading}
                className="w-full bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-sm disabled:opacity-50 shadow-lg shadow-[#d31d38]/30"
                id="session-sync-submit"
              >
                {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Sync'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SYSTEM NOTIFICATION MODAL (Payment Accepted/Declined) */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#120507] border border-[#2e1015] rounded-2xl p-6 shadow-2xl relative text-center">
            {notificationType === 'accepted' ? (
              <>
                <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-full mb-4 animate-bounce">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-black text-white tracking-tight mb-2">
                  Payment Confirmed! 🎉
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  Your subscription payment of ₦600 has been successfully verified by the administrator! You can now start streaming unlimited 4K movies and TV shows.
                </p>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    setShowManualPay(false);
                    setRedirectCountdown(null);
                    setDeviceNotice(null);
                    setShowDeviceModal(true);
                  }}
                  className="w-full bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold py-3.5 px-6 rounded-xl transition cursor-pointer text-sm shadow-lg shadow-[#d31d38]/30 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current text-white" /> Open Streaming Now {redirectCountdown !== null ? `(${redirectCountdown}s)` : ''}
                </button>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center p-4 bg-[#d31d38]/15 text-[#ff4d64] border border-[#d31d38]/30 rounded-full mb-4">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-black text-white tracking-tight mb-2">
                  Payment Request Declined
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                  We are sorry, but your payment verification request was declined by the administrator.
                </p>
                <div className="bg-[#d31d38]/10 border border-[#d31d38]/20 rounded-xl p-4 mb-6 text-left">
                  <span className="block text-zinc-500 text-[10px] uppercase font-bold tracking-wider mb-1">Reason Provided by Admin:</span>
                  <p className="text-[#ff8093] text-xs font-medium italic leading-relaxed">
                    "{notificationDeclineReason || 'No details provided.'}"
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                  }}
                  className="w-full bg-[#1c080b] hover:bg-[#220a0e] text-white border border-[#2e1015] font-bold py-3 px-6 rounded-xl transition cursor-pointer text-sm"
                >
                  Acknowledge & Retry
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* COMPLETE FULL NOTIFICATION MODAL */}
      {selectedModalNotif && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
            
            <div className="p-6 border-b border-[#2e1015] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-display font-extrabold text-white">{selectedModalNotif.title}</h3>
                <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                  Sent: {new Date(selectedModalNotif.createdAt).toLocaleString()}
                </span>
              </div>
              <button 
                onClick={() => setSelectedModalNotif(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-[#180608] border border-[#2e1015] hover:border-[#d31d38]/50 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh] text-left">
              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
                {selectedModalNotif.message}
              </p>
              
              {selectedModalNotif.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-[#2e1015] bg-[#050102] w-fit max-w-full mt-2">
                  {selectedModalNotif.imageUrl.endsWith('.mp4') || 
                   selectedModalNotif.imageUrl.endsWith('.webm') || 
                   selectedModalNotif.imageUrl.endsWith('.ogg') || 
                   selectedModalNotif.imageUrl.endsWith('.mov') ||
                   selectedModalNotif.imageUrl.includes('/video/') ? (
                    <video 
                      src={selectedModalNotif.imageUrl} 
                      controls 
                      className="max-w-full h-auto rounded-lg block" 
                    />
                  ) : (
                    <img 
                      src={selectedModalNotif.imageUrl} 
                      alt={selectedModalNotif.title} 
                      referrerPolicy="no-referrer" 
                      className="max-w-full h-auto rounded-lg block" 
                    />
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-[#080203] border-t border-[#2e1015] flex justify-end">
              <button 
                onClick={() => setSelectedModalNotif(null)}
                className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE SELECTION MODAL */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[120]">
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-left">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d31d38] via-[#ff3b53] to-[#d31d38]"></div>
            
            <div className="p-6 border-b border-[#2e1015] flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-[#ff4d64] uppercase tracking-wider block mb-0.5">Stream Launcher</span>
                <h3 className="text-xl font-display font-extrabold text-white">Select Your Device</h3>
                <p className="text-zinc-400 text-xs mt-1">Which device are you streaming on today?</p>
              </div>
              <button 
                onClick={() => { setShowDeviceModal(false); setDeviceNotice(null); }}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-[#180608] border border-[#2e1015] hover:border-[#d31d38]/50 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5">
              {deviceNotice && (
                <div className="p-3.5 bg-[#d31d38]/10 border border-[#d31d38]/30 text-[#ff8093] text-xs rounded-xl mb-2 flex items-start justify-between gap-2">
                  <span>{deviceNotice}</span>
                  <button 
                    onClick={() => setDeviceNotice(null)}
                    className="text-zinc-400 hover:text-white shrink-0 text-xs font-bold"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* Option 1: iPhone / iOS */}
              <button
                type="button"
                onClick={() => {
                  if (systemStatus?.iosDownloadUrl) {
                    window.open(systemStatus.iosDownloadUrl, '_blank');
                    setShowDeviceModal(false);
                  } else {
                    setDeviceNotice("The iOS app link is currently being configured by our admins. You can continue watching directly in your Web Browser!");
                  }
                }}
                className="w-full bg-[#080203] hover:bg-[#180608] border border-[#2e1015] hover:border-[#d31d38]/60 p-4 rounded-xl text-left transition cursor-pointer group flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-[#180608] border border-[#2e1015] rounded-xl flex items-center justify-center text-white group-hover:border-[#d31d38]/60 group-hover:bg-[#d31d38]/15 transition">
                    <svg className="w-5 h-5 fill-current text-white group-hover:text-[#ff4d64] transition" viewBox="0 0 24 24">
                      <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-white block group-hover:text-[#ff4d64] transition">
                      iPhone / iPad (iOS)
                    </span>
                    <span className="text-zinc-400 text-xs block mt-0.5">
                      Open or download official iOS mobile app
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#ff4d64] transition" />
              </button>

              {/* Option 2: Android Phone / Tablet */}
              <button
                type="button"
                onClick={() => {
                  if (systemStatus?.androidDownloadUrl) {
                    window.open(systemStatus.androidDownloadUrl, '_blank');
                    setShowDeviceModal(false);
                  } else {
                    setDeviceNotice("The Android Play Store app link is currently being configured by our admins. You can continue watching directly in your Web Browser!");
                  }
                }}
                className="w-full bg-[#080203] hover:bg-[#180608] border border-[#2e1015] hover:border-[#d31d38]/60 p-4 rounded-xl text-left transition cursor-pointer group flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-[#180608] border border-[#2e1015] rounded-xl flex items-center justify-center text-white group-hover:border-[#d31d38]/60 group-hover:bg-[#d31d38]/15 transition">
                    <svg className="w-5 h-5 fill-current text-white group-hover:text-[#ff4d64] transition" viewBox="0 0 24 24">
                      <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-white block group-hover:text-[#ff4d64] transition">
                      Android Phone / Tablet
                    </span>
                    <span className="text-zinc-400 text-xs block mt-0.5">
                      Download app on Google Play Store
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#ff4d64] transition" />
              </button>

              {/* Option 3: Web Browser / PC / Smart TV */}
              <button
                type="button"
                onClick={() => {
                  setShowDeviceModal(false);
                  launchStreaming('');
                }}
                className="w-full bg-[#080203] hover:bg-[#180608] border border-[#2e1015] hover:border-emerald-500/40 p-4 rounded-xl text-left transition cursor-pointer group flex items-center justify-between shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 bg-[#180608] border border-[#2e1015] rounded-xl flex items-center justify-center text-white group-hover:border-emerald-500/50 group-hover:bg-emerald-500/10 transition">
                    <Tv className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-white block group-hover:text-emerald-400 transition">
                      Web Browser / PC / Smart TV
                    </span>
                    <span className="text-zinc-400 text-xs block mt-0.5">
                      Watch instantly in browser with auto sign-in
                    </span>
                  </div>
                </div>
                <Play className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition fill-current" />
              </button>
            </div>

            <div className="p-4 bg-[#080203] border-t border-[#2e1015] flex justify-end">
              <button 
                onClick={() => { setShowDeviceModal(false); setDeviceNotice(null); }}
                className="bg-[#180608] hover:bg-[#220a0e] text-white border border-[#2e1015] font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQUAD DIRECT DEBIT SETUP MODAL */}
      {showDirectDebitModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#120507] border border-[#2e1015] rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="p-5 border-b border-[#2e1015] flex items-center justify-between bg-[#080203]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-extrabold text-white">Automated Direct Debit</h3>
                  <p className="text-[11px] text-zinc-400">Powered by Squad (HabariPay)</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowDirectDebitModal(false); setDirectDebitError(null); setDirectDebitSuccess(null); }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#180608] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs">
                <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-zinc-300 leading-relaxed">
                  <strong className="text-white block font-semibold mb-0.5">Recurring Monthly Renewal (₦600/month)</strong>
                  Setting up a Direct Debit mandate guarantees that your streaming access never expires. Charges are processed automatically every 30 days. You can cancel at any time.
                </div>
              </div>

              {directDebitError && (
                <div className="p-3 bg-[#d31d38]/10 border border-[#d31d38]/25 text-[#ff8093] text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff4d64]" />
                  <span>{directDebitError}</span>
                </div>
              )}

              {directDebitSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{directDebitSuccess}</span>
                </div>
              )}

              {directDebitStep === 'input' && (
                <form onSubmit={handleCreateMandate} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">Select Bank</label>
                    <select
                      value={selectedBankCode}
                      onChange={(e) => setSelectedBankCode(e.target.value)}
                      required
                      className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                    >
                      {directDebitBanks.length === 0 ? (
                        <option value="">Loading Nigerian Banks...</option>
                      ) : (
                        directDebitBanks.map((bank) => (
                          <option key={bank.code} value={bank.code}>
                            {bank.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">10-Digit NUBAN Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="e.g. 0123456789"
                      value={directDebitAccountNo}
                      onChange={(e) => setDirectDebitAccountNo(e.target.value.replace(/[^0-9]/g, ''))}
                      required
                      className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs font-mono focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">Account Holder Name (Optional)</label>
                    <input
                      type="text"
                      placeholder={user.fullName || user.username}
                      value={directDebitAccountName}
                      onChange={(e) => setDirectDebitAccountName(e.target.value)}
                      className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={directDebitLoading}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs shadow-lg shadow-purple-950/30 disabled:opacity-50"
                    >
                      {directDebitLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Authorizing with Bank...
                        </>
                      ) : (
                        <>
                          <Landmark className="w-4 h-4" /> Authorize & Request Bank OTP
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {directDebitStep === 'otp' && (
                <form onSubmit={handleValidateMandateOtp} className="space-y-4">
                  <div className="p-3 bg-[#080203] border border-purple-500/30 rounded-xl text-center">
                    <p className="text-xs text-purple-300 font-medium">
                      An OTP authorization code was sent by your bank to your registered phone number / email.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">Enter OTP Code</label>
                    <input
                      type="text"
                      maxLength={8}
                      placeholder="e.g. 123456"
                      value={directDebitOtp}
                      onChange={(e) => setDirectDebitOtp(e.target.value)}
                      required
                      autoFocus
                      className="w-full bg-[#080203] border border-[#2e1015] rounded-xl py-3 px-3 text-white text-center text-lg font-mono tracking-widest focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={directDebitLoading}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs shadow-lg disabled:opacity-50"
                    >
                      {directDebitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      <span>Validate & Activate Mandate</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResendMandateOtp}
                      disabled={resendingOtp}
                      className="bg-[#180608] hover:bg-[#220a0e] text-zinc-300 border border-[#2e1015] font-bold py-2.5 px-3 rounded-xl transition cursor-pointer text-xs flex items-center gap-1 disabled:opacity-50"
                    >
                      {resendingOtp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span>Resend OTP</span>
                    </button>
                  </div>
                </form>
              )}

              {directDebitStep === 'success' && (
                <div className="text-center py-4 space-y-4">
                  <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-extrabold text-white">Direct Debit Activated!</h4>
                  <p className="text-xs text-zinc-300 leading-relaxed max-w-xs mx-auto">
                    Your bank account is now configured for automatic monthly renewal. Your streaming subscription is active!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectDebitModal(false);
                      setDirectDebitStep('input');
                      setDirectDebitError(null);
                      setDirectDebitSuccess(null);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
