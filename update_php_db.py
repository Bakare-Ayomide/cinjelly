with open('php-backend/db.php', 'r') as f:
    text = f.read()

target_init = "// Create squad_mandates table"

replace_init = """        try {
            $pdo->exec("ALTER TABLE system_config ADD COLUMN heroSlideDelaySeconds INT NOT NULL DEFAULT 5");
        } catch (Exception $e) {}

        // Create landing_hero_slides table
        $pdo->exec("
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
        ");

        // Create landing_about table
        $pdo->exec("
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
        ");

        // Create landing_faqs table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS landing_faqs (
                id VARCHAR(255) PRIMARY KEY,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                faqOrder INT NOT NULL DEFAULT 0,
                isActive TINYINT(1) NOT NULL DEFAULT 1,
                createdAt VARCHAR(255) NOT NULL,
                updatedAt VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ");

        // Seed initial slides if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_hero_slides");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $seedSlides = [
                    ['slide-evil-dead', 'EVIL DEAD', 'CINODE 4K STREAMING NETWORK • ₦600 UNLIMITED PASS', '1981 - 2023', '9.9', '4K Remaster', 'Franchise Boxset', 'image', '', '', "Bruce Campbell and Sam Raimi's legendary Evil Dead universe is fully remastered in 4K HDR. Stream unrated cuts and behind-the-scenes specials with zero buffer on Cinode.", 0, 1, $now, $now],
                    ['slide-dune-2', 'DUNE: PART TWO', 'IMAX ENHANCED 4K HDR • 45MBPS DIRECT STREAM', '2024', '9.8', '4K Ultra HD', '2h 46m', 'image', 'https://image.tmdb.org/t/p/original/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', 'https://image.tmdb.org/t/p/w500/y4ml848KTz0zccQxfWlE8CMMC13.jpg', "Denis Villeneuve's cinematic masterwork is now streaming in full 4K HDR. Experience Paul Atreides' destiny on any TV, PC, or mobile device with zero buffering.", 1, 1, $now, $now],
                    ['slide-stranger-things', 'STRANGER THINGS', 'COMPLETE 4K BINGE • OFFLINE DOWNLOADS READY', '2025', '9.9', '4K BINGE', 'All Seasons', 'image', 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg', 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg', 'Every season of Stranger Things available in stunning 4K HDR. Save full episodes directly to your iOS or Android app to watch on the go without mobile data lag.', 2, 1, $now, $now],
                    ['slide-arcane', 'ARCANE', 'CRITICALLY ACCLAIMED MASTERPIECE • 9.9/10 RATING', '2024', '9.9', '4K HDR', 'Season 1 & 2', 'image', 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg', 'https://image.tmdb.org/t/p/w500/abf8tHznhSvl9BAElD2cQeRr7do.jpg', 'Experience the visual triumph of Piltover and Zaun. Stream every high-stakes episode in pristine 4K resolution with synchronized English/multi-language subtitles.', 3, 1, $now, $now],
                    ['slide-gladiator', 'GLADIATOR II', 'EPIC ACTION BLOCKBUSTER • UNTHROTTLED PLAYBACK', '2024', '9.4', '4K HDR', '2h 28m', 'image', 'https://image.tmdb.org/t/p/original/euYIwmqkmz95mnXvufEmbL6ovhZ.jpg', 'https://image.tmdb.org/t/p/w500/gUPnmDkNRSLFynbpNw9VJrYBEgT.jpg', "Lucius enters the Colosseum in Ridley Scott's monumental return to ancient Rome. Stream with instant 1-click seeking and zero buffering on Cinode.", 4, 1, $now, $now]
                ];
                $ins = $pdo->prepare("INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                foreach ($seedSlides as $s) {
                    $ins->execute($s);
                }
            }
        } catch (Exception $e) {}

        // Seed initial about if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_about");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $ins = $pdo->prepare("INSERT INTO landing_about (id, header, badge, subtitle, contentHtml, imageUrl, imageAlt, captionTitle, captionDesc, featurePillsJson, cardsJson, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $ins->execute([
                    'main',
                    'About',
                    "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
                    'Cinode: Unthrottled 4K Streaming for Everyone',
                    '<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p><p>With a dedicated 45Mbps direct-play infrastructure, you bypass aggressive streaming compression to enjoy theater-quality audio, crystal-clear visuals, personalized watch histories, and instant movie requests.</p><p>One single ₦600/month pass gives you unhindered access across Smart TVs, Android, iPhone, iPad, Windows, and Mac with synchronized playback and offline mobile downloads.</p>',
                    '',
                    'Cinode 4K Cinema Engine',
                    'Direct Cloud Storage Architecture',
                    '10,000+ Hours of 4K Remastered Cinema & TV Series',
                    json_encode(["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"]),
                    json_encode([
                        ['id' => 'c1', 'title' => 'Zero Buffer Engine', 'desc' => 'Direct-play 45Mbps video streams backed by dedicated high-speed storage. Movies and series launch instantly without waiting.', 'icon' => 'Zap'],
                        ['id' => 'c2', 'title' => 'Any Screen, Everywhere', 'desc' => 'Stream on your Smart TV, Mobile Phone, Tablet, and PC without paying extra per device. Seamless playback synchronization.', 'icon' => 'Tv'],
                        ['id' => 'c3', 'title' => 'Offline Downloads', 'desc' => 'Save HD blockbusters directly onto your iOS or Android app to watch on trips without spending mobile data.', 'icon' => 'Smartphone']
                    ]),
                    $now
                ]);
            }
        } catch (Exception $e) {}

        // Seed initial FAQs if empty
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM landing_faqs");
            $r = $stmt->fetch();
            if ($r && intval($r['cnt']) === 0) {
                $now = date(DATE_ISO8601);
                $seedFaqs = [
                    ['faq-1', 'What is Cinode Streaming Network?', 'Cinode is a high-speed private media streaming portal engineered for smooth, ad-free streaming of curated blockbuster movies, full franchises, and TV series directly on your phone, smart TV, or laptop.', 0, 1, $now, $now],
                    ['faq-2', 'How does the ₦600 subscription work?', 'We keep premium streaming ultra-affordable. A single flat subscription fee of ₦600 unlocks 30 full days of unlimited, ad-free streaming in 4K HDR. You can renew instantly using Paystack, Monnify, Squad, or direct bank transfer.', 1, 1, $now, $now],
                    ['faq-3', 'Can I watch offline on my mobile phone?', 'Yes! Download our official mobile client apps to save your favorite movies and series directly to your device and watch offline anywhere without using mobile data.', 2, 1, $now, $now],
                    ['faq-4', 'How do I connect the Mobile App?', 'When you open the mobile app for the first time, simply enter our Server Address: https://cinode.zerolord.com and sign in with your Cinode portal account credentials.', 3, 1, $now, $now],
                    ['faq-5', 'Can I request movies that are not available?', 'Absolutely! Our portal includes a built-in Content Request system. Simply submit the title you want, and our system will fetch and add it to the library.', 4, 1, $now, $now]
                ];
                $ins = $pdo->prepare("INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)");
                foreach ($seedFaqs as $f) {
                    $ins->execute($f);
                }
            }
        } catch (Exception $e) {}

        // Create squad_mandates table"""

text = text.replace(target_init, replace_init)

# Append landing methods
target_end = """    public static function getActiveSquadMandatesDueForRenewal() {
        $pdo = self::getConnection();
        $stmt = $pdo->query("SELECT * FROM squad_mandates WHERE status = 'active' ORDER BY createdAt DESC");
        return $stmt->fetchAll() ?: [];
    }
}"""

replace_end = """    public static function getActiveSquadMandatesDueForRenewal() {
        $pdo = self::getConnection();
        $stmt = $pdo->query("SELECT * FROM squad_mandates WHERE status = 'active' ORDER BY createdAt DESC");
        return $stmt->fetchAll() ?: [];
    }

    public static function getLandingContent() {
        $pdo = self::getConnection();
        $heroSlideDelaySeconds = 5;
        try {
            $stmt = $pdo->query("SELECT heroSlideDelaySeconds FROM system_config WHERE id = 'main'");
            $row = $stmt->fetch();
            if ($row && !empty($row['heroSlideDelaySeconds'])) {
                $heroSlideDelaySeconds = intval($row['heroSlideDelaySeconds']);
            }
        } catch (Exception $e) {}

        $heroSlides = [];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_hero_slides ORDER BY slideOrder ASC, createdAt ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as $r) {
                $heroSlides[] = [
                    'id' => $r['id'],
                    'title' => $r['title'],
                    'tagline' => $r['tagline'] ?? '',
                    'year' => $r['year'] ?? '',
                    'rating' => $r['rating'] ?? '',
                    'quality' => $r['quality'] ?? '',
                    'duration' => $r['duration'] ?? '',
                    'mediaType' => $r['mediaType'] ?? 'image',
                    'mediaUrl' => $r['mediaUrl'] ?? '',
                    'posterUrl' => $r['posterUrl'] ?? '',
                    'announcement' => $r['announcement'] ?? '',
                    'slideOrder' => intval($r['slideOrder'] ?? 0),
                    'isActive' => boolval($r['isActive'] ?? 1)
                ];
            }
        } catch (Exception $e) {}

        $about = [
            'header' => 'About',
            'badge' => "⚡ NIGERIA'S HIGH-SPEED CINEMA NETWORK",
            'subtitle' => 'Cinode: Unthrottled 4K Streaming for Everyone',
            'contentHtml' => '<p>Cinode is a purpose-built, high-performance private streaming network engineered to deliver true 4K HDR and Full HD cinema directly to your screens without buffering or ISP throttling.</p>',
            'imageUrl' => '',
            'imageAlt' => 'Cinode 4K Cinema Engine',
            'captionTitle' => 'Direct Cloud Storage Architecture',
            'captionDesc' => '10,000+ Hours of 4K Remastered Cinema & TV Series',
            'featurePills' => ["⚡ 45Mbps Direct Play Engine", "🛡️ 100% Ad-Free Private Profiles", "🍿 ₦600 All-Inclusive Pass"],
            'cards' => []
        ];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_about WHERE id = 'main'");
            $ab = $stmt->fetch();
            if ($ab) {
                $pills = !empty($ab['featurePillsJson']) ? json_decode($ab['featurePillsJson'], true) : [];
                $cards = !empty($ab['cardsJson']) ? json_decode($ab['cardsJson'], true) : [];
                $about = [
                    'header' => $ab['header'] ?? 'About',
                    'badge' => $ab['badge'] ?? '',
                    'subtitle' => $ab['subtitle'] ?? '',
                    'contentHtml' => $ab['contentHtml'] ?? '',
                    'imageUrl' => $ab['imageUrl'] ?? '',
                    'imageAlt' => $ab['imageAlt'] ?? '',
                    'captionTitle' => $ab['captionTitle'] ?? '',
                    'captionDesc' => $ab['captionDesc'] ?? '',
                    'featurePills' => is_array($pills) ? $pills : [],
                    'cards' => is_array($cards) ? $cards : []
                ];
            }
        } catch (Exception $e) {}

        $faqs = [];
        try {
            $stmt = $pdo->query("SELECT * FROM landing_faqs ORDER BY faqOrder ASC, createdAt ASC");
            $rows = $stmt->fetchAll();
            foreach ($rows as $r) {
                $faqs[] = [
                    'id' => $r['id'],
                    'question' => $r['question'],
                    'answer' => $r['answer'],
                    'faqOrder' => intval($r['faqOrder'] ?? 0),
                    'isActive' => boolval($r['isActive'] ?? 1)
                ];
            }
        } catch (Exception $e) {}

        return [
            'heroSlides' => $heroSlides,
            'heroSlideDelaySeconds' => $heroSlideDelaySeconds,
            'about' => $about,
            'faqs' => $faqs
        ];
    }

    public static function saveHeroSlides($slides, $delaySeconds = null) {
        $pdo = self::getConnection();
        if ($delaySeconds !== null) {
            $stmt = $pdo->prepare("UPDATE system_config SET heroSlideDelaySeconds = ? WHERE id = 'main'");
            $stmt->execute([intval($delaySeconds)]);
        }

        $pdo->exec("DELETE FROM landing_hero_slides");
        $ins = $pdo->prepare("
            INSERT INTO landing_hero_slides (id, title, tagline, year, rating, quality, duration, mediaType, mediaUrl, posterUrl, announcement, slideOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $now = date(DATE_ISO8601);
        foreach ($slides as $idx => $s) {
            $id = !empty($s['id']) ? $s['id'] : 'slide-' . time() . '-' . $idx;
            $title = $s['title'] ?? 'Untitled Movie';
            $tagline = $s['tagline'] ?? '';
            $year = $s['year'] ?? '';
            $rating = $s['rating'] ?? '9.0';
            $quality = $s['quality'] ?? '4K HDR';
            $duration = $s['duration'] ?? '';
            $mediaType = $s['mediaType'] ?? 'image';
            $mediaUrl = $s['mediaUrl'] ?? '';
            $posterUrl = $s['posterUrl'] ?? '';
            $announcement = $s['announcement'] ?? '';
            $slideOrder = isset($s['slideOrder']) ? intval($s['slideOrder']) : $idx;
            $isActive = isset($s['isActive']) ? ($s['isActive'] ? 1 : 0) : 1;

            $ins->execute([$id, $title, $tagline, $year, $rating, $quality, $duration, $mediaType, $mediaUrl, $posterUrl, $announcement, $slideOrder, $isActive, $now, $now]);
        }
    }

    public static function saveAboutConfig($about) {
        $pdo = self::getConnection();
        $pillsJson = json_encode($about['featurePills'] ?? []);
        $cardsJson = json_encode($about['cards'] ?? []);
        $now = date(DATE_ISO8601);

        $stmt = $pdo->prepare("
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
        ");
        $stmt->execute([
            $about['header'] ?? 'About',
            $about['badge'] ?? '',
            $about['subtitle'] ?? '',
            $about['contentHtml'] ?? '',
            $about['imageUrl'] ?? '',
            $about['imageAlt'] ?? '',
            $about['captionTitle'] ?? '',
            $about['captionDesc'] ?? '',
            $pillsJson,
            $cardsJson,
            $now
        ]);
    }

    public static function saveFaqs($faqs) {
        $pdo = self::getConnection();
        $pdo->exec("DELETE FROM landing_faqs");
        $ins = $pdo->prepare("
            INSERT INTO landing_faqs (id, question, answer, faqOrder, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $now = date(DATE_ISO8601);
        foreach ($faqs as $idx => $f) {
            $id = !empty($f['id']) ? $f['id'] : 'faq-' . time() . '-' . $idx;
            $question = $f['question'] ?? ($f['q'] ?? '');
            $answer = $f['answer'] ?? ($f['a'] ?? '');
            $faqOrder = isset($f['faqOrder']) ? intval($f['faqOrder']) : $idx;
            $isActive = isset($f['isActive']) ? ($f['isActive'] ? 1 : 0) : 1;

            $ins->execute([$id, $question, $answer, $faqOrder, $isActive, $now, $now]);
        }
    }
}"""

text = text.replace(target_end, replace_end)

with open('php-backend/db.php', 'w') as f:
    f.write(text)

print("Updated php-backend/db.php successfully!")
