with open('server.ts', 'r') as f:
    text = f.read()

target = "app.get('/api/status', async (req, res) => {"

landing_routes = """// =========================================================================
// LANDING PAGE CMS ENDPOINTS (Hero Slides, About Config, FAQs)
// =========================================================================

// Public fetch for landing page content
app.get('/api/landing/content', async (req: any, res) => {
  try {
    const content = await db.getLandingContent();
    res.json(content);
  } catch (err: any) {
    console.error('Error fetching landing content:', err);
    res.status(500).json({ error: 'Failed to fetch landing page content' });
  }
});

// Admin save all landing content
app.post('/api/admin/landing/content', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }
  try {
    const { heroSlides, heroSlideDelaySeconds, about, faqs } = req.body;
    if (heroSlides && Array.isArray(heroSlides)) {
      await db.saveHeroSlides(heroSlides, heroSlideDelaySeconds);
    }
    if (about && typeof about === 'object') {
      await db.saveAboutConfig(about);
    }
    if (faqs && Array.isArray(faqs)) {
      await db.saveFaqs(faqs);
    }
    const updated = await db.getLandingContent();
    res.json({ success: true, message: 'Landing page content saved successfully!', content: updated });
  } catch (err: any) {
    console.error('Error saving landing content:', err);
    res.status(500).json({ error: err.message || 'Failed to save landing page content' });
  }
});

// Admin save hero slides
app.post('/api/admin/landing/hero-slides', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }
  try {
    const { slides, delaySeconds } = req.body;
    if (!Array.isArray(slides)) {
      return res.status(400).json({ error: 'Invalid slides array' });
    }
    await db.saveHeroSlides(slides, delaySeconds);
    const updated = await db.getLandingContent();
    res.json({ success: true, message: 'Hero slides updated successfully!', heroSlides: updated.heroSlides, heroSlideDelaySeconds: updated.heroSlideDelaySeconds });
  } catch (err: any) {
    console.error('Error saving hero slides:', err);
    res.status(500).json({ error: err.message || 'Failed to save hero slides' });
  }
});

// Admin save about section
app.post('/api/admin/landing/about', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }
  try {
    const about = req.body;
    if (!about || typeof about !== 'object') {
      return res.status(400).json({ error: 'Invalid about configuration payload' });
    }
    await db.saveAboutConfig(about);
    const updated = await db.getLandingContent();
    res.json({ success: true, message: 'About section updated successfully!', about: updated.about });
  } catch (err: any) {
    console.error('Error saving about section:', err);
    res.status(500).json({ error: err.message || 'Failed to save about section' });
  }
});

// Admin save FAQs
app.post('/api/admin/landing/faqs', async (req: any, res) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin session required.' });
  }
  try {
    const { faqs } = req.body;
    if (!Array.isArray(faqs)) {
      return res.status(400).json({ error: 'Invalid faqs array' });
    }
    await db.saveFaqs(faqs);
    const updated = await db.getLandingContent();
    res.json({ success: true, message: 'FAQs updated successfully!', faqs: updated.faqs });
  } catch (err: any) {
    console.error('Error saving FAQs:', err);
    res.status(500).json({ error: err.message || 'Failed to save FAQs' });
  }
});

app.get('/api/status', async (req, res) => {"""

text = text.replace(target, landing_routes)

with open('server.ts', 'w') as f:
    f.write(text)

print("Landing CMS routes added to server.ts!")
