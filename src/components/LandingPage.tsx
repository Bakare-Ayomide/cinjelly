import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, Tv, Film, Laptop, Sparkles, HelpCircle, ChevronDown, ChevronUp, 
  X, Lock, User, ShieldCheck, ArrowRight, Loader2, Info, 
  AlertTriangle, Database, Smartphone, Download, Star, Flame, Play, Zap, 
  CheckCircle2, Copy, Menu, Radio
} from 'lucide-react';
import { User as UserType, SystemStatus } from '../types';

import heroBg from '../assets/images/hero_poster_wall_1784858989562.jpg';
import showcaseBg from '../assets/images/showcase_poster_wall_1784859002323.jpg';

interface LandingPageProps {
  currentUser: UserType | null;
  systemStatus: SystemStatus | null;
  onLoginSuccess: (user: UserType, token: string) => void;
  onRegisterSuccess: (user: UserType) => void;
}

interface MovieItem {
  id: string;
  title: string;
  category: 'action' | 'scifi' | 'series' | 'anime';
  year: string;
  rating: string;
  quality: string;
  duration: string;
  cover: string;
  backdrop: string;
  tag: string;
  desc: string;
}

const MOVIES: MovieItem[] = [
  {
    id: 'm1',
    title: 'Dune: Part Two',
    category: 'scifi',
    year: '2024',
    rating: '9.8',
    quality: '4K HDR',
    duration: '2h 46m',
    cover: 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s52Su3C.jpg',
    tag: '🔥 TOP 1 TRENDING',
    desc: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.'
  },
  {
    id: 'm2',
    title: 'Spider-Man: Across the Spider-Verse',
    category: 'action',
    year: '2023',
    rating: '9.7',
    quality: '4K Ultra HD',
    duration: '2h 20m',
    cover: 'https://image.tmdb.org/t/p/w500/6Keegp1IOXqeZPPJlCub3W1Bogc.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/4nM228L3FxRAtA23158R1293.jpg',
    tag: '✨ FAN FAVORITE',
    desc: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.'
  },
  {
    id: 'm3',
    title: 'Oppenheimer',
    category: 'scifi',
    year: '2023',
    rating: '9.6',
    quality: 'IMAX 4K',
    duration: '3h 00m',
    cover: 'https://image.tmdb.org/t/p/w500/jtTHxuJhuZpFAnCI4vGjg1LGmpY.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/fm6K3P93A39L9K.jpg',
    tag: '🏆 7 OSCAR WINNER',
    desc: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.'
  },
  {
    id: 'm4',
    title: 'Stranger Things',
    category: 'series',
    year: '2025',
    rating: '9.9',
    quality: '4K BINGE',
    duration: 'Full Series',
    cover: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/56v2K2332L29.jpg',
    tag: '🍿 BINGE MUST',
    desc: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.'
  },
  {
    id: 'm5',
    title: 'Cyberpunk: Edgerunners',
    category: 'anime',
    year: '2024',
    rating: '9.5',
    quality: '4K HDR',
    duration: '10 Eps',
    cover: 'https://image.tmdb.org/t/p/w500/lqcDVZ8pyk08AVftMBildDR3QUK.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/Cyberpunk.jpg',
    tag: '⚡ NEON MASTERPIECE',
    desc: 'A street kid trying to survive in a technology and body modification-obsessed city of the future.'
  },
  {
    id: 'm6',
    title: 'Gladiator II',
    category: 'action',
    year: '2024',
    rating: '9.4',
    quality: '4K HDR',
    duration: '2h 28m',
    cover: 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/gladiator2.jpg',
    tag: '⚔️ EPIC ACTION',
    desc: 'Years after witnessing the death of Maximus, Lucius enters the Colosseum to restore glory to Rome.'
  },
  {
    id: 'm7',
    title: 'Arcane',
    category: 'anime',
    year: '2024',
    rating: '9.9',
    quality: '4K Ultra HD',
    duration: 'Season 2',
    cover: 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/arcane.jpg',
    tag: '🌟 HIGHEST RATED',
    desc: 'Amidst the escalating feud between Piltover and Zaun, sisters Vi and Jinx find themselves on opposing sides.'
  },
  {
    id: 'm8',
    title: 'Interstellar',
    category: 'scifi',
    year: '2014',
    rating: '9.8',
    quality: 'IMAX 4K',
    duration: '2h 49m',
    cover: 'https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/interstellar.jpg',
    tag: '🌌 SCI-FI CLASSIC',
    desc: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.'
  },
  {
    id: 'm9',
    title: 'Severance',
    category: 'series',
    year: '2024',
    rating: '9.6',
    quality: '4K HDR',
    duration: 'Season 2',
    cover: 'https://image.tmdb.org/t/p/w500/4tblBrslcKSifMVZ3TmtT2ukMor.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/severance.jpg',
    tag: '🧠 MIND BENDING',
    desc: 'Mark leads a team of office workers whose memories have been surgically divided between work and personal lives.'
  },
  {
    id: 'm10',
    title: 'The Dark Knight',
    category: 'action',
    year: '2008',
    rating: '9.9',
    quality: '4K Remaster',
    duration: '2h 32m',
    cover: 'https://image.tmdb.org/t/p/w500/xGSOgu01djJmKGAiWgeqIfpYvs4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/darkknight.jpg',
    tag: '🦇 LEGENDARY',
    desc: 'When the menace known as the Joker wreaks havoc on Gotham, Batman must accept one of the greatest psychological tests.'
  },
  {
    id: 'm11',
    title: 'Deadpool & Wolverine',
    category: 'action',
    year: '2024',
    rating: '9.5',
    quality: '4K HDR',
    duration: '2h 08m',
    cover: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv3U25S43.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/deadpool.jpg',
    tag: '💥 BLOCKBUSTER',
    desc: 'Wolverine is recovering from his injuries when he crosses paths with the loudmouth Deadpool.'
  },
  {
    id: 'm12',
    title: 'Silo',
    category: 'series',
    year: '2024',
    rating: '9.4',
    quality: '4K HDR',
    duration: 'Season 2',
    cover: 'https://image.tmdb.org/t/p/w500/gMYZZvnkVNTqSVnVCphWbPXwWwb.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/silo.jpg',
    tag: '🚀 APPLE TV+ HIT',
    desc: 'Men and women live in a giant underground silo with several regulations which they believe are in place to protect them.'
  },
  {
    id: 'm13',
    title: 'Ted Lasso',
    category: 'series',
    year: '2023',
    rating: '9.7',
    quality: '4K HDR',
    duration: '3 Seasons',
    cover: 'https://image.tmdb.org/t/p/w500/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/tedlasso.jpg',
    tag: '⚽ COMEDY FAV',
    desc: 'An American football coach is hired to manage a British soccer team. What he lacks in knowledge, he makes up for with optimism.'
  },
  {
    id: 'm14',
    title: 'House of the Dragon',
    category: 'series',
    year: '2024',
    rating: '9.6',
    quality: '4K HDR',
    duration: 'Season 2',
    cover: 'https://image.tmdb.org/t/p/w500/7V0Ebks0GgpKvQ7QbLAIdX5dos4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/hotd.jpg',
    tag: '🐉 EPIC FANTASY',
    desc: 'The Targaryen dynasty is at the absolute height of its power, with more than 15 dragons under their command.'
  },
  {
    id: 'm15',
    title: 'Love Island USA',
    category: 'series',
    year: '2024',
    rating: '9.2',
    quality: '1080p HD',
    duration: 'Season 6',
    cover: 'https://image.tmdb.org/t/p/w500/zw7YC3U0PWhqR3cz0YgUL8RvZFA.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/loveisland.jpg',
    tag: '🌴 REALITY SHOW',
    desc: 'A group of single islanders come together in a stunning villa in Fiji, ready to embark on a summer of dating.'
  }
];

export default function LandingPage({ currentUser, systemStatus, onLoginSuccess, onRegisterSuccess }: LandingPageProps) {
  // Modal State
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [dbDiagModal, setDbDiagModal] = useState(false);
  const [previewMovie, setPreviewMovie] = useState<MovieItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'action' | 'scifi' | 'series' | 'anime'>('all');
  const [copiedServerUrl, setCopiedServerUrl] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  const copyServerAddress = () => {
    navigator.clipboard.writeText('https://cinode.zerolord.com');
    setCopiedServerUrl(true);
    setTimeout(() => setCopiedServerUrl(false), 2500);
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

  const filteredMovies = activeCategory === 'all' 
    ? MOVIES 
    : MOVIES.filter(m => m.category === activeCategory);

  const faqs = [
    {
      q: 'What is Cinode?',
      a: 'Cinode is a high-speed private media streaming portal engineered for smooth, ad-free streaming of curated blockbuster movies, series, and TV shows directly on your phone, smart TV, or laptop.'
    },
    {
      q: 'How does the ₦600 subscription work?',
      a: 'We keep streaming ultra-affordable. A single flat subscription fee of ₦600 unlocks 30 full days of unlimited, ad-free streaming in 4K HDR. You can renew instantly using our built-in instant payment gateway.'
    },
    {
      q: 'Can I watch offline on my mobile phone?',
      a: 'Yes! Download our official iOS or Android client apps to download your favorite movies and series directly to your device and watch offline anywhere without using mobile data.'
    },
    {
      q: 'How do I connect the Mobile App?',
      a: 'When you open the mobile app for the first time, simply enter our Server Address: https://cinode.zerolord.com and sign in with your Cinode portal account credentials!'
    },
    {
      q: 'Can I request movies that are not available?',
      a: 'Absolutely! Our portal includes a built-in Content Request system. Simply type in the movie or show title you want, and our system will fetch and add it to the server.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#07080c] text-white selection:bg-rose-600 selection:text-white relative overflow-x-hidden font-sans" id="landing-page-root">
      
      {/* Pending Setup Banner */}
      {(!systemStatus || !systemStatus.configured || !systemStatus.hasAdmin) && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-purple-600 text-white text-xs py-2 px-4 text-center border-b border-rose-500/20 flex items-center justify-center gap-2 relative z-50 shadow-md">
          <Info className="w-3.5 h-3.5 text-amber-200 shrink-0 animate-pulse" />
          <span className="font-medium">
            {systemStatus?.mysqlAvailable !== false 
              ? "Database linked! First-time administrator setup is required." 
              : "Portal active (Local Fallback mode)! Setup required for admin access."}
          </span>
          <a href="#setup" className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold transition backdrop-blur-sm border border-white/20">
            Launch Wizard &rarr;
          </a>
        </div>
      )}

      {/* MySQL Connection Issue Banner */}
      {systemStatus && systemStatus.mysqlAvailable === false && (
        <div className="bg-gradient-to-r from-red-700 via-rose-700 to-rose-900 text-white text-xs py-2 px-4 text-center border-b border-rose-500/20 flex items-center justify-center gap-2 relative z-50 shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-200 shrink-0" />
          <span><strong>MySQL Authorization Needed:</strong> Operating on high-speed local fallback storage.</span>
          <button 
            onClick={() => setDbDiagModal(true)} 
            className="bg-black/30 hover:bg-black/50 text-rose-200 hover:text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold transition border border-rose-400/30 cursor-pointer"
          >
            Authorize Database &rarr;
          </button>
        </div>
      )}

      {/* Top Live Ticker Marquee */}
      <div className="bg-[#0a0c16]/90 border-b border-slate-800/80 py-1.5 overflow-hidden backdrop-blur-md relative z-30 text-[11px]">
        <div className="animate-marquee flex items-center gap-8 text-slate-300 font-mono tracking-wide whitespace-nowrap">
          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            LIVE SERVER: 1,840+ ACTIVE STREAMS
          </span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">⚡ ZERO BUFFER LATENCY (45Mbps Direct)</span>
          <span>•</span>
          <span className="text-amber-300 font-bold">🍿 ₦600 ALL-ACCESS UNLIMITED PASS</span>
          <span>•</span>
          <span className="text-cyan-400 font-bold">🔥 REAL 4K MOVIES & SERIES</span>
          <span>•</span>
          <span className="text-purple-400 font-bold">📱 IOS & ANDROID DOWNLOAD SUPPORT</span>
          <span>•</span>
          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            LIVE SERVER: 1,840+ ACTIVE STREAMS
          </span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">⚡ ZERO BUFFER LATENCY (45Mbps Direct)</span>
        </div>
      </div>

      {/* REDESIGNED FLOATING GLASSMORPHIC HEADER (COMPACT & SLEEK) */}
      <header className="sticky top-3 z-40 max-w-6xl mx-auto px-4 sm:px-6 my-2">
        <div className="bg-[#0c0e18]/85 backdrop-blur-xl border border-white/10 rounded-2xl h-14 px-4 sm:px-6 flex items-center justify-between shadow-2xl shadow-black/80">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-xl tracking-tight text-white">
              Cin<span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-400">ode</span>
            </span>
          </div>

          {/* Desktop Navigation Links (Compact Proportions) */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] font-semibold text-slate-300">
            <a href="#trending" className="hover:text-rose-400 transition flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-rose-500" /> Trending
            </a>
            <a href="#features" className="hover:text-rose-400 transition">Experience</a>
            <a href="#pricing" className="hover:text-rose-400 transition">₦600 Plan</a>
            <a href="#mobile-apps" className="hover:text-rose-400 transition flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-rose-400" /> Mobile Apps
            </a>
            <a href="#faqs" className="hover:text-rose-400 transition">FAQ</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <a 
                href="#portal" 
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition shadow-lg shadow-rose-950/40 flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-white" /> Stream Portal
              </a>
            ) : (
              <>
                <button 
                  onClick={() => { setError(null); setAuthModal('login'); }}
                  className="text-slate-300 hover:text-white font-semibold text-xs transition px-2.5 py-1.5 cursor-pointer"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setError(null); setAuthModal('signup'); }}
                  className="bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 text-white font-extrabold py-1.5 px-4 rounded-xl text-xs transition cursor-pointer shadow-md shadow-rose-600/30 border border-white/20 uppercase tracking-wide"
                >
                  Get ₦600 Pass
                </button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-300 hover:text-white p-1 rounded-lg border border-slate-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 bg-[#0c0e18]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 text-xs font-semibold space-y-3 shadow-2xl animate-in fade-in">
            <a 
              href="#trending" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-rose-400 py-1"
            >
              🔥 Trending Movies
            </a>
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-rose-400 py-1"
            >
              ⚡ Experience
            </a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-rose-400 py-1"
            >
              🍿 ₦600 Plan
            </a>
            <a 
              href="#mobile-apps" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-rose-400 py-1"
            >
              📱 Mobile Apps
            </a>
            <a 
              href="#faqs" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-rose-400 py-1"
            >
              ❓ FAQ
            </a>
          </div>
        )}
      </header>

      {/* HERO SECTION WITH USER UPLOADED BACKGROUND IMAGE 1 */}
      <section className="relative pt-8 pb-16 px-6 text-center z-10 min-h-[85vh] flex flex-col justify-between">
        
        {/* BACKGROUND IMAGE 1 (GLOWING 3D MEDIA POSTER WALL) WITH DARK MASK */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-0 left-0 right-0 h-[700px] bg-cover bg-top bg-no-repeat opacity-45 mix-blend-screen scale-105"
            style={{ backgroundImage: `url(${heroBg})` }}
          />
          {/* Multi-layered dark gradient mask to ensure crisp text readibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#07080c]/50 via-[#07080c]/85 to-[#07080c]" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-rose-600/20 rounded-full blur-[140px]" />
        </div>

        <div className="max-w-4xl mx-auto pt-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold text-xs px-4 py-1.5 rounded-full mb-6 backdrop-blur-xl shadow-lg shadow-rose-950/40">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 
            <span>PRIVATE 4K STREAMING PORTAL • NO ADS • NO BUFFERS</span>
          </div>

          {/* Headline (Controlled Proportions) */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black tracking-tight text-white mb-6 leading-[1.02]">
            STREAM EVERYTHING.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-purple-400">
              ZERO LIMITS. ₦600/MO.
            </span>
          </h1>

          <p className="max-w-xl mx-auto text-slate-300 text-sm sm:text-base mb-8 leading-relaxed font-sans font-medium">
            Experience ultra-smooth 4K movies, anime, and series streamed straight from private high-speed servers. Sync across all your devices with 1-click mobile setup.
          </p>

          {/* CTA Buttons & Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-10">
            {currentUser ? (
              <button 
                onClick={() => { window.location.href = '#portal'; }}
                className="w-full sm:w-auto bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold py-3.5 px-7 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-rose-600/30 border border-rose-400/30"
              >
                <Play className="w-4 h-4 fill-white" /> Open Stream Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={() => { setError(null); setAuthModal('signup'); }}
                className="w-full sm:w-auto bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:opacity-95 text-white font-black py-3.5 px-8 rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-2xl shadow-rose-600/40 border border-white/20 uppercase tracking-wide"
              >
                <Zap className="w-4 h-4 fill-amber-300 text-amber-300" /> Start Watching Now <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="bg-[#0e101a]/90 border border-slate-800 rounded-xl p-2.5 px-4 flex items-center gap-3 shrink-0 text-left backdrop-blur-md">
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-rose-600 flex items-center justify-center text-[9px] font-black text-white border border-[#0e101a]">JD</div>
                <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-[9px] font-black text-white border border-[#0e101a]">AS</div>
                <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-black text-white border border-[#0e101a]">KO</div>
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> 4.9/5 Rating
                </div>
                <span className="text-[10px] text-slate-400">1,200+ Nigerian Streamers</span>
              </div>
            </div>
          </div>
        </div>

        {/* Endless Marquee Wall of Real TMDB Movie Posters */}
        <div className="space-y-3 overflow-hidden pt-2 relative py-4 mask-gradient">
          <div className="animate-marquee flex items-center gap-4">
            {[...MOVIES, ...MOVIES].map((movie, idx) => (
              <div 
                key={`top-${movie.id}-${idx}`}
                onClick={() => setPreviewMovie(movie)}
                className="w-36 h-52 rounded-xl relative overflow-hidden shrink-0 group cursor-pointer border border-slate-800/80 hover:border-rose-500/80 transition duration-300 shadow-xl hover:scale-105"
              >
                <img 
                  src={movie.cover} 
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-transparent to-transparent opacity-85"></div>
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-amber-400 border border-amber-400/30 flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-amber-400" /> {movie.rating}
                </div>
                <div className="absolute top-2 right-2 bg-rose-600/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase">
                  {movie.quality}
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2.5 text-left">
                  <span className="text-[8px] text-rose-400 font-bold uppercase tracking-wider block">{movie.tag}</span>
                  <h4 className="text-[11px] font-extrabold text-white tracking-tight truncate">{movie.title}</h4>
                </div>
                <div className="absolute inset-0 bg-rose-900/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/50 transform scale-75 group-hover:scale-100 transition">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* Interactive Real Movies Showcase */}
      <section className="py-16 px-6 max-w-7xl mx-auto relative z-10" id="trending">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="text-left">
            <span className="text-rose-500 font-bold text-xs uppercase tracking-widest block mb-1 flex items-center gap-1">
              <Flame className="w-4 h-4 text-rose-500" /> Real Cinema Catalog
            </span>
            <h2 className="text-2xl md:text-4xl font-display font-black text-white tracking-tight">
              Trending Blockbusters & Series
            </h2>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#0b0d18] border border-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCategory === 'all' 
                  ? 'bg-rose-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔥 All Hits
            </button>
            <button
              onClick={() => setActiveCategory('action')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCategory === 'action' 
                  ? 'bg-rose-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚔️ Action & Sci-Fi
            </button>
            <button
              onClick={() => setActiveCategory('series')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCategory === 'series' 
                  ? 'bg-rose-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🍿 TV Series
            </button>
            <button
              onClick={() => setActiveCategory('anime')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeCategory === 'anime' 
                  ? 'bg-rose-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ✨ Anime
            </button>
          </div>
        </div>

        {/* Real Movie Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {filteredMovies.map((movie) => (
            <div 
              key={movie.id}
              onClick={() => setPreviewMovie(movie)}
              className="bg-[#0c0e18] border border-slate-800/80 rounded-xl overflow-hidden group cursor-pointer hover:border-rose-500/60 transition duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-rose-950/40 hover:-translate-y-1"
            >
              <div className="aspect-[2/3] relative overflow-hidden bg-slate-900">
                <img 
                  src={movie.cover} 
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e18] via-transparent to-transparent opacity-85"></div>
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-black text-amber-400 border border-amber-400/30 flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400" /> {movie.rating}
                </div>
                <div className="absolute top-2 right-2 bg-rose-600/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-wider">
                  {movie.quality}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl shadow-rose-600 transform scale-75 group-hover:scale-100 transition duration-300">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="p-3 text-left space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                  <span>{movie.year}</span>
                  <span className="text-rose-400">{movie.duration}</span>
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate group-hover:text-rose-400 transition">
                  {movie.title}
                </h3>
                <span className="text-[9px] bg-rose-500/10 text-rose-300 px-1.5 py-0.5 rounded font-bold inline-block border border-rose-500/20">
                  {movie.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY CINODE HITS DIFFERENT WITH USER UPLOADED BACKGROUND IMAGE 2 */}
      <section className="py-20 px-6 bg-[#090b14] border-y border-slate-800/80 relative z-10 overflow-hidden" id="features">
        
        {/* BACKGROUND IMAGE 2 (SHOWCASE POSTER WALL) */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25 mix-blend-screen"
            style={{ backgroundImage: `url(${showcaseBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090b14] via-[#090b14]/90 to-[#090b14]" />
        </div>

        <div className="max-w-6xl mx-auto text-center">
          <span className="text-rose-500 font-extrabold text-xs uppercase tracking-widest block mb-2">
            SUPERIOR MEDIA ENGINEERING
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight mb-12">
            Why Cinode Hits Different.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            
            {/* Bento Card 1 */}
            <div className="bg-[#0d0f1e]/90 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-rose-500/50 transition duration-300 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10 group-hover:scale-110 transition">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Zero Buffer Engine</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Direct-play 45Mbps video streams backed by dedicated SSD storage. Movies launch instantly without waiting.
              </p>
            </div>

            {/* Bento Card 2 */}
            <div className="bg-[#0d0f1e]/90 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition duration-300 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10 group-hover:scale-110 transition">
                <Tv className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Any Screen, Everywhere</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device.
              </p>
            </div>

            {/* Bento Card 3 */}
            <div className="bg-[#0d0f1e]/90 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-cyan-500/50 transition duration-300 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/10 group-hover:scale-110 transition">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-white mb-2">Offline Downloads</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center relative z-10" id="pricing">
        <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-xs px-3 py-1 rounded-full mb-3">
          <Flame className="w-3.5 h-3.5" /> UNBEATABLE STREAMING PASS
        </div>
        <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight mb-3">
          Simple, All-Access Pricing
        </h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-10">
          One transparent subscription price. Zero ads, zero hidden fees.
        </p>

        <div className="max-w-md mx-auto bg-gradient-to-b from-[#0f1122] via-[#0a0c18] to-[#07080d] border border-rose-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-[9px] uppercase tracking-widest py-1 px-4 rounded-bl-xl shadow">
            🔥 ALL-INCLUSIVE
          </div>

          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest block mb-1">
            PREMIUM STREAMING ACCESS
          </span>
          <h3 className="text-xl font-black text-white mb-4">30-DAY UNLIMITED PASS</h3>

          <div className="flex items-baseline justify-center mb-4">
            <span className="text-5xl font-display font-black tracking-tight text-white">₦600</span>
            <span className="text-slate-400 font-bold ml-2 text-xs uppercase">/ 30 Days</span>
          </div>

          <p className="text-slate-300 text-xs mb-6 leading-relaxed">
            Full unthrottled access to our private media server, 4K HDR playback, content requests, and simultaneous playback across all your personal devices.
          </p>

          <ul className="text-left space-y-2.5 mb-6 text-xs text-slate-200 font-medium">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
              100% Ad-Free Unlimited Cinema & Series
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
              Private Streaming Profile with Sync
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
              Watch on Phone, Smart TV, Laptop & Tablet
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
              Instant 1-Click Payment Activation
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
              Submit Content Requests anytime
            </li>
          </ul>

          {currentUser ? (
            <button 
              onClick={() => { window.location.href = '#portal'; }}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-3 rounded-xl cursor-pointer shadow-lg shadow-rose-600/30 transition text-xs uppercase tracking-wide"
            >
              Manage Subscription
            </button>
          ) : (
            <button 
              onClick={() => { setError(null); setAuthModal('signup'); }}
              className="w-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:opacity-95 text-white font-black py-3.5 rounded-xl cursor-pointer shadow-xl shadow-rose-600/40 transition text-xs uppercase tracking-wide"
            >
              Get Started For ₦600
            </button>
          )}
        </div>
      </section>

      {/* Mobile App Setup Section */}
      <section className="bg-[#090b14] border-t border-slate-800/80 py-16 px-6 relative z-10" id="mobile-apps">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
          
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-xs px-3 py-1 rounded-full">
              <Smartphone className="w-3.5 h-3.5" /> OFFICIAL MOBILE CLIENTS
            </div>

            <h2 className="text-2xl sm:text-4xl font-display font-black text-white tracking-tight leading-tight">
              Take Your Cinema <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-400">
                Anywhere Offline.
              </span>
            </h2>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Save blockbusters and full series directly onto your phone or tablet. Watch offline without worrying about bad connection or data costs.
            </p>

            <div className="bg-[#0d0f1e] border border-rose-500/30 rounded-xl p-3.5 text-left max-w-xl space-y-1.5 shadow-xl">
              <span className="text-rose-400 font-bold text-xs flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" /> Mobile App Setup Instruction
              </span>
              <p className="text-slate-300 text-xs leading-relaxed">
                When prompted by the mobile app for your <strong>Server URL</strong>, enter:
              </p>
              <div className="bg-[#121426] border border-slate-800 rounded-lg px-3 py-2 text-rose-300 font-mono text-xs flex items-center justify-between gap-2 font-bold">
                <span className="truncate">https://cinode.zerolord.com</span>
                <button 
                  onClick={copyServerAddress}
                  className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-1 rounded text-[10px] font-sans font-extrabold uppercase transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedServerUrl ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* App Store Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 justify-center md:justify-start">
              {systemStatus?.iosDownloadUrl ? (
                <a 
                  href={systemStatus.iosDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 transition cursor-pointer shadow-lg"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.64 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">Download on</span>
                    <span className="text-xs font-black font-display">App Store</span>
                  </div>
                </a>
              ) : (
                <button 
                  onClick={() => alert("iOS Client App download link is currently being configured by the admin.")}
                  className="w-full sm:w-auto bg-slate-900/60 opacity-70 border border-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.64 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">App Store</span>
                    <span className="text-xs font-black font-display">Coming Soon</span>
                  </div>
                </button>
              )}

              {systemStatus?.androidDownloadUrl ? (
                <a 
                  href={systemStatus.androidDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 transition cursor-pointer shadow-lg"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">Get it on</span>
                    <span className="text-xs font-black font-display">Google Play</span>
                  </div>
                </a>
              ) : (
                <button 
                  onClick={() => alert("Android Client App download link is currently being configured by the admin.")}
                  className="w-full sm:w-auto bg-slate-900/60 opacity-70 border border-slate-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2.5 cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                    <path d="M3,5.27V18.73L16.55,12L3,5.27M17.87,11.33L19.43,12.11L17.87,12.89L16.67,12L17.87,11.33M3,3.41L15.67,9.7L18.11,8.47L3,3.41M3,20.59L18.11,15.53L15.67,14.3L3,20.59Z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">Google Play</span>
                    <span className="text-xs font-black font-display">Coming Soon</span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Device Mockup */}
          <div className="flex-1 flex justify-center">
            <div className="relative border border-slate-800/80 rounded-2xl bg-[#0c0e18] p-5 shadow-2xl max-w-xs overflow-hidden group hover:border-rose-500/50 transition duration-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <span className="text-xs text-rose-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5 text-rose-500" /> Mobile Downloader
                </span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Offline Mode
                </span>
              </div>

              <div className="space-y-3">
                <div className="aspect-video bg-slate-950 rounded-lg relative overflow-hidden">
                  <img 
                    src="https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg" 
                    alt="Dune" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-[8px] text-rose-400 font-bold uppercase tracking-wider">Now Downloading</span>
                    <h4 className="text-xs font-bold text-white tracking-tight truncate">Dune: Part Two (2024)</h4>
                  </div>
                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md rounded-md p-1">
                    <Download className="w-3 h-3 text-rose-500 animate-bounce" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                    <span>Downloading 4K HDR...</span>
                    <span className="text-rose-400">82%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full" style={{ width: '82%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-6 max-w-3xl mx-auto text-left relative z-10" id="faqs">
        <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight mb-8 text-center">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              className="bg-[#0b0d18] border border-slate-800/80 rounded-xl overflow-hidden transition"
            >
              <button 
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left font-bold text-xs sm:text-sm text-white flex items-center justify-between gap-4 cursor-pointer hover:text-rose-400 transition"
              >
                <span>{faq.q}</span>
                {faqOpen === idx ? <ChevronUp className="w-4 h-4 text-rose-500" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {faqOpen === idx && (
                <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/50">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-rose-500" />
            <span className="font-extrabold text-white">Cinode Private Portal</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Cinode Streaming Network. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="#terms" className="hover:text-slate-300 transition">Terms</a>
            <a href="#privacy" className="hover:text-slate-300 transition">Privacy</a>
            <a href="#support" className="hover:text-slate-300 transition">Support</a>
          </div>
        </div>
      </footer>

      {/* MOVIE PREVIEW MODAL */}
      {previewMovie && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e101c] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setPreviewMovie(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white p-1.5 rounded-full z-10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="aspect-video relative overflow-hidden">
              <img 
                src={previewMovie.cover} 
                alt={previewMovie.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e101c] via-transparent to-transparent"></div>
              <div className="absolute bottom-3 left-4 right-4 text-left">
                <span className="text-[10px] bg-rose-600 text-white font-black px-2 py-0.5 rounded uppercase mr-2">
                  {previewMovie.quality}
                </span>
                <span className="text-xs font-bold text-amber-400">★ {previewMovie.rating}/10</span>
                <h3 className="text-xl font-black text-white mt-1">{previewMovie.title}</h3>
              </div>
            </div>

            <div className="p-5 text-left space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                {previewMovie.desc}
              </p>

              <div className="bg-[#080912] border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Subscription Status</span>
                  <span className="text-emerald-400 font-extrabold">₦600 All-Access Pass Required</span>
                </div>
                <button 
                  onClick={() => {
                    setPreviewMovie(null);
                    if (currentUser) {
                      window.location.href = '#portal';
                    } else {
                      setAuthModal('signup');
                    }
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-4 py-2 rounded-lg transition text-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Watch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTH MODAL (LOGIN / SIGNUP) */}
      {authModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e101c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setAuthModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-10 h-10 bg-rose-600/20 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-2 border border-rose-500/30">
                <Tv className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white">
                {authModal === 'login' ? 'Welcome Back to Cinode' : 'Create Your Cinode Account'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {authModal === 'login' 
                  ? 'Enter your credentials to stream 4K movies' 
                  : 'Get 30 days of unlimited 4K streaming for ₦600'}
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {authModal === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                  <input 
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                  <input 
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In To Stream'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                  <input 
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="johndoe"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                  <input 
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Referral Code (Optional)</label>
                  <input 
                    type="text"
                    value={regReferredBy}
                    onChange={(e) => setRegReferredBy(e.target.value.toUpperCase())}
                    placeholder="e.g. REF123"
                    className="w-full bg-[#080912] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-rose-600 to-amber-500 hover:opacity-95 text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 uppercase tracking-wide"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account & Get ₦600 Pass'}
                </button>
              </form>
            )}

            <div className="mt-4 pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
              {authModal === 'login' ? (
                <p>Don't have an account? <button onClick={() => { setError(null); setAuthModal('signup'); }} className="text-rose-400 font-bold hover:underline cursor-pointer">Register for ₦600</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => { setError(null); setAuthModal('login'); }} className="text-rose-400 font-bold hover:underline cursor-pointer">Sign In</button></p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DATABASE DIAGNOSTIC MODAL */}
      {dbDiagModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e101c] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setDbDiagModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-rose-500" />
              <h3 className="text-lg font-black text-white">Database Status</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              The portal is operating in high-performance local fallback storage mode. MySQL authorization can be linked anytime in your admin configuration panel.
            </p>
            <button 
              onClick={() => setDbDiagModal(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Close Diagnostic
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
