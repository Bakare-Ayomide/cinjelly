# cPanel PHP Backend Deployment Guide

This guide details how to host both the **React frontend** and the new **PHP backend** on cPanel, without disrupting your development server or AI Studio preview environment.

The PHP backend is located in `/php-backend`. It fully replicates the Node.js/Express backend APIs, database models, PBKDF2 SHA-512 password hashing, cookie management, subscription checks, and even the Jellyfin streaming proxy.

---

## 📂 Backend File Overview
Your cPanel PHP backend consists of:
*   `db.php`: Database connection (PDO) and SQL schemas. Replicates PBKDF2 hashing so existing passwords remain compatible.
*   `jellyfin.php`: Client communicating with Jellyfin Server using PHP's `cURL` extension.
*   `index.php`: Main Router. Includes the integrated `/jellyfin` reverse-proxy and routes all `/api/*` endpoints.
*   `expiry-cron.php`: Security-locked script designed to be run as a daily cPanel Cron Job to expire users.
*   `.htaccess`: Configures Apache web server on cPanel to route all clean request URLs to `index.php`.

---

## 🛠️ Step 1: Configure Your MySQL Database in cPanel
1.  Log into your **cPanel** and open **MySQL Database Wizard**.
2.  Create a database, e.g., `yourusername_portal`.
3.  Create a MySQL user with a secure password, e.g., `yourusername_admin`, and grant it **All Privileges** to the database.
4.  Open `/php-backend/db.php` and configure your credentials:
    ```php
    define('DB_HOST', 'localhost'); // usually 'localhost' in cPanel
    define('DB_PORT', '3306');
    define('DB_USER', 'yourusername_admin');
    define('DB_PASS', 'your_secure_mysql_password');
    define('DB_NAME', 'yourusername_portal');
    ```
    *Note: The PHP code automatically initializes all MySQL tables (`users`, `system_config`, `sessions`) on the first API request. You do NOT need to write or run SQL import files!*

---

## 🏗️ Step 2: Build the Frontend
Since cPanel is an Apache static-file host, your React client must be compiled into optimized static HTML, CSS, and JS files.

1.  Run the production build:
    ```bash
    npm run build
    ```
2.  This creates a `/dist` directory in your workspace root containing files like `index.html`, `assets/`, etc.

---

## 🚀 Step 3: Upload the Files to cPanel
Using cPanel's **File Manager** or an FTP Client (like FileZilla), follow these placement instructions:

### Destination: `public_html/` (or your subdomain root)
1.  **Upload the contents of `/dist`** directly into `public_html/`.
    *   Your `public_html/` should now have `index.html` and an `assets/` folder.
2.  **Upload the entire `/php-backend` folder** directly into `public_html/`.
    *   You will now have a path `public_html/php-backend/` containing `index.php`, `db.php`, `jellyfin.php`, `expiry-cron.php`, and `.htaccess`.

---

## 🔗 Step 4: Bridge Frontend and Backend
By default, the React frontend is configured to call `/api/...` and `/jellyfin/...`. 
To route these calls to your PHP folder, create or modify the main `.htaccess` file inside `public_html/` (the root directory where your static `index.html` is located) so that calls to `/api` and `/jellyfin` are forwarded to the PHP backend folder.

Create a `.htaccess` file in `public_html/` with the following content:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Route /api and /jellyfin requests directly to the PHP folder
    RewriteRule ^api/(.*)$ php-backend/index.php [QSA,L]
    RewriteRule ^jellyfin/(.*)$ php-backend/index.php [QSA,L]

    # Standard React Router fallback for clean client URLs
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . index.html [L]
</IfModule>
```

This single config does three things:
1.  Redirects all `/api/*` calls into your `/php-backend/index.php` router.
2.  Redirects all `/jellyfin/*` video streaming / API calls to the PHP reverse proxy.
3.  Ensures React routing (like `/dashboard`, `/admin`) works correctly on page refresh without throwing 404 errors!

---

## ⏰ Step 5: Configure the Expiry Cron Job
cPanel lets you automate background scripts to run periodically.
1.  Search for **Cron Jobs** in cPanel.
2.  Under **Common Settings**, select **Once per day** (e.g., `0 0 * * *`).
3.  In the **Command** field, enter the path to the PHP executable followed by the absolute path to your cron script:
    ```bash
    /usr/local/bin/php /home/your_cpanel_username/public_html/php-backend/expiry-cron.php
    ```
    *(Verify your home folder path and PHP location with your host if unsure).*

---

🎉 **Congratulations!** Your media streaming registration portal is now 100% production-ready and fully hosted on cPanel!
