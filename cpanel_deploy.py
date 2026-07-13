import os
import zipfile
import subprocess
import sys
import shutil

CPANEL_USER = "zerolord"
CPANEL_PASS = "@f33rinimi"
CPANEL_HOST = "ftp.zerolord.com"
CPANEL_PORT = "2083"
TARGET_DIR = "public_html/cinjelly.zerolord.com"

HTACCESS_CONTENT = """<IfModule mod_rewrite.c>
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
"""

def create_deploy_zip():
    print("Building deploy.zip...")
    zip_path = "deploy.zip"
    
    # Clean old deploy.zip if exists
    if os.path.exists(zip_path):
        os.remove(zip_path)
        
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 1. Add all files in dist/ to the root of the zip
        dist_dir = "dist"
        if not os.path.exists(dist_dir):
            print(f"Error: {dist_dir} does not exist. Did you run 'npm run build'?")
            sys.exit(1)
            
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, dist_dir)
                zipf.write(full_path, rel_path)
                print(f"Added to zip: {rel_path}")
                
        # 2. Add php-backend/ files to php-backend/ in the zip
        backend_dir = "php-backend"
        if not os.path.exists(backend_dir):
            print(f"Error: {backend_dir} does not exist.")
            sys.exit(1)
            
        for root, dirs, files in os.walk(backend_dir):
            for file in files:
                full_path = os.path.join(root, file)
                # Ensure it keeps the "php-backend/" prefix in zip
                rel_path = os.path.join("php-backend", os.path.relpath(full_path, backend_dir))
                zipf.write(full_path, rel_path)
                print(f"Added to zip: {rel_path}")
                
        # 3. Add dynamic .htaccess to the root of the zip
        zipf.writestr(".htaccess", HTACCESS_CONTENT)
        print("Added to zip: .htaccess (routing configuration)")
        
    print(f"Successfully created {zip_path} with all frontend and backend files.")
    return zip_path

def run_curl_command(url_path, data_params=None, files_params=None):
    # Construct curl command
    cmd = [
        "curl",
        "-k", # Ignore self-signed certificates
        "-u", f"{CPANEL_USER}:{CPANEL_PASS}",
    ]
    
    url = f"https://{CPANEL_HOST}:{CPANEL_PORT}/execute/{url_path}"
    
    if files_params:
        for k, v in files_params.items():
            cmd.extend(["-F", f"{k}=@{v}"])
    if data_params:
        for k, v in data_params.items():
            cmd.extend(["-F", f"{k}={v}"])
            
    cmd.append(url)
    
    print(f"Executing UAPI command: {' '.join([arg if 'PASS' not in arg else '***' for arg in cmd])}")
    
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return result

def deploy():
    zip_file = create_deploy_zip()
    
    # 1. Upload files
    print("\n--- Step 1: Uploading deploy.zip to cPanel ---")
    upload_res = run_curl_command(
        "Fileman/upload_files",
        data_params={"dir": TARGET_DIR, "overwrite": "1"},
        files_params={"file": zip_file}
    )
    
    print("Upload Result Output:")
    print(upload_res.stdout)
    if "errors\":null" not in upload_res.stdout and "status\":1" not in upload_res.stdout:
        print("Error uploading file.")
        print(upload_res.stderr)
        sys.exit(1)
    print("Upload successful!")
    
    # 2. Extract files
    print("\n--- Step 2: Extracting deploy.zip on cPanel ---")
    extract_res = run_curl_command(
        "Fileman/extract_archive",
        data_params={"dir": TARGET_DIR, "file": "deploy.zip"}
    )
    print("Extract Result Output:")
    print(extract_res.stdout)
    if "errors\":null" not in extract_res.stdout and "status\":1" not in extract_res.stdout:
        print("Error extracting file.")
        print(extract_res.stderr)
        sys.exit(1)
    print("Extraction successful!")
    
    # 3. Remove deploy.zip from cPanel
    print("\n--- Step 3: Removing temporary deploy.zip from cPanel ---")
    remove_res = run_curl_command(
        "Fileman/remove_files",
        data_params={"dir": TARGET_DIR, "files": "deploy.zip"}
    )
    print("Remove Result Output:")
    print(remove_res.stdout)
    
    # 4. Clean up local zip
    if os.path.exists(zip_file):
        os.remove(zip_file)
    print("\nCleaned up local temporary files.")
    
    print("\n🎉 Deployment completed successfully! Frontend and PHP backend are deployed to cPanel.")

if __name__ == "__main__":
    deploy()
