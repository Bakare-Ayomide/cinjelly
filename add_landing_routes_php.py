with open('php-backend/index.php', 'r') as f:
    text = f.read()

target = "if ($method === 'GET' && $path === '/api/status') {"

landing_routes = """// =========================================================================
// LANDING PAGE CMS ENDPOINTS (Hero Slides, About Config, FAQs)
// =========================================================================

// Public fetch for landing page content
if ($method === 'GET' && $path === '/api/landing/content') {
    try {
        $content = DB::getLandingContent();
        echo json_encode($content);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch landing page content: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save all landing content
if ($method === 'POST' && $path === '/api/admin/landing/content') {
    $user = getCurrentUser();
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    try {
        if (isset($input['heroSlides']) && is_array($input['heroSlides'])) {
            $delay = isset($input['heroSlideDelaySeconds']) ? intval($input['heroSlideDelaySeconds']) : null;
            DB::saveHeroSlides($input['heroSlides'], $delay);
        }
        if (isset($input['about']) && is_array($input['about'])) {
            DB::saveAboutConfig($input['about']);
        }
        if (isset($input['faqs']) && is_array($input['faqs'])) {
            DB::saveFaqs($input['faqs']);
        }
        $updated = DB::getLandingContent();
        echo json_encode(['success' => true, 'message' => 'Landing page content saved successfully!', 'content' => $updated]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save landing content: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save hero slides
if ($method === 'POST' && $path === '/api/admin/landing/hero-slides') {
    $user = getCurrentUser();
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!isset($input['slides']) || !is_array($input['slides'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid slides array']);
        exit;
    }
    try {
        $delay = isset($input['delaySeconds']) ? intval($input['delaySeconds']) : null;
        DB::saveHeroSlides($input['slides'], $delay);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'Hero slides updated successfully!',
            'heroSlides' => $updated['heroSlides'],
            'heroSlideDelaySeconds' => $updated['heroSlideDelaySeconds']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save hero slides: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save about section
if ($method === 'POST' && $path === '/api/admin/landing/about') {
    $user = getCurrentUser();
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid about payload']);
        exit;
    }
    try {
        DB::saveAboutConfig($input);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'About section updated successfully!',
            'about' => $updated['about']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save about section: ' . $e->getMessage()]);
        exit;
    }
}

// Admin save FAQs
if ($method === 'POST' && $path === '/api/admin/landing/faqs') {
    $user = getCurrentUser();
    if (!$user || $user['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized. Admin session required.']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!isset($input['faqs']) || !is_array($input['faqs'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid faqs array']);
        exit;
    }
    try {
        DB::saveFaqs($input['faqs']);
        $updated = DB::getLandingContent();
        echo json_encode([
            'success' => true,
            'message' => 'FAQs updated successfully!',
            'faqs' => $updated['faqs']
        ]);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save FAQs: ' . $e->getMessage()]);
        exit;
    }
}

if ($method === 'GET' && $path === '/api/status') {"""

text = text.replace(target, landing_routes)

with open('php-backend/index.php', 'w') as f:
    f.write(text)

print("PHP routes updated successfully!")
