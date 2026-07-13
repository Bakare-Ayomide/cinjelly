import os
import ftplib
import sys

FTP_HOST = "ftp.zerolord.com"
FTP_USER = "cinjelly@zerolord.com"
FTP_PASS = "@f33rinimi"

HTACCESS_CONTENT = """<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Route /api and /jellyfin requests directly to the PHP folder
    RewriteRule ^api/(.*)$ backend/index.php [QSA,L]
    RewriteRule ^jellyfin/(.*)$ backend/index.php [QSA,L]

    # Standard React Router fallback for clean client URLs
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . index.html [L]
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
        print("\n--- Step 3: Deploying PHP backend ---")
        # Check if backend folder exists
        try:
            ftp.cwd("/backend")
        except ftplib.error_perm:
            print("Creating remote 'backend' directory...")
            ftp.cwd("/")
            ftp.mkd("backend")
            ftp.cwd("/backend")
            
        # Upload PHP backend files
        local_backend_dir = "php-backend"
        for filename in os.listdir(local_backend_dir):
            local_file_path = os.path.join(local_backend_dir, filename)
            if os.path.isfile(local_file_path):
                upload_file(ftp, local_file_path, filename)
                
        # 4. Upload .htaccess to root
        print("\n--- Step 4: Deploying root .htaccess ---")
        ftp.cwd("/")
        
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
