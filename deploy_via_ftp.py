import os
import ftplib
import sys

FTP_HOST = "ftp.zerolord.com"
FTP_USER = "cinjelly@zerolord.com"
FTP_PASS = "@f33rinimi"

HTACCESS_CONTENT = """<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Do not rewrite direct requests to uploaded media files
    RewriteCond %{REQUEST_URI} ^/uploads/ [NC]
    RewriteCond %{REQUEST_FILENAME} -f
    RewriteRule ^ - [L]

    # Route /api, /jellyfin, /php-backend, and /backend requests directly to php-backend/index.php
    RewriteRule ^api(/.*)?$ php-backend/index.php [QSA,L]
    RewriteRule ^jellyfin(/.*)?$ php-backend/index.php [QSA,L]
    RewriteRule ^php-backend(/.*)?$ php-backend/index.php [QSA,L]
    RewriteRule ^backend(/.*)?$ php-backend/index.php [QSA,L]

    # Standard React Router fallback for clean client URLs
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . index.html [L]
</IfModule>

<IfModule mod_headers.c>
    # Prevent caching of index.html so updates are visible immediately
    <FilesMatch "\.(html|htm)$">
        Header set Cache-Control "max-age=0, no-cache, no-store, must-revalidate"
        Header set Pragma "no-cache"
        Header set Expires "Wed, 11 Jan 1984 05:00:00 GMT"
    </FilesMatch>

    # Cache static assets and video/media files efficiently with streaming support
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif|mp4|webm|mov|mkv|avi|ogg|m4v|ts|m3u8)$">
        Header set Cache-Control "max-age=31536000, public"
        Header set Access-Control-Allow-Origin "*"
        Header set Accept-Ranges bytes
    </FilesMatch>
</IfModule>

<IfModule mod_php7.c>
    php_value upload_max_filesize 256M
    php_value post_max_size 256M
    php_value memory_limit 512M
    php_value max_execution_time 300
    php_value max_input_time 300
</IfModule>

<IfModule mod_php.c>
    php_value upload_max_filesize 256M
    php_value post_max_size 256M
    php_value memory_limit 512M
    php_value max_execution_time 300
    php_value max_input_time 300
</IfModule>
"""

def upload_file(ftp, local_path, remote_filename):
    print(f"Uploading {local_path} to {remote_filename}...")
    with open(local_path, "rb") as f:
        ftp.storbinary(f"STOR {remote_filename}", f)

def deploy():
    print("🚀 Starting FTP Deployment...")
    
    # Verify dist folder exists
    if not os.path.exists("dist"):
        print("❌ Error: 'dist' folder not found! Please run 'npm run build' first.")
        sys.exit(1)
        
    try:
        # Connect to FTP
        print(f"Connecting to FTP server: {FTP_HOST}...")
        ftp = ftplib.FTP()
        ftp.connect(FTP_HOST, 21, timeout=15)
        ftp.login(FTP_USER, FTP_PASS)
        print("✅ Logged in successfully!")
        
        # 1. Upload index.html to /
        print("\n--- Step 1: Deploying index.html ---")
        ftp.cwd("/")
        upload_file(ftp, "dist/index.html", "index.html")
        
        # 2. Upload assets
        print("\n--- Step 2: Deploying static assets ---")
        # Check if assets folder exists
        try:
            ftp.cwd("/assets")
        except ftplib.error_perm:
            print("Creating remote 'assets' directory...")
            ftp.cwd("/")
            ftp.mkd("assets")
            ftp.cwd("/assets")
            
        # Clear existing assets to prevent bloating
        print("Cleaning up old assets from remote directory...")
        remote_files = ftp.nlst()
        for f in remote_files:
            if f not in [".", ".."]:
                try:
                    ftp.delete(f)
                    print(f"Deleted old remote asset: {f}")
                except Exception as e:
                    print(f"Warning: Could not delete {f}: {e}")
                    
        # Upload new assets
        local_assets_dir = "dist/assets"
        for filename in os.listdir(local_assets_dir):
            local_file_path = os.path.join(local_assets_dir, filename)
            if os.path.isfile(local_file_path):
                upload_file(ftp, local_file_path, filename)
                
        # 3. Upload php-backend
        print("\n--- Step 3: Deploying PHP backend to /backend and /php-backend ---")
        for target_remote_dir in ["/backend", "/php-backend"]:
            try:
                ftp.cwd(target_remote_dir)
            except ftplib.error_perm:
                print(f"Creating remote '{target_remote_dir}' directory...")
                ftp.cwd("/")
                ftp.mkd(target_remote_dir.lstrip("/"))
                ftp.cwd(target_remote_dir)
                
            local_backend_dir = "php-backend"
            for filename in os.listdir(local_backend_dir):
                local_file_path = os.path.join(local_backend_dir, filename)
                if os.path.isfile(local_file_path):
                    upload_file(ftp, local_file_path, filename)
                
        # 4. Ensure upload directories exist
        print("\n--- Step 4: Ensuring uploads storage directories ---")
        for upload_sub in ["uploads", "uploads/landing", "uploads/landing/temp", "uploads/notifications"]:
            try:
                ftp.cwd(f"/{upload_sub}")
            except ftplib.error_perm:
                try:
                    ftp.cwd("/")
                    ftp.mkd(upload_sub)
                    print(f"Created remote directory: /{upload_sub}")
                except Exception as e:
                    print(f"Notice: /{upload_sub}: {e}")

        # 5. Upload .user.ini and .htaccess to root
        print("\n--- Step 5: Deploying root .htaccess and .user.ini ---")
        ftp.cwd("/")
        if os.path.exists("php-backend/.user.ini"):
            upload_file(ftp, "php-backend/.user.ini", ".user.ini")
        
        # Save temporary .htaccess locally to upload it
        temp_htaccess_path = "temp_htaccess"
        with open(temp_htaccess_path, "w") as f:
            f.write(HTACCESS_CONTENT)
            
        try:
            upload_file(ftp, temp_htaccess_path, ".htaccess")
        finally:
            if os.path.exists(temp_htaccess_path):
                os.remove(temp_htaccess_path)
                
        # Close connection
        ftp.quit()
        print("\n🎉 FTP Deployment completed successfully!")
        
    except Exception as e:
        print(f"\n❌ FTP Deployment failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    deploy()
