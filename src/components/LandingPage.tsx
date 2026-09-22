import React, { useState, useEffect, useRef } from 'react';
import { 
  PlayCircle, Tv, Film, Laptop, Sparkles, HelpCircle, ChevronDown, ChevronUp, 
  X, Lock, User, ShieldCheck, ArrowRight, Loader2, Info, 
  AlertTriangle, AlertCircle, Database, Smartphone, Download, Star, Flame, Play, Pause, Zap, 
  CheckCircle2, Copy, Menu, Radio, ArrowUpRight, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Eye, EyeOff, KeyRound, Mail
} from 'lucide-react';
import { User as UserType, SystemStatus, HeroSlideConfig, LandingAboutConfig, LandingFaqItem, LandingPageContent } from '../types';
import { apiFetch, setSessionToken } from '../lib/api';

import heroBg from '../assets/images/evil_dead_hero_1787144247352.jpg';
import aboutBg from '../assets/images/evil_dead_about_1787144271897.jpg';
import classicPoster from '../assets/images/evil_dead_classic_1787144288115.jpg';
import risePoster from '../assets/images/evil_dead_rise_1787144325178.jpg';
import remakePoster from '../assets/images/evil_dead_remake_1787144343165.jpg';

interface LandingPageProps {
  currentUser: UserType | null;
  systemStatus: SystemStatus | null;
  onLoginSuccess: (user: UserType, token: string, sessionToken?: string) => void;
  onRegisterSuccess: (user: UserType, sessionToken?: string) => void;
  initialAuthModal?: 'login' | 'signup' | 'forgot' | null;
}

interface MovieItem {
  id: string;
  title: string;
  category: 'horror' | 'action' | 'scifi' | 'series' | 'anime';
  year: string;
  rating: string;
  quality: string;
  duration: string;
  cover: string;
  backdrop?: string;
  tag: string;
  desc: string;
}

interface HeroSlide {
  id: string;
  title: string;
  tagline: string;
  year: string;
  rating: string;
  quality: string;
  duration: string;
  image?: string;
  poster?: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  posterUrl?: string;
  autoplaySound?: boolean;
  announcement: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-evil-dead',
    title: 'EVIL DEAD',
    tagline: 'CINODE 4K STREAMING NETWORK • ₦600 UNLIMITED PASS',
    year: '1981 - 2023',
    rating: '9.9',
    quality: '4K Remaster',
    duration: 'Franchise Boxset',
    image: heroBg,
    poster: classicPoster,
    announcement: 'Bruce Campbell and Sam Raimi\'s legendary Evil Dead universe is fully remastered in 4K HDR. Stream unrated cuts and behind-the-scenes specials with zero buffer on Cinode.'
  },
  {
    id: 'slide-dune-2',
    title: 'DUNE: PART TWO',
    tagline: 'IMAX ENHANCED 4K HDR • 45MBPS DIRECT STREAM',
    year: '2024',
    rating: '9.8',
    quality: '4K Ultra HD',
    duration: '2h 46m',
    image: 'https://image.tmdb.org/t/p/original/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg',
    announcement: 'Denis Villeneuve\'s cinematic masterwork is now streaming in full 4K HDR. Experience Paul Atreides\' destiny on any TV, PC, or mobile device with zero buffering.'
  },
  {
    id: 'slide-stranger-things',
    title: 'STRANGER THINGS',
    tagline: 'COMPLETE 4K BINGE • OFFLINE DOWNLOADS READY',
    year: '2025',
    rating: '9.9',
    quality: '4K BINGE',
    duration: 'All Seasons',
    image: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    announcement: 'Every season of Stranger Things available in stunning 4K HDR. Save full episodes directly to your iOS or Android app to watch on the go without mobile data lag.'
  },
  {
    id: 'slide-arcane',
    title: 'ARCANE',
    tagline: 'CRITICALLY ACCLAIMED MASTERPIECE • 9.9/10 RATING',
    year: '2024',
    rating: '9.9',
    quality: '4K HDR',
    duration: 'Season 1 & 2',
    image: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg',
    announcement: 'Experience the visual triumph of Piltover and Zaun. Stream every high-stakes episode in pristine 4K resolution with synchronized English/multi-language subtitles.'
  },
  {
    id: 'slide-gladiator',
    title: 'GLADIATOR II',
    tagline: 'EPIC ACTION BLOCKBUSTER • UNTHROTTLED PLAYBACK',
    year: '2024',
    rating: '9.4',
    quality: '4K HDR',
    duration: '2h 28m',
    image: 'https://image.tmdb.org/t/p/original/euYIwmqkmz95mnXvufEmbL6ovhZ.jpg',
    poster: 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg',
    announcement: 'Lucius enters the Colosseum in Ridley Scott\'s monumental return to ancient Rome. Stream with instant 1-click seeking and zero buffering on Cinode.'
  }
];

const FEATURED_CINODE_MOVIES: MovieItem[] = [
  {
    id: 'ed-classic',
    title: 'The Evil Dead',
    category: 'horror',
    year: '1981',
    rating: '9.9',
    quality: '4K Remaster',
    duration: '1h 25m',
    cover: classicPoster,
    tag: '💀 CULT CLASSIC',
    desc: 'The Evil Dead is a 1981 American supernatural horror film written and directed by Sam Raimi in his feature directorial debut. Ash Williams and friends travel to a secluded cabin in Tennessee.'
  },
  {
    id: 'ed-rise',
    title: 'Evil Dead Rise',
    category: 'horror',
    year: '2023',
    rating: '9.7',
    quality: '4K HDR',
    duration: '1h 36m',
    cover: risePoster,
    tag: '🩸 BOX OFFICE HIT',
    desc: 'Evil Dead Rise is a 2023 American supernatural horror film written and directed by Lee Cronin. It is the fifth installment of the Evil Dead film series following two estranged sisters in an LA apartment.'
  },
  {
    id: 'ed-remake',
    title: 'The Evil Dead',
    category: 'horror',
    year: '2013',
    rating: '9.6',
    quality: '4K Ultra HD',
    duration: '1h 31m',
    cover: remakePoster,
    tag: '🔥 UNRATED CUT',
    desc: 'Five college students take time off to spend a peaceful vacation in a remote cabin. A book and audio tape is discovered, and its evil is found to be powerful once the incantations are read out loud.'
  }
];

const EXTENDED_MOVIES: MovieItem[] = [
  {
    id: 'm1',
    title: 'Dune: Part Two',
    category: 'scifi',
    year: '2024',
    rating: '9.8',
    quality: '4K HDR',
    duration: '2h 46m',
    cover: 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg',
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
    tag: '✨ FAN FAVORITE',
    desc: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.'
  },
  {
    id: 'm3',
    title: 'Stranger Things',
    category: 'series',
    year: '2025',
    rating: '9.9',
    quality: '4K BINGE',
    duration: 'Full Series',
    cover: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    tag: '🍿 BINGE MUST',
    desc: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.'
  },
  {
    id: 'm4',
    title: 'Arcane',
    category: 'anime',
    year: '2024',
    rating: '9.9',
    quality: '4K Ultra HD',
    duration: 'Season 2',
    cover: 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg',
    tag: '🌟 HIGHEST RATED',
    desc: 'Amidst the escalating feud between Piltover and Zaun, sisters Vi and Jinx find themselves on opposing sides.'
  },
  {
    id: 'm5',
    title: 'Gladiator II',
    category: 'action',
    year: '2024',
    rating: '9.4',
    quality: '4K HDR',
    duration: '2h 28m',
    cover: 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg',
    tag: '⚔️ EPIC ACTION',
    desc: 'Years after witnessing the death of Maximus, Lucius enters the Colosseum to restore glory to Rome.'
  },
  {
    id: 'm6',
    title: 'Interstellar',
    category: 'scifi',
    year: '2014',
    rating: '9.8',
    quality: 'IMAX 4K',
    duration: '2h 49m',
    cover: 'https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
    tag: '🌌 SCI-FI CLASSIC',
    desc: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.'
  }
];

export default function LandingPage({ 
  currentUser, 
  systemStatus, 
  onLoginSuccess, 
  onRegisterSuccess,
  initialAuthModal = null 
}: LandingPageProps) {
  // Modal State
  const [authModal, setAuthModal] = useState<'login' | 'signup' | 'forgot' | null>(() => {
    if (initialAuthModal) return initialAuthModal;
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#login') return 'login';
      if (window.location.hash === '#signup' || window.location.hash === '#register') return 'signup';
      if (window.location.hash === '#forgot') return 'forgot';
    }
    return null;
  });

  // Sync initialAuthModal when it changes
  useEffect(() => {
    if (initialAuthModal) {
      setAuthModal(initialAuthModal);
    }
  }, [initialAuthModal]);

  // Sync with window hash changes for #login, #signup, #forgot
  useEffect(() => {
    const handleHashCheck = () => {
      if (window.location.hash === '#login') {
        setAuthModal('login');
      } else if (window.location.hash === '#signup' || window.location.hash === '#register') {
        setAuthModal('signup');
      } else if (window.location.hash === '#forgot') {
        setAuthModal('forgot');
      }
    };
    handleHashCheck();
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [dbDiagModal, setDbDiagModal] = useState(false);
  const [previewMovie, setPreviewMovie] = useState<MovieItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'horror' | 'action' | 'scifi' | 'series' | 'anime'>('all');
  const [copiedServerUrl, setCopiedServerUrl] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  
  // Dynamic CMS Landing Content State
  const [slides, setSlides] = useState<HeroSlide[]>(HERO_SLIDES);
  const [heroSlideDelay, setHeroSlideDelay] = useState<number>(5);
  const [aboutConfig, setAboutConfig] = useState<LandingAboutConfig | null>(null);
  const [landingFaqs, setLandingFaqs] = useState<LandingFaqItem[]>([]);

  // Hero Slider State (Auto-Rotation) & Video Playback
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [isHeroMuted, setIsHeroMuted] = useState(false); // Default unmuted so sound autoplays
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(true);
  const [isSoundBlockedByBrowser, setIsSoundBlockedByBrowser] = useState(false);
  const heroVideoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const trendingCarouselRef = useRef<HTMLDivElement>(null);
  
  // Auth Form State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regReferredBy, setRegReferredBy] = useState('');

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);
  const [forgotErrorMsg, setForgotErrorMsg] = useState<string | null>(null);

  // Fetch dynamic CMS Landing Page Content
  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const res = await apiFetch('/api/landing/content');
        if (!res.ok) return;
        const data: LandingPageContent = await res.json();
        if (data) {
          if (data.heroSlides && data.heroSlides.length > 0) {
            const active = data.heroSlides.filter(s => s.isActive);
            if (active.length > 0) {
              setSlides(active.map(s => ({
                id: s.id,
                title: s.title,
                tagline: s.tagline,
                year: s.year,
                rating: s.rating,
                quality: s.quality,
                duration: s.duration,
                image: s.mediaUrl || heroBg,
                poster: s.posterUrl || s.mediaUrl || classicPoster,
                mediaType: s.mediaType || 'image',
                mediaUrl: s.mediaUrl,
                posterUrl: s.posterUrl,
                autoplaySound: s.autoplaySound !== false,
                announcement: s.announcement
              })));
            }
          }
          if (data.heroSlideDelaySeconds) {
            setHeroSlideDelay(Number(data.heroSlideDelaySeconds) || 5);
          }
          if (data.about) {
            setAboutConfig(data.about);
          }
          if (data.faqs && Array.isArray(data.faqs)) {
            const activeFaqs = data.faqs.filter(f => f.isActive);
            if (activeFaqs.length > 0) {
              setLandingFaqs(activeFaqs);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch landing CMS content:', err);
      }
    };
    fetchLandingData();
  }, []);

  // Dynamic Hero Carousel Timer (Admin Configured Seconds)
  useEffect(() => {
    if (isHeroPaused || slides.length === 0) return;
    const delayMs = (heroSlideDelay || 5) * 1000;
    const heroTimer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % slides.length);
    }, delayMs);
    return () => clearInterval(heroTimer);
  }, [isHeroPaused, slides.length, heroSlideDelay]);

  // Synchronize active hero video playback with audio autoplay and browser fallback
  useEffect(() => {
    slides.forEach((slide, idx) => {
      const vid = heroVideoRefs.current[idx];
      if (!vid) return;
      if (idx === currentHeroIndex && slide.mediaType === 'video') {
        if (isHeroVideoPlaying) {
          vid.volume = 1.0;
          if (!isHeroMuted && slide.autoplaySound !== false) {
            vid.muted = false;
            const playPromise = vid.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsSoundBlockedByBrowser(false);
                })
                .catch((err) => {
                  // Browser blocked unmuted autoplay before user interaction
                  console.info('Autoplay with sound paused by browser security policy. Playing muted until interaction:', err);
                  vid.muted = true;
                  vid.play().catch(() => {});
                  setIsSoundBlockedByBrowser(true);
                });
            }
          } else {
            vid.muted = true;
            vid.play().catch(() => {});
          }
        } else {
          vid.pause();
        }
      } else {
        vid.pause();
        vid.muted = true;
      }
    });
  }, [currentHeroIndex, isHeroVideoPlaying, isHeroMuted, slides]);

  // Global user gesture listener to automatically unlock unmuted sound on first click/tap
  useEffect(() => {
    const unlockSoundOnInteraction = () => {
      const activeSlide = slides[currentHeroIndex];
      if (activeSlide && activeSlide.mediaType === 'video' && activeSlide.autoplaySound !== false) {
        const vid = heroVideoRefs.current[currentHeroIndex];
        if (vid) {
          vid.muted = false;
          vid.volume = 1.0;
          vid.play().then(() => {
            setIsHeroMuted(false);
            setIsSoundBlockedByBrowser(false);
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('click', unlockSoundOnInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', unlockSoundOnInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', unlockSoundOnInteraction, { capture: true, passive: true });

    return () => {
      window.removeEventListener('click', unlockSoundOnInteraction, { capture: true });
      window.removeEventListener('touchstart', unlockSoundOnInteraction, { capture: true });
      window.removeEventListener('keydown', unlockSoundOnInteraction, { capture: true });
    };
  }, [currentHeroIndex, slides]);

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

  const scrollTrending = (direction: 'left' | 'right') => {
    if (trendingCarouselRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      trendingCarouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const parseApiResponse = async (response: Response) => {
    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) {
        throw new Error(`Server returned HTML error (${response.status}). Please verify backend routing.`);
      }
      throw new Error(cleanText || `Server returned status ${response.status}`);
    }
    return data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }

      onLoginSuccess(data.user, data.jellyfinToken || '', data.sessionToken);
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
      const response = await apiFetch('/api/auth/register', {
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
      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.sessionToken) {
        setSessionToken(data.sessionToken);
      }

      onRegisterSuccess(data.user, data.sessionToken);
      setAuthModal(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg(null);
    setForgotSuccessMsg(null);

    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotErrorMsg('Please enter your account email address.');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset link.');
      }

      setForgotSuccessMsg(data.message || 'If an account associated with that email exists, we have sent a secure password reset link to your inbox.');
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Unable to submit reset request. Please check your connection.');
    } finally {
      setForgotLoading(false);
    }
  };

  const allMoviesList = [...FEATURED_CINODE_MOVIES, ...EXTENDED_MOVIES];
  const filteredCatalog = activeCategory === 'all'
    ? allMoviesList
    : allMoviesList.filter(m => m.category === activeCategory);

  const faqs = [
    {
      q: 'What is Cinode Streaming Network?',
      a: 'Cinode is a high-speed private media streaming portal engineered for smooth, ad-free streaming of curated blockbuster movies, full franchises, and TV series directly on your phone, smart TV, or laptop.'
    },
    {
      q: 'How does the ₦600 subscription work?',
      a: 'We keep premium streaming ultra-affordable. A single flat subscription fee of ₦600 unlocks 30 full days of unlimited, ad-free streaming in 4K HDR. You can renew instantly using Paystack, Monnify, Squad, or direct bank transfer.'
    },
    {
      q: 'Can I watch offline on my mobile phone?',
      a: 'Yes! Download our official mobile client apps to save your favorite movies and series directly to your device and watch offline anywhere without using mobile data.'
    },
    {
      q: 'How do I connect the Mobile App?',
      a: 'When you open the mobile app for the first time, simply enter our Server Address: https://cinode.zerolord.com and sign in with your Cinode portal account credentials.'
    },
    {
      q: 'Can I request movies that are not available?',
      a: 'Absolutely! Our portal includes a built-in Content Request system. Simply submit the title you want, and our system will fetch and add it to the library.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#080304] text-white selection:bg-[#d31d38] selection:text-white relative overflow-x-hidden font-sans" id="landing-page-root">
      
      {/* Pending Setup Banner */}
      {(!systemStatus || !systemStatus.configured || !systemStatus.hasAdmin) && (
        <div className="bg-[#1c0c0e] text-white text-xs py-2 px-4 text-center border-b border-[#d31d38]/40 flex items-center justify-center gap-2 relative z-50 shadow-md">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
          <span className="font-medium">
            {systemStatus?.mysqlAvailable !== false 
              ? "Database linked! First-time administrator setup is required." 
              : "Portal active (Local Fallback mode)! Setup required for admin access."}
          </span>
          <a href="#setup" className="bg-[#d31d38] hover:bg-[#b91228] text-white px-2.5 py-0.5 rounded text-[10px] font-bold transition">
            Launch Wizard &rarr;
          </a>
        </div>
      )}

      {/* MySQL Connection Issue Banner */}
      {systemStatus && systemStatus.mysqlAvailable === false && (
        <div className="bg-[#1c0c0e] text-white text-xs py-2 px-4 text-center border-b border-[#d31d38]/40 flex items-center justify-center gap-2 relative z-50 shadow-md">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span><strong>MySQL Authorization Needed:</strong> Operating on high-speed local fallback storage.</span>
          <button 
            onClick={() => setDbDiagModal(true)} 
            className="bg-[#d31d38]/30 hover:bg-[#d31d38] text-white px-2.5 py-0.5 rounded text-[10px] font-bold transition border border-[#d31d38]/50 cursor-pointer"
          >
            Authorize Database &rarr;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NAVIGATION BAR - CINODE BRANDING */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full bg-[#080304]/90 backdrop-blur-md border-b border-[#240f12]/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* Logo on Far Left: CINODE Branding */}
          <a href="#" className="flex items-center gap-2 group">
            <span className="text-3xl sm:text-4xl font-display font-black tracking-wider text-[#d31d38] drop-shadow-[0_0_15px_rgba(211,29,56,0.6)] select-none">
              CINODE
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 ml-1.5 border-l border-[#240f12] pl-2.5 hidden sm:inline-block">
              4K Stream
            </span>
          </a>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-10 text-[14px] font-bold text-[#e2d9db]">
            <a href="#" className="hover:text-[#d31d38] transition duration-200">
              Home
            </a>
            <a href="#about" className="hover:text-[#d31d38] transition duration-200">
              About
            </a>
            <a href="#trending" className="hover:text-[#d31d38] transition duration-200">
              Trending
            </a>
            <a href="#community" className="hover:text-[#d31d38] transition duration-200">
              Community
            </a>
            <a href="#pricing" className="hover:text-[#d31d38] transition duration-200 text-slate-400">
              ₦600 Pass
            </a>
          </nav>

          {/* Right Header Area (Clean navigation without 'Join our community' button as requested) */}
          <div className="flex items-center gap-4">
            {currentUser ? (
              <a 
                href="#portal" 
                className="text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-[#d31d38] text-[#d31d38]" /> Open Portal
              </a>
            ) : (
              <button 
                onClick={() => { setError(null); setAuthModal('login'); }}
                className="text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition px-3 py-1.5 rounded-lg border border-[#2e1216] hover:border-[#d31d38] cursor-pointer"
              >
                Sign In
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-slate-300 hover:text-white p-2 rounded-lg border border-[#240f12] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#100507]/95 backdrop-blur-2xl border-b border-[#240f12] px-6 py-4 space-y-3 text-sm font-bold animate-in fade-in">
            <a 
              href="#" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              Home
            </a>
            <a 
              href="#about" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              About Cinode
            </a>
            <a 
              href="#trending" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              Trending
            </a>
            <a 
              href="#community" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              Community
            </a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              ₦600 Plan
            </a>
            <a 
              href="#mobile-apps" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-200 hover:text-[#d31d38] py-1"
            >
              Mobile Apps
            </a>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* DYNAMIC CINEMATIC HERO SECTION (VIDEOS & POSTERS) */}
      {/* ========================================================================= */}
      {(() => {
        const currentSlide = slides[currentHeroIndex] || slides[0] || HERO_SLIDES[0];
        return (
          <section 
            className="relative min-h-[90vh] lg:min-h-[94vh] flex flex-col justify-between overflow-hidden group"
            onMouseEnter={() => setIsHeroPaused(true)}
            onMouseLeave={() => setIsHeroPaused(false)}
          >
            
            {/* Full-Bleed Dark Sliding Background Media (Video or Image) with Crossfade */}
            {slides.map((slide, idx) => {
              const isCurrent = idx === currentHeroIndex;
              const rawMedia = slide.mediaUrl || slide.image || heroBg;
              const isVideo = slide.mediaType === 'video' || (typeof rawMedia === 'string' && (rawMedia.includes('.mp4') || rawMedia.includes('.webm') || rawMedia.includes('.mov') || rawMedia.includes('.mkv') || rawMedia.includes('.m4v') || rawMedia.includes('.ts') || rawMedia.includes('video')));

              return (
                <div 
                  key={slide.id || idx}
                  className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none transition-opacity duration-1000 ease-in-out ${
                    isCurrent ? 'opacity-100 z-0' : 'opacity-0 -z-10'
                  }`}
                >
                  {isVideo ? (
                    <video
                      ref={(el) => { heroVideoRefs.current[idx] = el; }}
                      src={rawMedia}
                      poster={slide.poster || slide.posterUrl || slide.image}
                      autoPlay
                      loop
                      muted={false}
                      playsInline
                      preload="auto"
                      className="absolute inset-0 w-full h-full object-cover scale-105"
                      onError={(e) => {
                        console.warn('Video failed to load in hero, fallback to poster/image:', rawMedia);
                      }}
                    >
                      <source src={rawMedia} />
                    </video>
                  ) : (
                    <img 
                      src={rawMedia}
                      alt={slide.title || 'Cinode Hero'}
                      className="absolute inset-0 w-full h-full object-cover scale-105 transform transition-transform duration-[6000ms]"
                      loading={idx === 0 ? "eager" : "lazy"}
                      onError={(e: any) => {
                        console.warn('Hero image failed to load, falling back to default:', rawMedia);
                        e.target.src = heroBg;
                      }}
                    />
                  )}
                  {/* Subtle dark vignette gradients for deep contrast & readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080304] via-black/40 to-[#080304]/60" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#080304]/90 via-[#080304]/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#080304]/70 via-transparent to-[#080304]" />
                </div>
              );
            })}

            {/* Content Container & Navigation Arrows */}
            <div className="max-w-7xl mx-auto w-full px-6 pt-16 sm:pt-20 flex-1 flex flex-col justify-center relative">

              {/* Prev/Next Slider Controls */}
              <div className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 z-20 hidden sm:flex flex-col gap-3">
                <button 
                  onClick={() => setCurrentHeroIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                  className="w-11 h-11 rounded-full bg-[#180a0c]/80 hover:bg-[#d31d38] border border-white/20 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-md"
                  title="Previous Movie"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setCurrentHeroIndex((prev) => (prev + 1) % slides.length)}
                  className="w-11 h-11 rounded-full bg-[#180a0c]/80 hover:bg-[#d31d38] border border-white/20 text-white flex items-center justify-center transition cursor-pointer backdrop-blur-md"
                  title="Next Movie"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Giant Bold Center Title Typography - Dynamic per Slide */}
              <div className="text-center my-auto py-8 px-4">
                <div className="inline-block relative max-w-4xl">
                  
                  {/* Badge info */}
                  <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-full border border-[#d31d38]/40 mb-4 shadow-lg">
                    <span className="text-[#d31d38] font-black text-xs uppercase flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-[#d31d38]" /> {currentSlide.rating}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-white text-xs font-bold">{currentSlide.year}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-amber-400 text-xs font-bold uppercase">{currentSlide.quality}</span>
                  </div>

                  {/* Bold Movie Title on Poster */}
                  <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display font-black tracking-tighter text-white uppercase drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] leading-[0.9] select-none transition-all duration-500">
                    {currentSlide.title}
                  </h1>

                  {/* Dynamic Tagline */}
                  <div className="mt-4 text-xs sm:text-sm font-black tracking-[0.25em] uppercase text-[#d31d38] drop-shadow-md">
                    {currentSlide.tagline}
                  </div>

                  {/* Slide Indicator Dots */}
                  <div className="flex items-center justify-center gap-2 mt-6">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentHeroIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === currentHeroIndex 
                            ? 'w-8 bg-[#d31d38]' 
                            : 'w-2 bg-white/30 hover:bg-white/60'
                        }`}
                        title={`Slide ${idx + 1}`}
                      />
                    ))}
                  </div>

                </div>
              </div>

            </div>

            {/* Bottom Glassmorphism Announcement Banner (Dynamic Slide Information) */}
            <div className="w-full relative z-20 pb-8 px-6">
              <div className="max-w-6xl mx-auto bg-[#0a0405]/85 backdrop-blur-xl border border-white/15 rounded-lg p-3.5 sm:p-4 flex items-center gap-4 sm:gap-6 shadow-2xl shadow-black">
                
                {/* White Square Trigger with Black Arrow */}
                <button 
                  onClick={() => {
                    if (currentUser) {
                      window.location.href = '#portal';
                    } else {
                      setAuthModal('signup');
                    }
                  }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-sm bg-white hover:bg-[#d31d38] text-black hover:text-white flex items-center justify-center shrink-0 transition duration-200 cursor-pointer shadow group"
                >
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                </button>

                {/* Announcement Text */}
                <div className="text-left text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                  <p>
                    {currentSlide.announcement}
                  </p>
                </div>

              </div>
            </div>

          </section>
        );
      })()}

      {/* ========================================================================= */}
      {/* ABOUT CINODE SECTION */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-24 px-6 max-w-6xl mx-auto relative z-10" id="about">
        
        {/* Large Offset White Section Header */}
        <h2 className="text-5xl sm:text-7xl font-display font-black text-white tracking-tight mb-8 text-left">
          {aboutConfig?.header || "About"}
        </h2>

        {/* Asymmetric Dark Burgundy Card */}
        <div className="bg-[#180a0c] border border-[#2e1216] rounded-2xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-0">
          
          {/* Left Narrative Box - All About Cinode */}
          <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center text-left space-y-6">
            <div className="space-y-2">
              <span className="text-[#d31d38] font-bold text-xs uppercase tracking-widest block">
                {aboutConfig?.badge || "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK"}
              </span>
              <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {aboutConfig?.subtitle || "Cinode: Unthrottled 4K Streaming for Everyone"}
              </h3>
            </div>

            {aboutConfig?.contentHtml ? (
              <div 
                className="rich-text-content text-sm sm:text-base text-[#cfc2c4] leading-relaxed font-medium space-y-3"
                dangerouslySetInnerHTML={{ __html: aboutConfig.contentHtml }}
              />
            ) : (
              <>
                <p className="text-sm sm:text-base text-[#cfc2c4] leading-relaxed font-medium">
                  Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.
                </p>
                
                <p className="text-sm sm:text-base text-[#cfc2c4] leading-relaxed font-medium">
                  With a dedicated 45Mbps direct-play infrastructure, you bypass aggressive streaming compression to enjoy theater-quality audio, crystal-clear visuals, personalized watch histories, and instant movie requests.
                </p>
                
                <p className="text-xs sm:text-sm text-[#9c898c] leading-relaxed pt-2 border-t border-[#2e1216]">
                  One single ₦600/month pass gives you unhindered access across Smart TVs, Android, iPhone, iPad, Windows, and Mac with synchronized playback and offline mobile downloads.
                </p>
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {(aboutConfig?.featurePills && aboutConfig.featurePills.length > 0
                ? aboutConfig.featurePills
                : ["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"]
              ).map((pill, idx) => (
                <span key={idx} className="bg-[#240f12] text-[#d31d38] font-bold text-xs px-3.5 py-1.5 rounded-full border border-[#d31d38]/30">
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* Right Visual Box */}
          <div className="md:col-span-5 relative min-h-[300px] md:min-h-full overflow-hidden bg-[#100507]">
            {aboutConfig?.imageUrl && (aboutConfig.imageUrl.toLowerCase().endsWith('.mp4') || aboutConfig.imageUrl.toLowerCase().endsWith('.webm') || aboutConfig.imageUrl.toLowerCase().endsWith('.mov') || aboutConfig.imageUrl.toLowerCase().endsWith('.mkv') || aboutConfig.imageUrl.toLowerCase().includes('video')) ? (
              <video 
                src={aboutConfig.imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src={aboutConfig.imageUrl} />
              </video>
            ) : (
              <img 
                src={aboutConfig?.imageUrl || aboutBg} 
                alt={aboutConfig?.imageAlt || "Cinode 4K Cinema Engine"}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e: any) => { e.target.src = aboutBg; }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#180a0c] via-transparent to-transparent md:bg-gradient-to-l md:from-transparent md:to-[#180a0c]/60" />
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-left space-y-1">
              <span className="text-[10px] text-[#d31d38] font-black uppercase tracking-wider block">
                {aboutConfig?.captionTitle || "Direct Cloud Storage Architecture"}
              </span>
              <p className="text-xs text-white font-bold">
                {aboutConfig?.captionDesc || "10,000+ Hours of 4K Remastered Cinema & TV Series"}
              </p>
            </div>
          </div>

        </div>

        {/* Feature Highlights Bento in Burgundy Theme */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-8">
          {(aboutConfig?.cards && aboutConfig.cards.length > 0 ? aboutConfig.cards : [
            { id: 'c1', title: 'Zero Buffer Engine', desc: 'Direct-play 45Mbps video streams backed by dedicated high-speed storage. Movies and series launch instantly without waiting.', icon: 'Zap' },
            { id: 'c2', title: 'Any Screen, Everywhere', desc: 'Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device. Seamless playback synchronization.', icon: 'Tv' },
            { id: 'c3', title: 'Offline Downloads', desc: 'Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.', icon: 'Smartphone' }
          ]).map((card, idx) => {
            const iconColors = ['text-[#d31d38] border-[#d31d38]/30', 'text-amber-400 border-amber-400/30', 'text-cyan-400 border-cyan-400/30'];
            const colorClass = iconColors[idx % iconColors.length];
            return (
              <div key={card.id || idx} className="bg-[#180a0c] border border-[#2e1216] p-6 rounded-2xl relative overflow-hidden group hover:border-[#d31d38] transition duration-300">
                <div className={`w-10 h-10 rounded-xl bg-[#240f12] ${colorClass} border flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition`}>
                  {card.icon === 'Tv' ? <Tv className="w-5 h-5" /> : card.icon === 'Smartphone' ? <Smartphone className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </div>
                <h3 className="text-lg font-black text-white mb-2">{card.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                  {card.desc}
                </p>
              </div>
            );
          })}
        </div>

      </section>

      {/* ========================================================================= */}
      {/* "TRENDING" SECTION - HORIZONTAL CAROUSEL */}
      {/* ========================================================================= */}
      <section className="py-16 px-6 max-w-6xl mx-auto relative z-10" id="trending">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 text-left">
          <div>
            <span className="text-[#d31d38] font-bold text-xs uppercase tracking-widest block mb-1">
              🔥 4K CINEMA CATALOG
            </span>
            <h3 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
              Trending
            </h3>
          </div>

          {/* Category Filter Tabs & Carousel Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#180a0c] border border-[#2e1216] p-1.5 rounded-xl">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'all' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveCategory('horror')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'horror' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Horror
              </button>
              <button
                onClick={() => setActiveCategory('action')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'action' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Action
              </button>
              <button
                onClick={() => setActiveCategory('scifi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'scifi' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sci-Fi
              </button>
              <button
                onClick={() => setActiveCategory('series')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'series' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Series
              </button>
              <button
                onClick={() => setActiveCategory('anime')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeCategory === 'anime' 
                    ? 'bg-[#d31d38] text-white' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Anime
              </button>
            </div>

            {/* Carousel Prev/Next Buttons */}
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => scrollTrending('left')}
                className="w-9 h-9 rounded-xl bg-[#180a0c] border border-[#2e1216] hover:border-[#d31d38] text-white flex items-center justify-center transition cursor-pointer hover:bg-[#d31d38]/20"
                title="Scroll Left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollTrending('right')}
                className="w-9 h-9 rounded-xl bg-[#180a0c] border border-[#2e1216] hover:border-[#d31d38] text-white flex items-center justify-center transition cursor-pointer hover:bg-[#d31d38]/20"
                title="Scroll Right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Trending Carousel Container */}
        <div 
          ref={trendingCarouselRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 scrollbar-thin"
        >
          {filteredCatalog.map((movie) => (
            <div 
              key={movie.id}
              onClick={() => setPreviewMovie(movie)}
              className="w-[170px] sm:w-[210px] md:w-[230px] shrink-0 snap-start bg-[#180a0c] border border-[#2e1216] rounded-xl overflow-hidden group cursor-pointer hover:border-[#d31d38] transition duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-[#d31d38]/20 hover:-translate-y-1"
            >
              <div className="aspect-[2/3] relative overflow-hidden bg-black">
                <img 
                  src={movie.cover} 
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#180a0c] via-transparent to-transparent opacity-85" />
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-amber-400 border border-amber-400/30 flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400" /> {movie.rating}
                </div>
                <div className="absolute top-2 right-2 bg-[#d31d38] px-1.5 py-0.5 rounded text-[8px] font-black text-white uppercase">
                  {movie.quality}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#d31d38] text-white flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition duration-300">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="p-3.5 text-left space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                  <span>{movie.year}</span>
                  <span className="text-[#d31d38] font-bold">{movie.duration}</span>
                </div>
                <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate group-hover:text-[#d31d38] transition">
                  {movie.title}
                </h4>
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ========================================================================= */}
      {/* EXACT REFERENCE "JOIN OUR COMMUNITY" SPLIT CTA BANNER */}
      {/* ========================================================================= */}
      <section className="py-16 sm:py-20 px-6 max-w-6xl mx-auto relative z-10" id="community">
        <div className="rounded-2xl overflow-hidden border border-[#2e1216] shadow-2xl grid grid-cols-1 md:grid-cols-12 min-h-[160px]">
          
          {/* Left Dark Burgundy Half: "Join Our Community" */}
          <div className="md:col-span-7 bg-[#180a0c] p-8 sm:p-12 flex flex-col justify-center text-left">
            <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight">
              Join Our Community
            </h2>
            <p className="text-xs sm:text-sm text-[#b8a7aa] mt-2 font-medium">
              Over 1,840+ Nigerian movie lovers streaming 4K cinema daily. Submit requests & share reviews.
            </p>
          </div>

          {/* Right Solid Crimson Red Half: "Join" */}
          <div className="md:col-span-5 bg-[#d31d38] hover:bg-[#b91228] p-8 sm:p-12 flex items-center justify-center transition duration-300">
            <button 
              onClick={() => {
                if (currentUser) {
                  window.location.href = '#portal';
                } else {
                  setError(null);
                  setAuthModal('signup');
                }
              }}
              className="w-full h-full text-3xl sm:text-5xl font-display font-black text-white tracking-tight uppercase cursor-pointer hover:scale-105 transition duration-200 flex items-center justify-center gap-3"
            >
              Join <ArrowRight className="w-8 h-8" />
            </button>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* ₦600 ALL-ACCESS SUBSCRIPTION PLAN */}
      {/* ========================================================================= */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center relative z-10" id="pricing">
        <div className="inline-flex items-center gap-1 bg-[#180a0c] border border-[#d31d38]/40 text-[#d31d38] font-bold text-xs px-3.5 py-1.5 rounded-full mb-4">
          <Flame className="w-3.5 h-3.5" /> UNLIMITED STREAMING PASS
        </div>
        <h2 className="text-3xl sm:text-5xl font-display font-black text-white tracking-tight mb-3">
          Simple, All-Inclusive ₦600 Plan
        </h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-10">
          One transparent pass unlocks 30 full days of 4K streaming. Zero ads, zero hidden fees.
        </p>

        <div className="max-w-md mx-auto bg-[#180a0c] border-2 border-[#d31d38] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-[#d31d38]/20 relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 bg-[#d31d38] text-white font-black text-[9px] uppercase tracking-widest py-1 px-4 rounded-bl-xl shadow">
            🩸 30-DAY PASS
          </div>

          <span className="text-xs font-bold text-[#d31d38] uppercase tracking-widest block mb-1">
            CINODE ALL-ACCESS PASS
          </span>
          <h3 className="text-xl font-black text-white mb-4">UNLIMITED CINEMA PASS</h3>

          <div className="flex items-baseline justify-center mb-4">
            <span className="text-5xl font-display font-black tracking-tight text-white">₦600</span>
            <span className="text-slate-400 font-bold ml-2 text-xs uppercase">/ 30 Days</span>
          </div>

          <p className="text-slate-300 text-xs mb-6 leading-relaxed">
            Full access to our private media library, 4K HDR direct playback, instant content requests, and simultaneous playback across all your personal devices.
          </p>

          <ul className="text-left space-y-2.5 mb-6 text-xs text-slate-200 font-medium">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d31d38] shrink-0" />
              100% Ad-Free Unlimited Cinema & TV Series
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d31d38] shrink-0" />
              Private Streaming Profile with Auto-Sync
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d31d38] shrink-0" />
              Stream on Smart TV, Android, iPhone, Laptop & Tablet
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d31d38] shrink-0" />
              Instant 1-Click Paystack, Monnify, Squad & Bank Transfer
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#d31d38] shrink-0" />
              Built-in Movie & Series Request System
            </li>
          </ul>

          {currentUser ? (
            <button 
              onClick={() => { window.location.href = '#portal'; }}
              className="w-full bg-[#d31d38] hover:bg-[#b91228] text-white font-black py-3 rounded-xl cursor-pointer shadow-lg shadow-[#d31d38]/30 transition text-xs uppercase tracking-wide"
            >
              Open Stream Portal
            </button>
          ) : (
            <button 
              onClick={() => { setError(null); setAuthModal('signup'); }}
              className="w-full bg-[#d31d38] hover:bg-[#b91228] text-white font-black py-3.5 rounded-xl cursor-pointer shadow-xl shadow-[#d31d38]/40 transition text-xs uppercase tracking-wide"
            >
              Get Started For ₦600
            </button>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MOBILE APP SETUP INSTRUCTION SECTION */}
      {/* ========================================================================= */}
      <section className="bg-[#100507] border-y border-[#2e1216] py-16 px-6 relative z-10" id="mobile-apps">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
          
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-1 bg-[#180a0c] border border-[#d31d38]/30 text-[#d31d38] font-bold text-xs px-3 py-1 rounded-full">
              <Smartphone className="w-3.5 h-3.5" /> OFFICIAL CLIENT APPS
            </div>

            <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight leading-tight">
              Stream on Mobile & TV <br />
              <span className="text-[#d31d38]">
                Anywhere, Anytime.
              </span>
            </h2>

            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Save blockbusters directly onto your phone or tablet. Watch offline with zero buffer or data drain.
            </p>

            <div className="bg-[#180a0c] border border-[#2e1216] rounded-xl p-4 text-left max-w-xl space-y-2 shadow-xl">
              <span className="text-[#d31d38] font-bold text-xs flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Mobile & TV Server Address
              </span>
              <p className="text-slate-300 text-xs leading-relaxed">
                When prompted by the mobile app for your <strong>Server URL</strong>, enter:
              </p>
              <div className="bg-[#080304] border border-[#2e1216] rounded-lg px-3.5 py-2.5 text-[#d31d38] font-mono text-xs flex items-center justify-between gap-2 font-bold">
                <span className="truncate">https://cinode.zerolord.com</span>
                <button 
                  onClick={copyServerAddress}
                  className="bg-[#d31d38]/20 hover:bg-[#d31d38] text-[#d31d38] hover:text-white px-2.5 py-1 rounded text-[10px] font-sans font-extrabold uppercase transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedServerUrl ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="relative border border-[#2e1216] rounded-2xl bg-[#180a0c] p-5 shadow-2xl max-w-xs overflow-hidden group hover:border-[#d31d38] transition duration-300">
              <div className="flex items-center justify-between border-b border-[#2e1216] pb-2.5 mb-3">
                <span className="text-xs text-[#d31d38] font-bold uppercase tracking-widest flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> Mobile Offline Player
                </span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                  4K HDR Ready
                </span>
              </div>

              <div className="aspect-video bg-black rounded-lg relative overflow-hidden mb-3">
                <img 
                  src={classicPoster} 
                  alt="Evil Dead" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-2.5">
                  <span className="text-[8px] text-[#d31d38] font-bold uppercase tracking-wider">Now Playing</span>
                  <h4 className="text-xs font-bold text-white tracking-tight truncate">The Evil Dead (1981)</h4>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                  <span>Direct High-Speed Playback</span>
                  <span className="text-[#d31d38]">45 Mbps</span>
                </div>
                <div className="w-full bg-black h-1.5 rounded-full overflow-hidden border border-[#2e1216]">
                  <div className="bg-[#d31d38] h-full rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* FAQS */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-3xl mx-auto text-left relative z-10" id="faqs">
        <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight mb-8 text-center">
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {(landingFaqs && landingFaqs.length > 0 
            ? landingFaqs.map(f => ({ q: f.question, a: f.answer })) 
            : faqs
          ).map((faq, idx) => (
            <div 
              key={idx}
              className="bg-[#180a0c] border border-[#2e1216] rounded-xl overflow-hidden transition hover:border-[#d31d38]/50"
            >
              <button 
                onClick={() => toggleFaq(idx)}
                className="w-full p-4 text-left font-bold text-xs sm:text-sm text-white flex items-center justify-between gap-4 cursor-pointer hover:text-[#d31d38] transition"
              >
                <span>{faq.q}</span>
                {faqOpen === idx ? <ChevronUp className="w-4 h-4 text-[#d31d38]" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {faqOpen === idx && (
                <div className="p-4 pt-0 text-xs text-slate-300 leading-relaxed border-t border-[#2e1216]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* FOOTER - CINODE */}
      {/* ========================================================================= */}
      <footer className="bg-[#080304] border-t border-[#240f12] py-12 px-6 relative z-10 text-slate-400 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          
          {/* Logo on Left: CINODE */}
          <div className="flex flex-col items-center md:items-start">
            <div className="text-3xl font-display font-black tracking-wider text-[#d31d38] select-none text-left drop-shadow-[0_0_15px_rgba(211,29,56,0.6)]">
              CINODE
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-medium">
              &copy; {new Date().getFullYear()} Cinode Streaming Network. All rights reserved.
            </span>
          </div>

          {/* Navigation Links Columns matching screenshot */}
          <div className="grid grid-cols-2 gap-12 text-left">
            <div className="space-y-2">
              <a href="#" className="block hover:text-white transition">Home</a>
              <a href="#about" className="block hover:text-white transition">About</a>
              <a href="#trending" className="block hover:text-white transition">Trending</a>
              <a href="#community" className="block hover:text-white transition">Community</a>
            </div>
            <div className="space-y-2">
              <a href="#privacy" className="block hover:text-white transition">Privacy & Policy</a>
              <a href="#terms" className="block hover:text-white transition">Terms and conditions</a>
              <a href="#faqs" className="block hover:text-white transition">FAQ</a>
            </div>
          </div>

          {/* Social Icons matching screenshot */}
          <div className="flex items-center gap-4">
            <a href="#" className="w-8 h-8 rounded-full bg-[#180a0c] border border-[#2e1216] hover:border-[#d31d38] text-white flex items-center justify-center transition hover:scale-110">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-[#180a0c] border border-[#2e1216] hover:border-[#d31d38] text-white flex items-center justify-center transition hover:scale-110">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" className="w-8 h-8 rounded-full bg-[#180a0c] border border-[#2e1216] hover:border-[#d31d38] text-white flex items-center justify-center transition hover:scale-110">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>

        </div>
      </footer>

      {/* ========================================================================= */}
      {/* TRAILER MODAL */}
      {/* ========================================================================= */}
      {showTrailerModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#180a0c] border border-[#2e1216] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setShowTrailerModal(false)}
              className="absolute top-3 right-3 bg-black/80 hover:bg-[#d31d38] text-white p-1.5 rounded-full z-10 cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-video relative overflow-hidden bg-black flex items-center justify-center">
              <img 
                src={heroBg} 
                alt="Evil Dead Trailer Preview" 
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#180a0c] via-transparent to-transparent" />
              <div className="absolute text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#d31d38] text-white flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                  <Play className="w-8 h-8 fill-white ml-1" />
                </div>
                <h3 className="text-2xl font-black text-white">Evil Dead Official 4K Trailer</h3>
                <p className="text-xs text-slate-300 max-w-md">
                  All five Evil Dead franchise films and series are available in full 4K HDR on the Cinode streaming portal.
                </p>
                <button 
                  onClick={() => {
                    setShowTrailerModal(false);
                    if (currentUser) {
                      window.location.href = '#portal';
                    } else {
                      setAuthModal('signup');
                    }
                  }}
                  className="bg-[#d31d38] hover:bg-[#b91228] text-white font-black px-6 py-2.5 rounded-lg text-xs tracking-wider uppercase transition shadow-lg inline-block"
                >
                  Stream Now For ₦600
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOVIE PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewMovie && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#180a0c] border border-[#2e1216] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setPreviewMovie(null)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-[#d31d38] text-white p-1.5 rounded-full z-10 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="aspect-video relative overflow-hidden">
              <img 
                src={previewMovie.cover} 
                alt={previewMovie.title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#180a0c] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 text-left">
                <span className="text-[10px] bg-[#d31d38] text-white font-black px-2 py-0.5 rounded uppercase mr-2">
                  {previewMovie.quality}
                </span>
                <span className="text-xs font-bold text-amber-400">★ {previewMovie.rating}/10</span>
                <h3 className="text-xl font-black text-white mt-1">{previewMovie.title}</h3>
              </div>
            </div>

            <div className="p-5 text-left space-y-4">
              <p className="text-xs text-[#b8a7aa] leading-relaxed">
                {previewMovie.desc}
              </p>

              <div className="bg-[#100507] border border-[#2e1216] rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Subscription Access</span>
                  <span className="text-emerald-400 font-extrabold">₦600 Pass Required</span>
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
                  className="bg-[#d31d38] hover:bg-[#b91228] text-white font-extrabold px-4 py-2 rounded-lg transition text-xs flex items-center gap-1.5 cursor-pointer uppercase"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Watch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTH MODAL (LOGIN / SIGNUP) */}
      {/* ========================================================================= */}
      {authModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#180a0c] border border-[#2e1216] rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setAuthModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#d31d38]/20 text-[#d31d38] rounded-xl flex items-center justify-center mx-auto mb-2 border border-[#d31d38]/30">
                {authModal === 'forgot' ? (
                  <KeyRound className="w-6 h-6" />
                ) : (
                  <Tv className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-2xl font-display font-black text-white">
                {authModal === 'login' 
                  ? 'Sign In To Cinode' 
                  : authModal === 'signup' 
                  ? 'Join Our Community' 
                  : 'Reset Your Password'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {authModal === 'login' 
                  ? 'Enter your credentials to stream 4K movies' 
                  : authModal === 'signup' 
                  ? 'Get 30 days of unlimited 4K streaming for ₦600' 
                  : 'Enter your email to receive a secure recovery link'}
              </p>
            </div>

            {error && (
              <div className="bg-[#d31d38]/20 border border-[#d31d38]/40 text-[#ff8093] p-3 rounded-xl text-xs mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {authModal === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Username</label>
                  <input 
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoComplete="username"
                    className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setForgotErrorMsg(null);
                        setForgotSuccessMsg(null);
                        setAuthModal('forgot');
                      }}
                      className="text-[11px] text-[#ff4d64] hover:text-[#ff8093] hover:underline transition font-semibold cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input 
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="w-full bg-[#100507] border border-[#2e1216] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition cursor-pointer rounded"
                      title={showLoginPassword ? 'Hide password' : 'Show password'}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4 text-[#ff4d64]" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#d31d38] hover:bg-[#b91228] text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#d31d38]/30 uppercase tracking-wider"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In To Stream'}
                </button>
              </form>
            )}

            {authModal === 'signup' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="John Doe"
                    autoComplete="name"
                    className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
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
                    autoComplete="username"
                    className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
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
                    autoComplete="email"
                    className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                  <div className="relative flex items-center">
                    <input 
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create a strong password (min. 6 chars)"
                      autoComplete="new-password"
                      className="w-full bg-[#100507] border border-[#2e1216] rounded-xl pl-3.5 pr-10 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition cursor-pointer rounded"
                      title={showRegPassword ? 'Hide password' : 'Show password'}
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? (
                        <EyeOff className="w-4 h-4 text-[#ff4d64]" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Referral Code (Optional)</label>
                  <input 
                    type="text"
                    value={regReferredBy}
                    onChange={(e) => setRegReferredBy(e.target.value.toUpperCase())}
                    placeholder="e.g. REF123"
                    className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38] font-mono"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#d31d38] hover:bg-[#b91228] text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#d31d38]/40 uppercase tracking-wider"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account & Get ₦600 Pass'}
                </button>
              </form>
            )}

            {authModal === 'forgot' && (
              <div className="space-y-4">
                {forgotSuccessMsg ? (
                  <div className="text-center py-2 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">Check Your Inbox & Spam Folder</h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {forgotSuccessMsg}
                      </p>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-left flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-200">Important: Check Your Spam / Junk Folder</p>
                        <p className="text-[11px] text-amber-300/90 leading-relaxed">
                          Automated security links are sometimes filtered by email providers. If you don't see the email in your main inbox, please look in your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folder.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setAuthModal('login');
                      }}
                      className="w-full bg-[#240f12] hover:bg-[#38161b] text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {forgotErrorMsg && (
                      <div className="bg-[#d31d38]/20 border border-[#d31d38]/40 text-[#ff8093] p-3 rounded-xl text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{forgotErrorMsg}</span>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Email Address or Username</label>
                      <div className="relative flex items-center">
                        <input 
                          type="text"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Enter your registered email address"
                          autoComplete="email"
                          className="w-full bg-[#100507] border border-[#2e1216] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
                        We'll send a single-use password reset link valid for 60 minutes.
                      </p>
                    </div>

                    {/* Check Spam Notice Box on Form */}
                    <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-left flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        <strong>Please check your Spam / Junk folder:</strong> Password reset emails may occasionally land in your Spam, Junk, or Promotions tab rather than your primary Inbox.
                      </p>
                    </div>

                    <button 
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full bg-[#d31d38] hover:bg-[#b91228] text-white font-extrabold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#d31d38]/30 uppercase tracking-wider"
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Sending Link...
                        </>
                      ) : (
                        'Send Password Reset Link'
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[#2e1216] text-center text-xs text-slate-400">
              {authModal === 'login' ? (
                <p>Don't have an account? <button onClick={() => { setError(null); setAuthModal('signup'); }} className="text-[#d31d38] font-bold hover:underline cursor-pointer">Register for ₦600</button></p>
              ) : authModal === 'signup' ? (
                <p>Already have an account? <button onClick={() => { setError(null); setAuthModal('login'); }} className="text-[#d31d38] font-bold hover:underline cursor-pointer">Sign In</button></p>
              ) : (
                <p>Remember your password? <button onClick={() => { setError(null); setAuthModal('login'); }} className="text-[#d31d38] font-bold hover:underline cursor-pointer">Sign In</button></p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DATABASE DIAGNOSTIC MODAL */}
      {/* ========================================================================= */}
      {dbDiagModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#180a0c] border border-[#2e1216] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setDbDiagModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-[#d31d38]" />
              <h3 className="text-lg font-black text-white">Database Status</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              The portal is operating in high-performance local fallback storage mode. MySQL authorization can be linked anytime in your admin configuration panel.
            </p>
            <button 
              onClick={() => setDbDiagModal(false)}
              className="w-full bg-[#240f12] hover:bg-[#38161b] text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Close Diagnostic
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
