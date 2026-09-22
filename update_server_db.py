with open('server/db.ts', 'r') as f:
    text = f.read()

# 1. Add heroSlideDelaySeconds in JellyfinConfig
target_config = "  squadSftpLastStatus?: string;\n}"
replace_config = """  squadSftpLastStatus?: string;
  heroSlideDelaySeconds?: number;
}"""
text = text.replace(target_config, replace_config)

# 2. Add local in-memory stores
target_locals = "export const localSquadSftpLogs: SquadSftpLogRecord[] = [];"
replace_locals = """export const localSquadSftpLogs: SquadSftpLogRecord[] = [];

export interface HeroSlideRecord {
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
  announcement: string;
  slideOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export interface LandingAboutRecord {
  id: string;
  header: string;
  badge: string;
  subtitle: string;
  contentHtml: string;
  imageUrl: string;
  imageAlt?: string;
  captionTitle?: string;
  captionDesc?: string;
  featurePillsJson?: string;
  cardsJson?: string;
  updatedAt: string;
}

export interface LandingFaqRecord {
  id: string;
  question: string;
  answer: string;
  faqOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlideRecord[] = [
  {
    id: 'slide-evil-dead',
    title: 'EVIL DEAD',
    tagline: 'CINODE 4K STREAMING NETWORK • ₦600 UNLIMITED PASS',
    year: '1981 - 2023',
    rating: '9.9',
    quality: '4K Remaster',
    duration: 'Franchise Boxset',
    mediaType: 'image',
    mediaUrl: '',
    posterUrl: '',
    announcement: "Bruce Campbell and Sam Raimi's legendary Evil Dead universe is fully remastered in 4K HDR. Stream unrated cuts and behind-the-scenes specials with zero buffer on Cinode.",
    slideOrder: 0,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'slide-dune-2',
    title: 'DUNE: PART TWO',
    tagline: 'IMAX ENHANCED 4K HDR • 45MBPS DIRECT STREAM',
    year: '2024',
    rating: '9.8',
    quality: '4K Ultra HD',
    duration: '2h 46m',
    mediaType: 'image',
    mediaUrl: 'https://image.tmdb.org/t/p/original/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg',
    announcement: "Denis Villeneuve's cinematic masterwork is now streaming in full 4K HDR. Experience Paul Atreides' destiny on any TV, PC, or mobile device with zero buffering.",
    slideOrder: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'slide-stranger-things',
    title: 'STRANGER THINGS',
    tagline: 'COMPLETE 4K BINGE • OFFLINE DOWNLOADS READY',
    year: '2025',
    rating: '9.9',
    quality: '4K BINGE',
    duration: 'All Seasons',
    mediaType: 'image',
    mediaUrl: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg',
    announcement: 'Every season of Stranger Things available in stunning 4K HDR. Save full episodes directly to your iOS or Android app to watch on the go without mobile data lag.',
    slideOrder: 2,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'slide-arcane',
    title: 'ARCANE',
    tagline: 'CRITICALLY ACCLAIMED MASTERPIECE • 9.9/10 RATING',
    year: '2024',
    rating: '9.9',
    quality: '4K HDR',
    duration: 'Season 1 & 2',
    mediaType: 'image',
    mediaUrl: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg',
    announcement: 'Experience the visual triumph of Piltover and Zaun. Stream every high-stakes episode in pristine 4K resolution with synchronized English/multi-language subtitles.',
    slideOrder: 3,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'slide-gladiator',
    title: 'GLADIATOR II',
    tagline: 'EPIC ACTION BLOCKBUSTER • UNTHROTTLED PLAYBACK',
    year: '2024',
    rating: '9.4',
    quality: '4K HDR',
    duration: '2h 28m',
    mediaType: 'image',
    mediaUrl: 'https://image.tmdb.org/t/p/original/euYIwmqkmz95mnXvufEmbL6ovhZ.jpg',
    posterUrl: 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg',
    announcement: "Lucius enters the Colosseum in Ridley Scott's monumental return to ancient Rome. Stream with instant 1-click seeking and zero buffering on Cinode.",
    slideOrder: 4,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_LANDING_ABOUT: LandingAboutRecord = {
  id: 'main',
  header: 'About',
  badge: "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
  subtitle: 'Cinode: Unthrottled 4K Streaming for Everyone',
  contentHtml: `<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p><p>With a dedicated 45Mbps direct-play infrastructure, you bypass aggressive streaming compression to enjoy theater-quality audio, crystal-clear visuals, personalized watch histories, and instant movie requests.</p><p>One single ₦600/month pass gives you unhindered access across Smart TVs, Android, iPhone, iPad, Windows, and Mac with synchronized playback and offline mobile downloads.</p>`,
  imageUrl: '',
  imageAlt: 'Cinode 4K Cinema Engine',
  captionTitle: 'Direct Cloud Storage Architecture',
  captionDesc: '10,000+ Hours of 4K Remastered Cinema & TV Series',
  featurePillsJson: JSON.stringify(["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"]),
  cardsJson: JSON.stringify([
    { id: 'c1', title: 'Zero Buffer Engine', desc: 'Direct-play 45Mbps video streams backed by dedicated high-speed storage. Movies and series launch instantly without waiting.', icon: 'Zap' },
    { id: 'c2', title: 'Any Screen, Everywhere', desc: 'Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device. Seamless playback synchronization.', icon: 'Tv' },
    { id: 'c3', title: 'Offline Downloads', desc: 'Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.', icon: 'Smartphone' }
  ]),
  updatedAt: new Date().toISOString()
};

export const DEFAULT_LANDING_FAQS: LandingFaqRecord[] = [
  {
    id: 'faq-1',
    question: 'What is Cinode Streaming Network?',
    answer: 'Cinode is a high-speed private media streaming portal engineered for smooth, ad-free streaming of curated blockbuster movies, full franchises, and TV series directly on your phone, smart TV, or laptop.',
    faqOrder: 0,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'faq-2',
    question: 'How does the ₦600 subscription work?',
    answer: 'We keep premium streaming ultra-affordable. A single flat subscription fee of ₦600 unlocks 30 full days of unlimited, ad-free streaming in 4K HDR. You can renew instantly using Paystack, Monnify, Squad, or direct bank transfer.',
    faqOrder: 1,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'faq-3',
    question: 'Can I watch offline on my mobile phone?',
    answer: 'Yes! Download our official mobile client apps to save your favorite movies and series directly to your device and watch offline anywhere without using mobile data.',
    faqOrder: 2,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'faq-4',
    question: 'How do I connect the Mobile App?',
    answer: 'When you open the mobile app for the first time, simply enter our Server Address: https://cinode.zerolord.com and sign in with your Cinode portal account credentials.',
    faqOrder: 3,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'faq-5',
    question: 'Can I request movies that are not available?',
    answer: 'Absolutely! Our portal includes a built-in Content Request system. Simply submit the title you want, and our system will fetch and add it to the library.',
    faqOrder: 4,
    isActive: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const localHeroSlides: HeroSlideRecord[] = [...DEFAULT_HERO_SLIDES];
export let localHeroSlideDelaySeconds = 5;
export let localLandingAbout: LandingAboutRecord = { ...DEFAULT_LANDING_ABOUT };
export const localLandingFaqs: LandingFaqRecord[] = [...DEFAULT_LANDING_FAQS];"""

text = text.replace(target_locals, replace_locals)

# 3. Add table creation in initDb
target_init = "    // Create squad_mandates table for Direct Debit recurring billing"
replace_init = """    try { await pool.query("ALTER TABLE system_config ADD COLUMN heroSlideDelaySeconds INT NOT NULL DEFAULT 5"); } catch (e) {}

    // Create landing_hero_slides table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS landing_hero_slides (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        tagline VARCHAR(255) NULL,
        year VARCHAR(50) NULL,
        rating VARCHAR(50) NULL,
        quality VARCHAR(50) NULL,
        duration VARCHAR(100) NULL,
        mediaType VARCHAR(50) NOT NULL DEFAULT 'image',
        mediaUrl TEXT NOT NULL,
        posterUrl TEXT NULL,
        announcement TEXT NULL,
        slideOrder INT NOT NULL DEFAULT 0,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt VARCHAR(255) NOT NULL,
        updatedAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create landing_about table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS landing_about (
        id VARCHAR(255) PRIMARY KEY,
        header VARCHAR(255) NOT NULL,
        badge VARCHAR(255) NULL,
        subtitle VARCHAR(255) NULL,
        contentHtml LONGTEXT NOT NULL,
        imageUrl TEXT NULL,
        imageAlt VARCHAR(255) NULL,
        captionTitle VARCHAR(255) NULL,
        captionDesc VARCHAR(255) NULL,
        featurePillsJson TEXT NULL,
        cardsJson TEXT NULL,
        updatedAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create landing_faqs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS landing_faqs (
        id VARCHAR(255) PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        faqOrder INT NOT NULL DEFAULT 0,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt VARCHAR(255) NOT NULL,
        updatedAt VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Seed landing tables if empty
    try {
      const [slidesCount]: any = await pool.query('SELECT COUNT(*) as cnt FROM landing_hero_slides');
      if (slidesCount && slidesCount[0] && Number(slidesCount[0].cnt) === 0) {
        for (const s of DEFAULT_HERO_SLIDES) {
          await pool.query(`
            INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [s.id, s.title, s.tagline, s.year, s.rating, s.quality, s.duration, s.mediaType, s.mediaUrl, s.posterUrl || '', s.announcement, s.slideOrder, s.isActive, s.createdAt, s.updatedAt]);
        }
      }
    } catch (e) {}

    try {
      const [aboutCount]: any = await pool.query('SELECT COUNT(*) as cnt FROM landing_about');
      if (aboutCount && aboutCount[0] && Number(aboutCount[0].cnt) === 0) {
        await pool.query(`
          INSERT INTO landing_about (id, header, badge, subtitle, contentHtml, imageUrl, imageAlt, captionTitle, captionDesc, featurePillsJson, cardsJson, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          DEFAULT_LANDING_ABOUT.id, DEFAULT_LANDING_ABOUT.header, DEFAULT_LANDING_ABOUT.badge, DEFAULT_LANDING_ABOUT.subtitle,
          DEFAULT_LANDING_ABOUT.contentHtml, DEFAULT_LANDING_ABOUT.imageUrl, DEFAULT_LANDING_ABOUT.imageAlt || '',
          DEFAULT_LANDING_ABOUT.captionTitle || '', DEFAULT_LANDING_ABOUT.captionDesc || '',
          DEFAULT_LANDING_ABOUT.featurePillsJson || '[]', DEFAULT_LANDING_ABOUT.cardsJson || '[]',
          DEFAULT_LANDING_ABOUT.updatedAt
        ]);
      }
    } catch (e) {}

    try {
      const [faqsCount]: any = await pool.query('SELECT COUNT(*) as cnt FROM landing_faqs');
      if (faqsCount && faqsCount[0] && Number(faqsCount[0].cnt) === 0) {
        for (const f of DEFAULT_LANDING_FAQS) {
          await pool.query(`
            INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [f.id, f.question, f.answer, f.faqOrder, f.isActive, f.createdAt, f.updatedAt]);
        }
      }
    } catch (e) {}

    // Create squad_mandates table for Direct Debit recurring billing"""

text = text.replace(target_init, replace_init)

# 4. Add methods to db object at the end of db.ts
target_end = """  async updateSftpStatus(updates: { lastSync?: string; lastFile?: string; lastTxRef?: string; lastError?: string; lastStatus?: string }): Promise<void> {
    if (!mysqlAvailable) {
      if (localSystemConfig) {
        if (updates.lastSync !== undefined) localSystemConfig.squadSftpLastSync = updates.lastSync;
        if (updates.lastFile !== undefined) localSystemConfig.squadSftpLastFile = updates.lastFile;
        if (updates.lastTxRef !== undefined) localSystemConfig.squadSftpLastTxRef = updates.lastTxRef;
        if (updates.lastError !== undefined) localSystemConfig.squadSftpLastError = updates.lastError;
        if (updates.lastStatus !== undefined) localSystemConfig.squadSftpLastStatus = updates.lastStatus;
      }
      return;
    }
    try {
      const fields: string[] = [];
      const values: any[] = [];
      if (updates.lastSync !== undefined) { fields.push('squadSftpLastSync = ?'); values.push(updates.lastSync); }
      if (updates.lastFile !== undefined) { fields.push('squadSftpLastFile = ?'); values.push(updates.lastFile); }
      if (updates.lastTxRef !== undefined) { fields.push('squadSftpLastTxRef = ?'); values.push(updates.lastTxRef); }
      if (updates.lastError !== undefined) { fields.push('squadSftpLastError = ?'); values.push(updates.lastError); }
      if (updates.lastStatus !== undefined) { fields.push('squadSftpLastStatus = ?'); values.push(updates.lastStatus); }

      if (fields.length > 0) {
        await pool.query(`UPDATE system_config SET ${fields.join(', ')} WHERE id = 'main'`, values);
      }
    } catch (e) {
      console.error('Error updating squad SFTP status:', e);
    }
  }
};"""

replace_end = """  async updateSftpStatus(updates: { lastSync?: string; lastFile?: string; lastTxRef?: string; lastError?: string; lastStatus?: string }): Promise<void> {
    if (!mysqlAvailable) {
      if (localSystemConfig) {
        if (updates.lastSync !== undefined) localSystemConfig.squadSftpLastSync = updates.lastSync;
        if (updates.lastFile !== undefined) localSystemConfig.squadSftpLastFile = updates.lastFile;
        if (updates.lastTxRef !== undefined) localSystemConfig.squadSftpLastTxRef = updates.lastTxRef;
        if (updates.lastError !== undefined) localSystemConfig.squadSftpLastError = updates.lastError;
        if (updates.lastStatus !== undefined) localSystemConfig.squadSftpLastStatus = updates.lastStatus;
      }
      return;
    }
    try {
      const fields: string[] = [];
      const values: any[] = [];
      if (updates.lastSync !== undefined) { fields.push('squadSftpLastSync = ?'); values.push(updates.lastSync); }
      if (updates.lastFile !== undefined) { fields.push('squadSftpLastFile = ?'); values.push(updates.lastFile); }
      if (updates.lastTxRef !== undefined) { fields.push('squadSftpLastTxRef = ?'); values.push(updates.lastTxRef); }
      if (updates.lastError !== undefined) { fields.push('squadSftpLastError = ?'); values.push(updates.lastError); }
      if (updates.lastStatus !== undefined) { fields.push('squadSftpLastStatus = ?'); values.push(updates.lastStatus); }

      if (fields.length > 0) {
        await pool.query(`UPDATE system_config SET ${fields.join(', ')} WHERE id = 'main'`, values);
      }
    } catch (e) {
      console.error('Error updating squad SFTP status:', e);
    }
  },

  async getLandingContent(): Promise<{
    heroSlides: any[];
    heroSlideDelaySeconds: number;
    about: any;
    faqs: any[];
  }> {
    let heroSlides: any[] = [];
    let heroSlideDelaySeconds = 5;
    let about: any = null;
    let faqs: any[] = [];

    if (!mysqlAvailable) {
      heroSlides = localHeroSlides.map(s => ({ ...s, isActive: Boolean(s.isActive) }));
      heroSlideDelaySeconds = localHeroSlideDelaySeconds || (localSystemConfig?.heroSlideDelaySeconds ?? 5);
      about = {
        ...localLandingAbout,
        featurePills: localLandingAbout.featurePillsJson ? JSON.parse(localLandingAbout.featurePillsJson) : [],
        cards: localLandingAbout.cardsJson ? JSON.parse(localLandingAbout.cardsJson) : []
      };
      faqs = localLandingFaqs.map(f => ({ ...f, isActive: Boolean(f.isActive) }));
      return { heroSlides, heroSlideDelaySeconds, about, faqs };
    }

    try {
      // Get delay
      const [cfgRows]: any = await pool.query("SELECT heroSlideDelaySeconds FROM system_config WHERE id = 'main'");
      if (cfgRows && cfgRows[0] && cfgRows[0].heroSlideDelaySeconds) {
        heroSlideDelaySeconds = Number(cfgRows[0].heroSlideDelaySeconds);
      }

      // Get slides
      const [slideRows]: any = await pool.query('SELECT * FROM landing_hero_slides ORDER BY slideOrder ASC, createdAt ASC');
      if (slideRows && slideRows.length > 0) {
        heroSlides = slideRows.map((r: any) => ({
          id: r.id,
          title: r.title,
          tagline: r.tagline || '',
          year: r.year || '',
          rating: r.rating || '',
          quality: r.quality || '',
          duration: r.duration || '',
          mediaType: r.mediaType || 'image',
          mediaUrl: r.mediaUrl || '',
          posterUrl: r.posterUrl || '',
          announcement: r.announcement || '',
          slideOrder: Number(r.slideOrder || 0),
          isActive: Boolean(r.isActive)
        }));
      } else {
        heroSlides = DEFAULT_HERO_SLIDES.map(s => ({ ...s, isActive: Boolean(s.isActive) }));
      }

      // Get about
      const [aboutRows]: any = await pool.query("SELECT * FROM landing_about WHERE id = 'main'");
      if (aboutRows && aboutRows.length > 0) {
        const ab = aboutRows[0];
        let pills: string[] = [];
        let cards: any[] = [];
        try { pills = ab.featurePillsJson ? JSON.parse(ab.featurePillsJson) : []; } catch (e) {}
        try { cards = ab.cardsJson ? JSON.parse(ab.cardsJson) : []; } catch (e) {}
        about = {
          header: ab.header || 'About',
          badge: ab.badge || '',
          subtitle: ab.subtitle || '',
          contentHtml: ab.contentHtml || '',
          imageUrl: ab.imageUrl || '',
          imageAlt: ab.imageAlt || '',
          captionTitle: ab.captionTitle || '',
          captionDesc: ab.captionDesc || '',
          featurePills: pills,
          cards: cards
        };
      } else {
        about = {
          ...DEFAULT_LANDING_ABOUT,
          featurePills: JSON.parse(DEFAULT_LANDING_ABOUT.featurePillsJson || '[]'),
          cards: JSON.parse(DEFAULT_LANDING_ABOUT.cardsJson || '[]')
        };
      }

      // Get faqs
      const [faqRows]: any = await pool.query('SELECT * FROM landing_faqs ORDER BY faqOrder ASC, createdAt ASC');
      if (faqRows && faqRows.length > 0) {
        faqs = faqRows.map((r: any) => ({
          id: r.id,
          question: r.question,
          answer: r.answer,
          faqOrder: Number(r.faqOrder || 0),
          isActive: Boolean(r.isActive)
        }));
      } else {
        faqs = DEFAULT_LANDING_FAQS.map(f => ({ ...f, isActive: Boolean(f.isActive) }));
      }

    } catch (err) {
      console.error('Error in getLandingContent:', err);
      heroSlides = DEFAULT_HERO_SLIDES.map(s => ({ ...s, isActive: Boolean(s.isActive) }));
      about = {
        ...DEFAULT_LANDING_ABOUT,
        featurePills: JSON.parse(DEFAULT_LANDING_ABOUT.featurePillsJson || '[]'),
        cards: JSON.parse(DEFAULT_LANDING_ABOUT.cardsJson || '[]')
      };
      faqs = DEFAULT_LANDING_FAQS.map(f => ({ ...f, isActive: Boolean(f.isActive) }));
    }

    return { heroSlides, heroSlideDelaySeconds, about, faqs };
  },

  async saveHeroSlides(slides: any[], delaySeconds?: number): Promise<void> {
    if (delaySeconds !== undefined) {
      localHeroSlideDelaySeconds = delaySeconds;
      if (localSystemConfig) localSystemConfig.heroSlideDelaySeconds = delaySeconds;
    }

    if (!mysqlAvailable) {
      localHeroSlides.length = 0;
      slides.forEach((s, idx) => {
        localHeroSlides.push({
          id: s.id || `slide-${Date.now()}-${idx}`,
          title: s.title || '',
          tagline: s.tagline || '',
          year: s.year || '',
          rating: s.rating || '',
          quality: s.quality || '',
          duration: s.duration || '',
          mediaType: s.mediaType || 'image',
          mediaUrl: s.mediaUrl || '',
          posterUrl: s.posterUrl || '',
          announcement: s.announcement || '',
          slideOrder: s.slideOrder !== undefined ? s.slideOrder : idx,
          isActive: s.isActive !== undefined ? (s.isActive ? 1 : 0) : 1,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      return;
    }

    try {
      if (delaySeconds !== undefined) {
        await pool.query("UPDATE system_config SET heroSlideDelaySeconds = ? WHERE id = 'main'", [delaySeconds]);
      }

      await pool.query('DELETE FROM landing_hero_slides');
      for (let idx = 0; idx < slides.length; idx++) {
        const s = slides[idx];
        const id = s.id || `slide-${Date.now()}-${idx}`;
        const title = s.title || 'Untitled Movie';
        const tagline = s.tagline || '';
        const year = s.year || '';
        const rating = s.rating || '9.0';
        const quality = s.quality || '4K HDR';
        const duration = s.duration || '';
        const mediaType = s.mediaType || 'image';
        const mediaUrl = s.mediaUrl || '';
        const posterUrl = s.posterUrl || '';
        const announcement = s.announcement || '';
        const slideOrder = s.slideOrder !== undefined ? s.slideOrder : idx;
        const isActive = s.isActive !== undefined ? (s.isActive ? 1 : 0) : 1;
        const now = new Date().toISOString();

        await pool.query(`
          INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, now, now]);
      }
    } catch (e) {
      console.error('Error saving hero slides to MySQL:', e);
      throw e;
    }
  },

  async saveAboutConfig(about: any): Promise<void> {
    const pillsJson = JSON.stringify(about.featurePills || []);
    const cardsJson = JSON.stringify(about.cards || []);
    const now = new Date().toISOString();

    if (!mysqlAvailable) {
      localLandingAbout = {
        id: 'main',
        header: about.header || 'About',
        badge: about.badge || '',
        subtitle: about.subtitle || '',
        contentHtml: about.contentHtml || '',
        imageUrl: about.imageUrl || '',
        imageAlt: about.imageAlt || '',
        captionTitle: about.captionTitle || '',
        captionDesc: about.captionDesc || '',
        featurePillsJson: pillsJson,
        cardsJson: cardsJson,
        updatedAt: now
      };
      return;
    }

    try {
      await pool.query(`
        INSERT INTO landing_about (id, header, badge, subtitle, contentHtml, imageUrl, imageAlt, captionTitle, captionDesc, featurePillsJson, cardsJson, updatedAt)
        VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          header = VALUES(header),
          badge = VALUES(badge),
          subtitle = VALUES(subtitle),
          contentHtml = VALUES(contentHtml),
          imageUrl = VALUES(imageUrl),
          imageAlt = VALUES(imageAlt),
          captionTitle = VALUES(captionTitle),
          captionDesc = VALUES(captionDesc),
          featurePillsJson = VALUES(featurePillsJson),
          cardsJson = VALUES(cardsJson),
          updatedAt = VALUES(updatedAt)
      `, [
        about.header || 'About',
        about.badge || '',
        about.subtitle || '',
        about.contentHtml || '',
        about.imageUrl || '',
        about.imageAlt || '',
        about.captionTitle || '',
        about.captionDesc || '',
        pillsJson,
        cardsJson,
        now
      ]);
    } catch (e) {
      console.error('Error saving about config to MySQL:', e);
      throw e;
    }
  },

  async saveFaqs(faqs: any[]): Promise<void> {
    if (!mysqlAvailable) {
      localLandingFaqs.length = 0;
      faqs.forEach((f, idx) => {
        localLandingFaqs.push({
          id: f.id || `faq-${Date.now()}-${idx}`,
          question: f.question || f.q || '',
          answer: f.answer || f.a || '',
          faqOrder: f.faqOrder !== undefined ? f.faqOrder : idx,
          isActive: f.isActive !== undefined ? (f.isActive ? 1 : 0) : 1,
          createdAt: f.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      return;
    }

    try {
      await pool.query('DELETE FROM landing_faqs');
      for (let idx = 0; idx < faqs.length; idx++) {
        const f = faqs[idx];
        const id = f.id || `faq-${Date.now()}-${idx}`;
        const question = f.question || f.q || '';
        const answer = f.answer || f.a || '';
        const faqOrder = f.faqOrder !== undefined ? f.faqOrder : idx;
        const isActive = f.isActive !== undefined ? (f.isActive ? 1 : 0) : 1;
        const now = new Date().toISOString();

        await pool.query(`
          INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [id, question, answer, faqOrder, isActive, now, now]);
      }
    } catch (e) {
      console.error('Error saving FAQs to MySQL:', e);
      throw e;
    }
  }
};"""

text = text.replace(target_end, replace_end)

with open('server/db.ts', 'w') as f:
    f.write(text)

print("Updated server/db.ts successfully!")
