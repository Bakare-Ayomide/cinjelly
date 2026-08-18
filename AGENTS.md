# Project Persistent Instructions & Workflows

## Production Deployment Rule
- **Always build and deploy to production cPanel via FTP** whenever requested or when production releases/updates are finalized.
- **Build Command**: `npm run build`
- **FTP Deployment Script**: `python3 deploy_via_ftp.py`
- Production Host: `ftp.zerolord.com` (Target: `cinjelly@zerolord.com`)
- Target Directories on cPanel: `/` (index.html, .htaccess), `/assets`, `/backend`, `/php-backend`.
