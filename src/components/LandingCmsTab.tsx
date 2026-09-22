import React, { useState, useEffect } from 'react';
import { 
  Tv, Film, Sparkles, Plus, Trash2, Edit, Save, RefreshCw, 
  ArrowUp, ArrowDown, Check, X, Eye, HelpCircle, Layout,
  Sliders, Image as ImageIcon, Video, Star, Clock, 
  AlertCircle, CheckCircle2, Copy, MoveUp, MoveDown,
  Layers, Palette, Type, ExternalLink, Zap, Smartphone,
  Shield, Download, Play, Info, Volume2, VolumeX
} from 'lucide-react';
import { 
  HeroSlideConfig, 
  LandingAboutConfig, 
  LandingFaqItem, 
  LandingPageContent,
  LandingAboutCard 
} from '../types';
import { apiFetch } from '../lib/api';
import RichTextEditor from './RichTextEditor';
import MediaUploadZone from './MediaUploadZone';

interface LandingCmsTabProps {
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
  showToast?: (msg: string, type: 'success' | 'error') => void;
}

const DEFAULT_SLIDE: HeroSlideConfig = {
  id: '',
  title: '',
  tagline: '',
  year: new Date().getFullYear().toString(),
  rating: '9.5',
  quality: '4K Ultra HD',
  duration: '2h 15m',
  mediaType: 'image',
  mediaUrl: '',
  posterUrl: '',
  autoplaySound: true,
  announcement: '',
  slideOrder: 0,
  isActive: true
};

const DEFAULT_FAQ: LandingFaqItem = {
  id: '',
  question: '',
  answer: '',
  faqOrder: 0,
  isActive: true
};

export default function LandingCmsTab({ onShowToast, showToast: propShowToast }: LandingCmsTabProps) {
  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (propShowToast) propShowToast(msg, type);
    else if (onShowToast) onShowToast(msg, type);
  };
  const [subTab, setSubTab] = useState<'hero' | 'about' | 'faqs'>('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Content state
  const [heroSlides, setHeroSlides] = useState<HeroSlideConfig[]>([]);
  const [heroSlideDelaySeconds, setHeroSlideDelaySeconds] = useState<number>(5);
  const [aboutConfig, setAboutConfig] = useState<LandingAboutConfig>({
    header: 'About',
    badge: "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
    subtitle: 'Cinode: Unthrottled 4K Streaming for Everyone',
    contentHtml: '<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p>',
    imageUrl: '',
    imageAlt: 'Cinode 4K Cinema Engine',
    captionTitle: 'Direct Cloud Storage Architecture',
    captionDesc: '10,000+ Hours of 4K Remastered Cinema & TV Series',
    featurePills: ["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"],
    cards: [
      { id: 'c1', title: 'Zero Buffer Engine', desc: 'Direct-play 45Mbps video streams backed by dedicated high-speed storage. Movies and series launch instantly without waiting.', icon: 'Zap' },
      { id: 'c2', title: 'Any Screen, Everywhere', desc: 'Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device. Seamless playback synchronization.', icon: 'Tv' },
      { id: 'c3', title: 'Offline Downloads', desc: 'Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.', icon: 'Smartphone' }
    ]
  });
  const [faqs, setFaqs] = useState<LandingFaqItem[]>([]);

  // Hero Slide Modal/Editor state
  const [editingSlide, setEditingSlide] = useState<HeroSlideConfig | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [slidePreviewIndex, setSlidePreviewIndex] = useState(0);

  // FAQ Modal/Editor state
  const [editingFaq, setEditingFaq] = useState<LandingFaqItem | null>(null);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');

  // Feature pill helper state for About section
  const [newPillText, setNewPillText] = useState('');

  // Fetch full landing content
  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/landing/content');
      const data: LandingPageContent = await res.json();
      if (data) {
        if (data.heroSlides && Array.isArray(data.heroSlides)) {
          setHeroSlides(data.heroSlides);
        }
        if (data.heroSlideDelaySeconds) {
          setHeroSlideDelaySeconds(Number(data.heroSlideDelaySeconds));
        }
        if (data.about) {
          setAboutConfig(data.about);
        }
        if (data.faqs && Array.isArray(data.faqs)) {
          setFaqs(data.faqs);
        }
      }
    } catch (err: any) {
      console.error('Error fetching landing content:', err);
      triggerToast(err.message || 'Failed to load landing page content', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  // Save Hero Slides
  const handleSaveHeroSlides = async (slidesToSave: HeroSlideConfig[], delayToSave: number) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/landing/hero-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: slidesToSave,
          delaySeconds: delayToSave
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save slides');
      setHeroSlides(data.heroSlides);
      setHeroSlideDelaySeconds(data.heroSlideDelaySeconds);
      triggerToast('Hero slides & duration settings updated successfully!', 'success');
      setIsSlideModalOpen(false);
      setEditingSlide(null);
    } catch (err: any) {
      triggerToast(err.message || 'Error saving hero slides', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save About Section
  const handleSaveAbout = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/landing/about', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aboutConfig)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save about section');
      setAboutConfig(data.about);
      triggerToast('About section content updated successfully!', 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Error saving about section', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save FAQs
  const handleSaveFaqs = async (faqsToSave: LandingFaqItem[]) => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/landing/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: faqsToSave })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save FAQs');
      setFaqs(data.faqs);
      triggerToast('FAQs updated successfully!', 'success');
      setIsFaqModalOpen(false);
      setEditingFaq(null);
    } catch (err: any) {
      triggerToast(err.message || 'Error saving FAQs', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Slide CRUD helpers
  const openNewSlideModal = () => {
    setEditingSlide({
      ...DEFAULT_SLIDE,
      id: `slide-${Date.now()}`,
      slideOrder: heroSlides.length
    });
    setIsSlideModalOpen(true);
  };

  const openEditSlideModal = (slide: HeroSlideConfig) => {
    setEditingSlide({ ...slide });
    setIsSlideModalOpen(true);
  };

  const handleDeleteSlide = (id: string) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;
    const updated = heroSlides.filter(s => s.id !== id).map((s, idx) => ({ ...s, slideOrder: idx }));
    setHeroSlides(updated);
    handleSaveHeroSlides(updated, heroSlideDelaySeconds);
  };

  const handleToggleSlideActive = (id: string) => {
    const updated = heroSlides.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
    setHeroSlides(updated);
    handleSaveHeroSlides(updated, heroSlideDelaySeconds);
  };

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= heroSlides.length) return;
    const copy = [...heroSlides];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    const updated = copy.map((s, idx) => ({ ...s, slideOrder: idx }));
    setHeroSlides(updated);
    handleSaveHeroSlides(updated, heroSlideDelaySeconds);
  };

  const handleSaveSlideModal = () => {
    if (!editingSlide) return;
    if (!editingSlide.title.trim()) {
      triggerToast('Please provide a title for the slide', 'error');
      return;
    }
    const exists = heroSlides.some(s => s.id === editingSlide.id);
    let updated: HeroSlideConfig[];
    if (exists) {
      updated = heroSlides.map(s => s.id === editingSlide.id ? editingSlide : s);
    } else {
      updated = [...heroSlides, editingSlide].map((s, idx) => ({ ...s, slideOrder: idx }));
    }
    setHeroSlides(updated);
    handleSaveHeroSlides(updated, heroSlideDelaySeconds);
  };

  // FAQ CRUD helpers
  const openNewFaqModal = () => {
    setEditingFaq({
      ...DEFAULT_FAQ,
      id: `faq-${Date.now()}`,
      faqOrder: faqs.length
    });
    setIsFaqModalOpen(true);
  };

  const openEditFaqModal = (faq: LandingFaqItem) => {
    setEditingFaq({ ...faq });
    setIsFaqModalOpen(true);
  };

  const handleDeleteFaq = (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    const updated = faqs.filter(f => f.id !== id).map((f, idx) => ({ ...f, faqOrder: idx }));
    setFaqs(updated);
    handleSaveFaqs(updated);
  };

  const handleToggleFaqActive = (id: string) => {
    const updated = faqs.map(f => f.id === id ? { ...f, isActive: !f.isActive } : f);
    setFaqs(updated);
    handleSaveFaqs(updated);
  };

  const handleMoveFaq = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;
    const copy = [...faqs];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    const updated = copy.map((f, idx) => ({ ...f, faqOrder: idx }));
    setFaqs(updated);
    handleSaveFaqs(updated);
  };

  const handleSaveFaqModal = () => {
    if (!editingFaq) return;
    if (!editingFaq.question.trim() || !editingFaq.answer.trim()) {
      triggerToast('Please provide both question and answer', 'error');
      return;
    }
    const exists = faqs.some(f => f.id === editingFaq.id);
    let updated: LandingFaqItem[];
    if (exists) {
      updated = faqs.map(f => f.id === editingFaq.id ? editingFaq : f);
    } else {
      updated = [...faqs, editingFaq].map((f, idx) => ({ ...f, faqOrder: idx }));
    }
    setFaqs(updated);
    handleSaveFaqs(updated);
  };

  // Feature pills for About
  const addFeaturePill = () => {
    if (!newPillText.trim()) return;
    const pills = aboutConfig.featurePills || [];
    setAboutConfig({
      ...aboutConfig,
      featurePills: [...pills, newPillText.trim()]
    });
    setNewPillText('');
  };

  const removeFeaturePill = (index: number) => {
    const pills = [...(aboutConfig.featurePills || [])];
    pills.splice(index, 1);
    setAboutConfig({ ...aboutConfig, featurePills: pills });
  };

  // Card update helper for About section
  const updateAboutCard = (index: number, field: keyof LandingAboutCard, val: string) => {
    const cards = [...(aboutConfig.cards || [])];
    if (cards[index]) {
      cards[index] = { ...cards[index], [field]: val };
      setAboutConfig({ ...aboutConfig, cards });
    }
  };

  if (loading) {
    return (
      <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-[#d31d38] animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-semibold">Loading Landing Page CMS Configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#240a0e] text-[#ff4d64] text-xs font-bold uppercase tracking-wider mb-2 border border-[#2e1015]">
              <Layout className="w-3.5 h-3.5" /> Landing Page CMS
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Landing Page Content & Hero Manager
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-2xl">
              Configure hero slider movies, video autoplay streams, duration timing, rich-text about story, and customer FAQs in real-time.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchContent}
              className="px-4 py-2 bg-[#180608] hover:bg-[#240a0e] text-zinc-300 hover:text-white border border-[#2e1015] rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <a
              href="#"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-[0_4px_15px_rgba(211,29,56,0.4)] cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> View Live Page
            </a>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-[#2e1015] overflow-x-auto pb-1">
          {[
            { id: 'hero', label: 'Hero Slider & Videos', icon: Tv, count: heroSlides.length },
            { id: 'about', label: 'About Section & Rich Text', icon: Type },
            { id: 'faqs', label: 'FAQ Manager (CRUD)', icon: HelpCircle, count: faqs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#d31d38] to-[#b0162c] text-white shadow-[0_4px_14px_rgba(211,29,56,0.35)]'
                    : 'bg-[#180608] text-zinc-400 hover:text-white hover:bg-[#240a0e] border border-[#2e1015]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-[#240a0e] text-zinc-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. HERO SLIDER MANAGER TAB */}
      {/* ========================================================================= */}
      {subTab === 'hero' && (
        <div className="space-y-6">
          
          {/* Controls Bar: Delay & Add Button */}
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">
                  Slide Interval (Seconds Delay)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="2"
                      max="60"
                      value={heroSlideDelaySeconds}
                      onChange={(e) => setHeroSlideDelaySeconds(Math.max(2, parseInt(e.target.value) || 5))}
                      className="w-24 bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-1.5 text-sm font-bold text-white text-center focus:outline-none focus:border-[#d31d38]"
                    />
                    <span className="absolute right-3 top-2 text-xs text-zinc-500 font-mono">sec</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[3, 5, 8, 10].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setHeroSlideDelaySeconds(sec);
                          handleSaveHeroSlides(heroSlides, sec);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          heroSlideDelaySeconds === sec
                            ? 'bg-[#d31d38] text-white'
                            : 'bg-[#180608] text-zinc-400 hover:text-white border border-[#2e1015]'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveHeroSlides(heroSlides, heroSlideDelaySeconds)}
                className="mt-4 sm:mt-0 px-4 py-2 bg-[#240a0e] hover:bg-[#2e1015] text-[#ff4d64] border border-[#d31d38]/40 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Slide Delay
              </button>
            </div>

            <button
              type="button"
              onClick={openNewSlideModal}
              className="px-5 py-2.5 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-[0_4px_15px_rgba(211,29,56,0.35)] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Hero Slide
            </button>
          </div>

          {/* Hero Slides Grid */}
          <div className="space-y-4">
            {heroSlides.length === 0 ? (
              <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-12 text-center">
                <Tv className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No Hero Slides Configured</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mb-4">
                  Add posters or autoplay background videos to display on the landing page hero banner.
                </p>
                <button
                  type="button"
                  onClick={openNewSlideModal}
                  className="px-4 py-2 bg-[#d31d38] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add First Slide
                </button>
              </div>
            ) : (
              heroSlides.map((slide, idx) => (
                <div
                  key={slide.id}
                  className={`bg-[#120507] border rounded-2xl p-4 sm:p-5 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl ${
                    slide.isActive ? 'border-[#2e1015] hover:border-[#d31d38]/50' : 'border-[#2e1015]/40 opacity-60'
                  }`}
                >
                  {/* Left Media Preview & Meta */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Media Thumbnail */}
                    <div className="w-20 sm:w-28 h-16 sm:h-20 rounded-xl bg-black border border-[#2e1015] overflow-hidden shrink-0 relative group">
                      {slide.mediaType === 'video' ? (
                        <div className="w-full h-full relative bg-zinc-900 flex items-center justify-center">
                          {slide.posterUrl || slide.mediaUrl ? (
                            <video
                              src={slide.mediaUrl}
                              poster={slide.posterUrl}
                              muted
                              loop
                              autoPlay
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Video className="w-6 h-6 text-zinc-500" />
                          )}
                          <div className="absolute top-1 left-1 bg-[#d31d38] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                            <Video className="w-2.5 h-2.5" /> Video
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full relative bg-zinc-900">
                          {slide.mediaUrl ? (
                            <img
                              src={slide.mediaUrl}
                              alt={slide.title}
                              className="w-full h-full object-cover"
                              onError={(e: any) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-zinc-500" />
                            </div>
                          )}
                          <div className="absolute top-1 left-1 bg-zinc-800 text-zinc-300 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5">
                            <ImageIcon className="w-2.5 h-2.5" /> Image
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Meta Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#180608] text-zinc-400 border border-[#2e1015]">
                          #{idx + 1}
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                          {slide.title}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ★ {slide.rating || '9.0'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                          {slide.quality || '4K'}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold">
                          {slide.year}
                        </span>
                      </div>
                      
                      <p className="text-xs text-zinc-400 truncate max-w-xl">
                        {slide.tagline || slide.announcement || 'No tagline set'}
                      </p>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#2e1015]">
                    
                    {/* Active toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleSlideActive(slide.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        slide.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{slide.isActive ? 'Active' : 'Disabled'}</span>
                    </button>

                    {/* Order up/down */}
                    <div className="flex items-center gap-1 bg-[#180608] border border-[#2e1015] rounded-xl p-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, 'up')}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === heroSlides.length - 1}
                        onClick={() => handleMoveSlide(idx, 'down')}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => openEditSlideModal(slide)}
                      className="p-2 bg-[#180608] hover:bg-[#240a0e] text-zinc-300 hover:text-white border border-[#2e1015] rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Edit Slide"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(slide.id)}
                      className="p-2 bg-[#180608] hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-[#2e1015] hover:border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Delete Slide"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABOUT SECTION & RICH TEXT EDITOR TAB */}
      {/* ========================================================================= */}
      {subTab === 'about' && (
        <div className="space-y-6">
          
          <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2e1015] pb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white">About Section Headings & Story</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update the landing page story using the rich text formatting suite with WYSIWYG and HTML modes.
                </p>
              </div>
              
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAbout}
                className="px-6 py-2.5 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-[0_4px_15px_rgba(211,29,56,0.35)] cursor-pointer"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save About Content</span>
              </button>
            </div>

            {/* Header & Eyebrow & Subtitle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Main Section Title
                </label>
                <input
                  type="text"
                  value={aboutConfig.header}
                  onChange={(e) => setAboutConfig({ ...aboutConfig, header: e.target.value })}
                  placeholder="About"
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#d31d38]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Badge / Eyebrow Tag
                </label>
                <input
                  type="text"
                  value={aboutConfig.badge}
                  onChange={(e) => setAboutConfig({ ...aboutConfig, badge: e.target.value })}
                  placeholder="⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK"
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#d31d38]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Headline Subtitle
                </label>
                <input
                  type="text"
                  value={aboutConfig.subtitle}
                  onChange={(e) => setAboutConfig({ ...aboutConfig, subtitle: e.target.value })}
                  placeholder="Cinode: Unthrottled 4K Streaming for Everyone"
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#d31d38]"
                />
              </div>
            </div>

            {/* Rich Text Editor for About Body */}
            <div>
              <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-2">
                About Narrative (Rich Text Editor with WYSIWYG & HTML Mode)
              </label>
              <RichTextEditor
                value={aboutConfig.contentHtml}
                onChange={(html) => setAboutConfig({ ...aboutConfig, contentHtml: html })}
                placeholder="Write your story, paragraphs, and list features here..."
                minHeight="260px"
              />
            </div>

            {/* Feature Pills Tag Manager */}
            <div>
              <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-2">
                Feature Highlights Badges / Pills
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(aboutConfig.featurePills || []).map((pill, idx) => (
                  <span
                    key={idx}
                    className="bg-[#180608] text-[#ff4d64] border border-[#2e1015] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>{pill}</span>
                    <button
                      type="button"
                      onClick={() => removeFeaturePill(idx)}
                      className="text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={newPillText}
                  onChange={(e) => setNewPillText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeaturePill())}
                  placeholder="e.g. ⚡ 45Mbps Direct Play Engine"
                  className="flex-1 bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                />
                <button
                  type="button"
                  onClick={addFeaturePill}
                  className="px-3 py-2 bg-[#240a0e] hover:bg-[#2e1015] text-white border border-[#2e1015] rounded-xl text-xs font-bold cursor-pointer"
                >
                  Add Pill
                </button>
              </div>
            </div>

            {/* Right-side Media & Caption Settings */}
            <div className="border-t border-[#2e1015] pt-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
                About Right-Side Card Media & Overlay Caption
              </h3>
              
              <div className="space-y-4">
                <MediaUploadZone
                  label="About Feature Artwork / Video Media"
                  subLabel="Upload a 4K image or video file (up to 250MB), or enter a direct media URL."
                  acceptType="all"
                  currentUrl={aboutConfig.imageUrl || ''}
                  mediaType={aboutConfig.imageUrl && (aboutConfig.imageUrl.endsWith('.mp4') || aboutConfig.imageUrl.endsWith('.webm') || aboutConfig.imageUrl.endsWith('.mov')) ? 'video' : 'image'}
                  onMediaChanged={(url) => setAboutConfig({ ...aboutConfig, imageUrl: url })}
                  onShowToast={triggerToast}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">
                      Overlay Caption Header
                    </label>
                    <input
                      type="text"
                      value={aboutConfig.captionTitle || ''}
                      onChange={(e) => setAboutConfig({ ...aboutConfig, captionTitle: e.target.value })}
                      placeholder="Direct Cloud Storage Architecture"
                      className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">
                      Overlay Caption Description
                    </label>
                    <input
                      type="text"
                      value={aboutConfig.captionDesc || ''}
                      onChange={(e) => setAboutConfig({ ...aboutConfig, captionDesc: e.target.value })}
                      placeholder="10,000+ Hours of 4K Remastered Cinema & TV Series"
                      className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Highlight Bento Cards */}
            <div className="border-t border-[#2e1015] pt-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
                3 Feature Highlight Cards
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(aboutConfig.cards || []).map((card, idx) => (
                  <div key={card.id || idx} className="bg-[#180608] border border-[#2e1015] rounded-2xl p-4 space-y-3">
                    <div className="text-[10px] font-bold text-[#ff4d64] uppercase font-mono">
                      Card #{idx + 1}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Title</label>
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) => updateAboutCard(idx, 'title', e.target.value)}
                        className="w-full bg-[#120507] border border-[#2e1015] rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#d31d38]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={card.desc}
                        onChange={(e) => updateAboutCard(idx, 'desc', e.target.value)}
                        className="w-full bg-[#120507] border border-[#2e1015] rounded-xl p-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d31d38]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. FAQ CRUD MANAGER TAB */}
      {/* ========================================================================= */}
      {subTab === 'faqs' && (
        <div className="space-y-6">
          
          <div className="bg-[#120507] border border-[#2e1015] rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-white">Frequently Asked Questions (FAQ)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Full CRUD control for questions, answers, ordering, and visibility on the landing page.
              </p>
            </div>

            <button
              type="button"
              onClick={openNewFaqModal}
              className="px-5 py-2.5 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition shadow-[0_4px_15px_rgba(211,29,56,0.35)] cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New FAQ
            </button>
          </div>

          {/* FAQs List */}
          <div className="space-y-3">
            {faqs.length === 0 ? (
              <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-12 text-center">
                <HelpCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No FAQs Configured</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mb-4">
                  Create customer questions and answers to show on the landing page.
                </p>
                <button
                  type="button"
                  onClick={openNewFaqModal}
                  className="px-4 py-2 bg-[#d31d38] text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add First FAQ
                </button>
              </div>
            ) : (
              faqs.map((faq, idx) => (
                <div
                  key={faq.id}
                  className={`bg-[#120507] border rounded-2xl p-4 sm:p-5 transition shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    faq.isActive ? 'border-[#2e1015] hover:border-[#d31d38]/50' : 'border-[#2e1015]/40 opacity-60'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[#180608] text-zinc-400 border border-[#2e1015]">
                        Q{idx + 1}
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold text-white">
                        {faq.question}
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFaqActive(faq.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        faq.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{faq.isActive ? 'Active' : 'Hidden'}</span>
                    </button>

                    <div className="flex items-center gap-1 bg-[#180608] border border-[#2e1015] rounded-xl p-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveFaq(idx, 'up')}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === faqs.length - 1}
                        onClick={() => handleMoveFaq(idx, 'down')}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditFaqModal(faq)}
                      className="p-2 bg-[#180608] hover:bg-[#240a0e] text-zinc-300 hover:text-white border border-[#2e1015] rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Edit FAQ"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(faq.id)}
                      className="p-2 bg-[#180608] hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-[#2e1015] hover:border-rose-800 rounded-xl text-xs font-bold transition cursor-pointer"
                      title="Delete FAQ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO SLIDE MODAL (CREATE / EDIT) */}
      {/* ========================================================================= */}
      {isSlideModalOpen && editingSlide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-[#2e1015] pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#240a0e] text-[#d31d38] flex items-center justify-center font-bold">
                  {editingSlide.mediaType === 'video' ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {heroSlides.some(s => s.id === editingSlide.id) ? 'Edit Hero Slide' : 'Create New Hero Slide'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#180608]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Media Type Selection */}
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Media Background Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingSlide({ ...editingSlide, mediaType: 'image' })}
                    className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                      editingSlide.mediaType === 'image'
                        ? 'bg-[#d31d38] text-white border-[#d31d38] shadow-[0_0_15px_rgba(211,29,56,0.4)]'
                        : 'bg-[#180608] text-zinc-400 hover:text-white border-[#2e1015]'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" /> Static 4K Poster / Image
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingSlide({ ...editingSlide, mediaType: 'video' })}
                    className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                      editingSlide.mediaType === 'video'
                        ? 'bg-[#d31d38] text-white border-[#d31d38] shadow-[0_0_15px_rgba(211,29,56,0.4)]'
                        : 'bg-[#180608] text-zinc-400 hover:text-white border-[#2e1015]'
                    }`}
                  >
                    <Video className="w-4 h-4" /> Autoplay Video Stream
                  </button>
                </div>
              </div>

              {/* Title & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                    Movie / Show Title *
                  </label>
                  <input
                    type="text"
                    value={editingSlide.title}
                    onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                    placeholder="e.g. EVIL DEAD"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                    Hero Tagline Banner
                  </label>
                  <input
                    type="text"
                    value={editingSlide.tagline}
                    onChange={(e) => setEditingSlide({ ...editingSlide, tagline: e.target.value })}
                    placeholder="e.g. CINODE 4K STREAMING NETWORK • ₦600 UNLIMITED PASS"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>
              </div>

              {/* Media Upload / URL & Video Poster */}
              <div className="space-y-4 pt-2">
                <MediaUploadZone
                  label={editingSlide.mediaType === 'video' ? 'Hero Slide Video Background' : 'Hero Slide 4K Backdrop Poster / Video'}
                  subLabel={editingSlide.mediaType === 'video' 
                    ? 'Upload video file (MP4, WebM, MOV, MKV) or enter stream URL. Autoplays in loop on hero banner.' 
                    : 'Upload high-resolution backdrop image (JPG, PNG, WebP) or video (MP4, WebM) or enter URL.'}
                  acceptType="all"
                  currentUrl={editingSlide.mediaUrl}
                  mediaType={editingSlide.mediaType}
                  onMediaChanged={(url, detectedType) => {
                    setEditingSlide({ 
                      ...editingSlide, 
                      mediaUrl: url,
                      mediaType: detectedType || (url && (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('.mkv')) ? 'video' : editingSlide.mediaType)
                    });
                  }}
                  onShowToast={triggerToast}
                  required
                />

                {editingSlide.mediaType === 'video' && (
                  <div className="border-t border-[#2e1015] pt-3">
                    <MediaUploadZone
                      label="Video Poster / Fallback Image (Optional)"
                      subLabel="Displayed while the video buffer is loading, or on bandwidth-restricted devices."
                      acceptType="image"
                      currentUrl={editingSlide.posterUrl || ''}
                      mediaType="image"
                      onMediaChanged={(url) => setEditingSlide({ ...editingSlide, posterUrl: url })}
                      onShowToast={triggerToast}
                    />
                  </div>
                )}
              </div>

              {/* Badges: Rating, Quality, Year, Duration */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Rating</label>
                  <input
                    type="text"
                    value={editingSlide.rating}
                    onChange={(e) => setEditingSlide({ ...editingSlide, rating: e.target.value })}
                    placeholder="9.9"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Quality</label>
                  <input
                    type="text"
                    value={editingSlide.quality}
                    onChange={(e) => setEditingSlide({ ...editingSlide, quality: e.target.value })}
                    placeholder="4K Remaster"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Year</label>
                  <input
                    type="text"
                    value={editingSlide.year}
                    onChange={(e) => setEditingSlide({ ...editingSlide, year: e.target.value })}
                    placeholder="2024"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1">Duration</label>
                  <input
                    type="text"
                    value={editingSlide.duration}
                    onChange={(e) => setEditingSlide({ ...editingSlide, duration: e.target.value })}
                    placeholder="2h 15m"
                    className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                  />
                </div>
              </div>

              {/* Announcement text */}
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Bottom Announcement Box Text
                </label>
                <textarea
                  rows={2}
                  value={editingSlide.announcement}
                  onChange={(e) => setEditingSlide({ ...editingSlide, announcement: e.target.value })}
                  placeholder="Descriptive text highlighted at the bottom of the hero banner..."
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d31d38]"
                />
              </div>

              {/* Audio Autoplay Switch (for Video slides) */}
              {editingSlide.mediaType === 'video' && (
                <div className="flex items-center justify-between p-3.5 bg-[#180608] border border-[#2e1015] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#240a0e] text-[#ff4d64] flex items-center justify-center">
                      {editingSlide.autoplaySound !== false ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Autoplay with Cinema Sound</span>
                      <span className="text-[10px] text-zinc-400">Play trailer audio automatically when this slide rotates into view.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSlide({ ...editingSlide, autoplaySound: editingSlide.autoplaySound === false ? true : false })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      editingSlide.autoplaySound !== false ? 'bg-emerald-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      editingSlide.autoplaySound !== false ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}

              {/* Active Switch */}
              <div className="flex items-center justify-between p-3 bg-[#180608] border border-[#2e1015] rounded-xl">
                <div>
                  <span className="text-xs font-bold text-white block">Slide Active Status</span>
                  <span className="text-[10px] text-zinc-500">When active, this slide will rotate in the hero carousel.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSlide({ ...editingSlide, isActive: !editingSlide.isActive })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    editingSlide.isActive ? 'bg-[#d31d38]' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    editingSlide.isActive ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e1015]">
              <button
                type="button"
                onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }}
                className="px-4 py-2 bg-[#180608] text-zinc-400 hover:text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveSlideModal}
                className="px-6 py-2 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-[0_4px_15px_rgba(211,29,56,0.4)] cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Slide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FAQ MODAL (CREATE / EDIT) */}
      {/* ========================================================================= */}
      {isFaqModalOpen && editingFaq && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#120507] border border-[#2e1015] rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#2e1015] pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#240a0e] text-[#d31d38] flex items-center justify-center font-bold">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {faqs.some(f => f.id === editingFaq.id) ? 'Edit FAQ' : 'Add New FAQ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setIsFaqModalOpen(false); setEditingFaq(null); }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-[#180608]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Question *
                </label>
                <input
                  type="text"
                  value={editingFaq.question}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  placeholder="e.g. How does the ₦600 subscription work?"
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#d31d38]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Answer *
                </label>
                <textarea
                  rows={5}
                  value={editingFaq.answer}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="Write full explanatory answer here..."
                  className="w-full bg-[#180608] border border-[#2e1015] rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-[#d31d38] leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#180608] border border-[#2e1015] rounded-xl">
                <div>
                  <span className="text-xs font-bold text-white block">FAQ Visibility</span>
                  <span className="text-[10px] text-zinc-500">Show or hide this question from the landing page.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingFaq({ ...editingFaq, isActive: !editingFaq.isActive })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    editingFaq.isActive ? 'bg-[#d31d38]' : 'bg-zinc-700'
                  }`}
                >
                  <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                    editingFaq.isActive ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e1015]">
              <button
                type="button"
                onClick={() => { setIsFaqModalOpen(false); setEditingFaq(null); }}
                className="px-4 py-2 bg-[#180608] text-zinc-400 hover:text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveFaqModal}
                className="px-6 py-2 bg-[#d31d38] hover:bg-[#b0162c] text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-[0_4px_15px_rgba(211,29,56,0.4)] cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save FAQ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
