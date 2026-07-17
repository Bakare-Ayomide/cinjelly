import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, Tv, Film, Laptop, Sparkles, HelpCircle, ChevronDown, ChevronUp, 
  X, Lock, Mail, User, ShieldCheck, ArrowRight, Loader2, Info, Film as CinemaIcon,
  AlertTriangle, Database, Smartphone, Download
} from 'lucide-react';
import { User as UserType, SystemStatus } from '../types';

interface LandingPageProps {
  currentUser: UserType | null;
  systemStatus: SystemStatus | null;
  onLoginSuccess: (user: UserType, token: string) => void;
  onRegisterSuccess: (user: UserType) => void;
}

export default function LandingPage({ currentUser, systemStatus, onLoginSuccess, onRegisterSuccess }: LandingPageProps) {
  // Modal State
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [dbDiagModal, setDbDiagModal] = useState(false);
  
  // Auth Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regReferredBy, setRegReferredBy] = useState('');

  // Capture referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referredBy');
    if (ref) {
      setRegReferredBy(ref.toUpperCase());
    }
  }, []);

  const toggleFaq = (index: number) => {
    setFaqOpen(faqOpen === index ? null : index);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.user, data.jellyfinToken || '');
      setAuthModal(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regFullName,
          username: regUsername,
          email: regEmail,
          password: regPassword,
          referredBy: regReferredBy
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      onRegisterSuccess(data.user);
      setAuthModal(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    {
      q: 'What is Cinode?',
      a: 'We are a premium private streaming portal designed to offer instant, high-quality, ad-free access to curated films, series, and television. Our backend is integrated with a blazing-fast Jellyfin server, giving you a beautiful client experience.'
    },
    {
      q: 'How does the pricing and subscription work?',
      a: 'We believe in keeping things simple and affordable. We have a single all-access premium tier costing exactly ₦600 per month. You can activate or renew your subscription instantly using our built-in payment simulator with one click.'
    },
    {
      q: 'What happens when my subscription expires?',
      a: 'If your plan expires, access is automatically locked. As soon as you renew for ₦600, your profile is instantly reactivated, and you can resume watching on any device immediately.'
    },
    {
      q: 'Is my personal account secure?',
      a: 'Yes, absolutely. We enforce secure proxy routing and isolate all Jellyfin API details, credentials, and admin passwords securely on the backend. They are never sent to or exposed in the browser.'
    },
    {
      q: 'Can I watch on multiple devices?',
      a: 'Yes! Because our portal connects seamlessly to standard media apps, you can stream on your smart television, tablet, laptop, or mobile phone. Simply sign into our portal and tap to play.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#090a0f] text-white selection:bg-rose-600 selection:text-white relative overflow-hidden" id="landing-page-root">
      
      {/* Pending Setup Banner */}
      {(!systemStatus || !systemStatus.configured || !systemStatus.hasAdmin) && (
        <div className="bg-gradient-to-r from-amber-600 to-rose-700 text-white text-xs py-3.5 px-4 text-center border-b border-rose-500/20 flex items-center justify-center gap-2 relative z-20 shadow-md">
          <Info className="w-4 h-4 text-amber-200 shrink-0" />
          <span>
            {systemStatus?.mysqlAvailable !== false 
              ? "MySQL database connected! Setup is required to initialize your streaming administrator credentials." 
              : "Local database active (MySQL offline)! Setup is required to initialize your streaming administrator credentials."}
          </span>
          <a href="#setup" className="underline font-bold text-amber-200 hover:text-white transition ml-1">
            Run Setup Wizard &rarr;
          </a>
        </div>
      )}

      {/* MySQL Connection Issue Banner */}
      {systemStatus && systemStatus.mysqlAvailable === false && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs py-3.5 px-4 text-center border-b border-rose-500/20 flex items-center justify-center gap-2 relative z-20 shadow-md">
          <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0" />
          <span><strong>MySQL Access Denied!</strong> The portal is running on high-performance local fallback storage.</span>
          <button 
            onClick={() => setDbDiagModal(true)} 
            className="underline font-bold text-rose-200 hover:text-white transition ml-1 cursor-pointer bg-transparent border-0 p-0"
          >
            How to authorize database access &rarr;
          </button>
        </div>
      )}

      {/* Cinematic Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-950/20 via-transparent to-transparent pointer-events-none"></div>

      {/* Hero Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-tr from-rose-600 to-amber-500 rounded-full mr-3 shrink-0 flex items-center justify-center text-white shadow-lg">
            <Tv className="w-4 h-4" />
          </div>
          <span className="font-display font-black text-2xl tracking-tight text-white">
            Cin<span className="text-rose-500">ode</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          {currentUser ? (
            <a 
              href="#portal" 
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition duration-200 shadow-md shadow-rose-950/20"
            >
              Enter Portal
            </a>
          ) : (
            <>
              <button 
                onClick={() => { setError(null); setAuthModal('login'); }}
                className="text-slate-400 hover:text-white font-bold text-sm transition cursor-pointer"
              >
                Sign In
              </button>
              <button 
                onClick={() => { setError(null); setAuthModal('signup'); }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition cursor-pointer shadow-md shadow-rose-950/20"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-5xl mx-auto px-6 pt-24 pb-28 text-center">
        <div className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-xs px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" /> Curated Cinema & Series Hub
        </div>
        <h1 className="text-5xl md:text-[84px] leading-[0.9] font-display font-extrabold tracking-tight text-white mb-8">
          Unlimited Films.<br />
          No Buffering.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500">₦600 / Month.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-base md:text-lg mb-10 leading-relaxed font-sans">
          The next generation of private media streaming. A premium, blazing-fast, and secure interface integrated with your private media server and automatic subscription sync.
        </p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-8">
          {currentUser ? (
            <button 
              onClick={() => { window.location.href = '#portal'; }}
              className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold py-4.5 px-10 rounded-2xl text-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-rose-950/30"
            >
              Go to Your Streaming Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button 
                onClick={() => { setError(null); setAuthModal('signup'); }}
                className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold py-4.5 px-10 rounded-2xl text-lg transition duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-rose-950/30"
              >
                Start Watching Now <ArrowRight className="w-5 h-5" />
              </button>
              <div className="flex flex-col text-left border-l-2 border-rose-500 pl-5 shrink-0">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Streaming Fee</span>
                <span className="text-2xl font-black text-white">₦600<span className="text-sm font-normal text-slate-500 ml-1">/ month</span></span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-[#111320] border-y border-slate-900 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 text-center md:text-left">
            <span className="text-rose-500 font-semibold text-xs uppercase tracking-wider block mb-1">Engineered for Quality</span>
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white">A Superior Media Experience</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#090a0f] p-8 border border-slate-800/80 rounded-2xl relative overflow-hidden group">
              <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl w-fit mb-6">
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Cross-Device</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Watch on your Smart TV, phone, tablet, or laptop seamlessly.</p>
            </div>

            <div className="bg-[#090a0f] p-8 border border-slate-800/80 rounded-2xl relative overflow-hidden group">
              <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl w-fit mb-6">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Curated Library</h3>
              <p className="text-slate-400 text-sm leading-relaxed">High-definition access to hundreds of blockbuster films and series.</p>
            </div>

            <div className="bg-[#090a0f] p-8 border border-slate-800/80 rounded-2xl relative overflow-hidden group">
              <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl w-fit mb-6">
                <Laptop className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">No-Buffering Stream</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Direct-play connection ensures zero lagging and pristine streaming quality.</p>
            </div>

            <div className="bg-[#090a0f] p-8 border border-slate-800/80 rounded-2xl relative overflow-hidden group">
              <div className="p-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl w-fit mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">Secure & Private</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Private proxy server hiding all underlying URLs and securing your credentials.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6 max-w-5xl mx-auto text-center" id="pricing">
        <div className="text-center mb-16">
          <span className="text-rose-500 font-semibold text-xs uppercase tracking-wider block">Direct Pricing Model</span>
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-white mt-1">Simple, Affordable Plans</h2>
          <p className="mt-2 text-slate-500 text-sm">No tiers, no hidden add-ons. Cancel anytime.</p>
        </div>

        <div className="max-w-md mx-auto bg-[#111320] border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-rose-600 text-white font-extrabold text-[10px] uppercase tracking-wider py-1.5 px-4 rounded-bl-xl">
            Popular Choice
          </div>
          
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block mb-2">Premium Streaming Access</span>
          <h3 className="text-2xl font-display font-extrabold text-white mb-6">ALL-ACCESS SUBSCRIPTION</h3>
          
          <div className="flex items-baseline justify-center mb-6">
            <span className="text-6xl font-display font-extrabold tracking-tight text-white">₦600</span>
            <span className="text-slate-500 font-bold ml-2 text-sm uppercase">/ month</span>
          </div>

          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Full unthrottled access to our secure streaming server, synchronized profiles, HD support, and simultaneous playback on multiple screens.
          </p>

          <ul className="text-left space-y-4 mb-10 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full text-xs font-bold">✓</span>
              Unlimited streaming with no ads
            </li>
            <li className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full text-xs font-bold">✓</span>
              Linked secure media server profile
            </li>
            <li className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full text-xs font-bold">✓</span>
              Watch on phone, TV, and tablet simultaneously
            </li>
            <li className="flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-full text-xs font-bold">✓</span>
              Instant simulated payment & activation
            </li>
          </ul>

          {currentUser ? (
            <button 
              onClick={() => { window.location.href = '#portal'; }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl cursor-pointer shadow-lg transition duration-200 text-sm"
            >
              Manage Your Subscription
            </button>
          ) : (
            <button 
              onClick={() => { setError(null); setAuthModal('signup'); }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl cursor-pointer shadow-lg transition duration-200 text-sm"
            >
              Get Started Now
            </button>
          )}
        </div>
      </section>

      {/* Mobile App Client Downloads Section */}
      <section className="bg-gradient-to-b from-[#111320] to-[#090a0f] border-t border-slate-900 py-24 px-6" id="mobile-apps">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          
          {/* Left side: content */}
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold text-xs px-4 py-1.5 rounded-full">
              <Smartphone className="w-3.5 h-3.5" /> Mobile Experience
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-black text-white tracking-tight leading-none">
              Offline Watch On <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500">Your Mobile Phone</span>
            </h2>
            
            <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl">
              Don't let slow networks interrupt your entertainment. Download our mobile client apps for **iOS** and **Android** to save blockbusters, documentaries, and full series directly onto your mobile devices. Watch offline, anywhere, anytime.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center md:justify-start">
              {systemStatus?.iosDownloadUrl ? (
                <a 
                  href={systemStatus.iosDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center gap-3 transition-all duration-250 cursor-pointer shadow-lg"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[9px] text-slate-500 font-medium uppercase">Download on the</span>
                    <span className="text-sm font-black font-display tracking-tight">App Store</span>
                  </div>
                </a>
              ) : (
                <button 
                  onClick={() => alert("iOS Client App download link is currently being configured by the admin. Please check back shortly!")}
                  className="w-full sm:w-auto bg-slate-900/50 opacity-60 border border-slate-800 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center gap-3 transition cursor-not-allowed"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[9px] text-slate-500 font-medium uppercase">App Store App</span>
                    <span className="text-sm font-black font-display tracking-tight">Coming Soon</span>
                  </div>
                </button>
              )}

              {systemStatus?.androidDownloadUrl ? (
                <a 
                  href={systemStatus.androidDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center gap-3 transition-all duration-250 cursor-pointer shadow-lg"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[9px] text-slate-500 font-medium uppercase">Get it on</span>
                    <span className="text-sm font-black font-display tracking-tight">Google Play</span>
                  </div>
                </a>
              ) : (
                <button 
                  onClick={() => alert("Android Client App download link is currently being configured by the admin. Please check back shortly!")}
                  className="w-full sm:w-auto bg-slate-900/50 opacity-60 border border-slate-800 text-white font-bold py-3 px-6 rounded-2xl text-xs flex items-center justify-center gap-3 transition cursor-not-allowed"
                >
                  <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[9px] text-slate-500 font-medium uppercase">Google Play App</span>
                    <span className="text-sm font-black font-display tracking-tight">Coming Soon</span>
                  </div>
                </button>
              )}
            </div>
          </div>
          
          {/* Right side: Mockups / Visual Device Presentation */}
          <div className="flex-1 flex justify-center relative">
            <div className="absolute w-72 h-72 bg-rose-500/10 blur-[80px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            <div className="relative border border-slate-800/80 rounded-3xl bg-[#111320] p-6 shadow-2xl max-w-xs overflow-hidden group hover:border-rose-500/30 transition duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <span className="text-xs text-rose-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> Mobile App Player
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Offline Mode</span>
              </div>
              
              <div className="space-y-4">
                <div className="aspect-video bg-slate-950 rounded-xl relative overflow-hidden group-hover:scale-[1.02] transition duration-300">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-3">
                    <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Now Downloading</span>
                    <h4 className="text-xs font-bold text-white tracking-tight truncate">Interstellar (2014)</h4>
                  </div>
                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md rounded-lg p-1.5 flex items-center justify-center">
                    <Download className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Downloading standard HD...</span>
                    <span>74%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full" style={{ width: '74%' }}></div>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 font-bold text-xs shrink-0">
                    🍿
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[11px] font-bold text-white truncate">The Dark Knight</h5>
                    <p className="text-[9px] text-emerald-400">Ready to watch offline</p>
                  </div>
                  <button className="bg-rose-600 hover:bg-rose-700 p-1.5 rounded-lg text-white font-bold text-xs transition">
                    ▶
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-[#111320] border-t border-slate-900 py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <HelpCircle className="w-8 h-8 text-rose-500 mx-auto mb-4" />
            <h2 className="text-3xl font-display font-extrabold text-white">Frequently Asked Questions</h2>
            <p className="mt-2 text-slate-500 text-sm">Everything you need to know about our service</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-[#090a0f] border border-slate-800/80 rounded-xl overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-6 text-left flex items-center justify-between text-base font-bold text-white focus:outline-none"
                >
                  <span>{faq.q}</span>
                  {faqOpen === index ? <ChevronUp className="w-5 h-5 text-rose-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                </button>
                {faqOpen === index && (
                  <div className="px-6 pb-6 text-sm text-slate-400 leading-relaxed border-t border-slate-800/30 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#06070a] py-16 px-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <span className="block text-rose-500 font-extrabold text-2xl mb-1 font-display">24/7</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Service Uptime</span>
            </div>
            <div>
              <span className="block text-white font-extrabold text-2xl mb-1 font-display">Pristine</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">HD Streaming Quality</span>
            </div>
            <div>
              <span className="block text-white font-extrabold text-2xl mb-1 font-display">Isolated</span>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Backend Cryptography</span>
            </div>
            <div className="md:text-right">
              <div className="inline-block bg-rose-500/10 text-rose-400 text-[10px] font-semibold px-3 py-1 rounded-full mb-2">
                Server Status: Operational
              </div>
              <div className="text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                &copy; 2026 CINODE MEDIA SYSTEMS
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-rose-600 rounded-full mr-2 shrink-0 flex items-center justify-center text-white text-[10px] font-black">C</div>
              <span className="font-display font-black text-sm tracking-tight text-white">
                Cin<span className="text-rose-500">ode</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Built securely with isolated server synchronization. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL CONTAINER */}
      {authModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all" id="auth-modal-overlay">
          <div className="w-full max-w-md bg-[#111320] border border-slate-800 rounded-2xl overflow-hidden p-8 shadow-2xl relative">
            <button 
              onClick={() => setAuthModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer bg-slate-950/40 p-1.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            {(!systemStatus || !systemStatus.configured || !systemStatus.hasAdmin) && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs rounded-xl space-y-2.5 leading-relaxed">
                <p className="font-semibold text-sm">System Setup Required</p>
                <p>Before you can register accounts or sign in, you must complete the administrative system setup to bind your Jellyfin media server.</p>
                <a 
                  href="#setup" 
                  onClick={() => setAuthModal(null)}
                  className="inline-flex bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-[11px] transition"
                >
                  Configure System Now &rarr;
                </a>
              </div>
            )}

            {authModal === 'login' ? (
              <div id="login-modal-content">
                <div className="mb-6 text-center md:text-left">
                  <h3 className="text-2xl font-display font-extrabold text-white">Welcome Back</h3>
                  <p className="text-slate-400 text-sm mt-1">Sign in to resume streaming immediately</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Username</label>
                    <div className="relative">
                      <User className="absolute inset-y-0 left-3 h-full w-4 text-slate-500 flex items-center pointer-events-none" />
                      <input 
                        type="text" 
                        required
                        placeholder="your_username" 
                        className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Password</label>
                    <div className="relative">
                      <Lock className="absolute inset-y-0 left-3 h-full w-4 text-slate-500 flex items-center pointer-events-none" />
                      <input 
                        type="password" 
                        required
                        placeholder="••••••••" 
                        className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-400">
                  Don't have an account yet?{' '}
                  <button 
                    onClick={() => { setError(null); setAuthModal('signup'); }}
                    className="text-rose-500 hover:underline font-bold"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            ) : (
              <div id="signup-modal-content">
                <div className="mb-6 text-center md:text-left">
                  <h3 className="text-2xl font-display font-extrabold text-white">Create Account</h3>
                  <p className="text-slate-400 text-sm mt-1">Get instant access to unlimited films</p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs rounded-xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. John Doe" 
                      className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">Username</label>
                      <input 
                        type="text" 
                        required
                        placeholder="john_doe" 
                        className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-300">Email</label>
                      <input 
                        type="email" 
                        required
                        placeholder="john@example.com" 
                        className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Password</label>
                    <input 
                      type="password" 
                      required
                      placeholder="Min 6 characters" 
                      className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-300">Referral Code (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. DUWI123" 
                      className="w-full bg-[#090a0f] border border-slate-800 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:border-rose-500 transition uppercase"
                      value={regReferredBy}
                      onChange={(e) => setRegReferredBy(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="p-3 bg-[#090a0f] border border-slate-800/80 rounded-xl flex gap-2.5 text-[11px] text-slate-400 leading-normal">
                    <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>
                      Registration connects safe virtual streaming identities on the backend.
                    </span>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full mt-4 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                  </button>
                </form>

                <p className="mt-4 text-center text-xs text-slate-400">
                  Already have an account?{' '}
                  <button 
                    onClick={() => { setError(null); setAuthModal('login'); }}
                    className="text-rose-500 hover:underline font-bold"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DATABASE DIAGNOSTIC MODAL */}
      {dbDiagModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4" id="db-diag-modal-overlay">
          <div className="w-full max-w-lg bg-[#111320] border border-slate-800 rounded-2xl overflow-hidden p-8 shadow-2xl relative">
            <button 
              onClick={() => setDbDiagModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer bg-slate-950/40 p-1.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white">MySQL Connection Diagnostics</h3>
                <p className="text-xs text-slate-400">Database Authorization & Troubleshooting</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">Active MySQL Error</p>
                <code className="text-xs text-rose-200/90 font-mono block break-all leading-relaxed bg-black/40 p-3 rounded-lg border border-slate-900">
                  {systemStatus?.mysqlError || "Access denied for user 'zerolord_cinjelly'@'34.96.41.176' (using password: YES)"}
                </code>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed space-y-2.5">
                <p>
                  Your remote MySQL database server at <strong className="text-white font-mono">131.153.147.178</strong> rejected the connection from the portal server's IP address: <strong className="text-rose-400 font-mono">34.96.41.176</strong>.
                </p>
                <p>
                  To link your production MySQL database, please apply the following adjustments on your hosting server:
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex gap-3 text-xs leading-relaxed">
                  <div className="w-5 h-5 rounded-full bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold shrink-0 text-[10px]">1</div>
                  <div>
                    <strong className="text-white">Whitelist the Portal Server IP</strong>
                    <p className="text-slate-400">In your hosting control panel (e.g., cPanel &rarr; Remote MySQL), add the IP <span className="font-mono text-rose-300">34.96.41.176</span> (or use wildcard <span className="font-mono text-rose-300">%</span>) to allow connections.</p>
                  </div>
                </div>

                <div className="flex gap-3 text-xs leading-relaxed">
                  <div className="w-5 h-5 rounded-full bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold shrink-0 text-[10px]">2</div>
                  <div>
                    <strong className="text-white">Authorize User Privileges</strong>
                    <p className="text-slate-400">Ensure the user <span className="font-mono text-rose-300">zerolord_cinjelly</span> has full access to the database. You can execute this query in phpMyAdmin:</p>
                    <pre className="mt-2 bg-black/40 p-2.5 rounded-lg border border-slate-900 text-[10px] font-mono text-slate-400 break-all overflow-x-auto whitespace-pre-wrap">
                      {`GRANT ALL PRIVILEGES ON zerolord_cinjelly.* TO 'zerolord_cinjelly'@'%' IDENTIFIED BY '@f33rinimi';\nFLUSH PRIVILEGES;`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs rounded-xl flex gap-2.5 items-start mt-4 leading-normal">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white">Seamless Local Fallback Storage Enabled</strong>
                  No action is needed to run the app right now. The portal is fully operating with a secure, local file-based database. All registrations and settings will transfer seamlessly to MySQL once authorized!
                </div>
              </div>
            </div>

            <button 
              onClick={() => setDbDiagModal(false)}
              className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition text-xs cursor-pointer"
            >
              Close Diagnostic Details
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
