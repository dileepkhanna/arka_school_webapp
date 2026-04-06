# Smart EduConnect — Hostinger Premium Deployment Guide

Step-by-step guide to deploy the Smart EduConnect school management system on Hostinger Premium hosting.

---

## Architecture Overview

```
yourdomain.com              → React SPA (frontend)  → public_html/
yourdomain.com/api/*        → Laravel API (backend) → public_html/backend/
yourdomain.com/api/auth/*   → Auth endpoints
yourdomain.com/api/classes  → Data endpoints
...etc
```

| Component | Technology      | Hostinger Location       |
|-----------|----------------|--------------------------|
| Frontend  | React + Vite   | `public_html/` (root)    |
| Backend   | Laravel 12 API | `public_html/backend/`   |
| Database  | MySQL 8        | hPanel → Databases       |
| Storage   | Local disk     | `backend/public/uploads/`|

---

## Prerequisites

- Hostinger Premium plan (active)
- Domain connected to Hostinger
- Access to hPanel at `https://hpanel.hostinger.com`
- Node.js 18+ installed locally (for building frontend)
- PHP 8.2 available on Hostinger (default on Premium)

---

## Step 1: Create MySQL Database

1. Log in to **hPanel** → **Databases → MySQL Databases**
2. Create a new database:
   - **Database name:** `uXXXXXXX_smartedu` (auto-prefixed with your account)
   - Click **Create**
3. Create a database user:
   - **Username:** `uXXXXXXX_admin`
   - **Password:** generate a strong password
   - Click **Create**
4. **Assign the user to the database** with **ALL PRIVILEGES**
5. **Note down** the credentials:
   ```
   DB_HOST=localhost
   DB_DATABASE=uXXXXXXX_smartedu
   DB_USERNAME=uXXXXXXX_admin
   DB_PASSWORD=your_password
   ```

---

## Step 2: Build Frontend Locally

Open terminal in the project root (`E:\School_Modification\check`):

```bash
# Install dependencies (if not already)
npm install

# Build production frontend
npm run build
```

This creates the `dist/` folder with optimized static files.

---

## Step 3: Upload Files to Hostinger

### Method A: File Manager (hPanel)

1. **hPanel → Websites → Manage → File Manager**
2. Navigate to `public_html/`
3. **Delete** any default files (index.html, etc.)
4. Upload the **contents** of `dist/` folder to `public_html/`
   - Select all files inside `dist/` (not the folder itself)
   - Upload them to `public_html/`
5. Create a `backend/` folder inside `public_html/`
6. Upload the **entire `backend/` project** into `public_html/backend/`
   - Include: `app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `storage/`, `vendor/`, `artisan`, `composer.json`, `composer.lock`
   - Exclude: `node_modules/`, `.git/`, `tests/`, `compose.yaml`, `compose.lock`

### Method B: FTP (Recommended for large uploads)

1. **hPanel → Files → FTP Accounts** — create or view FTP credentials
2. Use **FileZilla** or **WinSCP** to connect:
   ```
   Host:   ftp.yourdomain.com
   Port:   21
   User:   uXXXXXXX (your FTP username)
   Pass:   your_password
   ```

**Upload structure:**
```
public_html/
├── index.html              ← from dist/
├── assets/                 ← from dist/
├── favicon.ico             ← from dist/
├── pwa-192x192.png         ← from dist/
├── pwa-512x512.png         ← from dist/
├── ase-logo.jpg            ← from dist/
├── sw-push.js              ← from dist/
├── workbox-*.js            ← from dist/
├── robots.txt              ← from dist/
├── .htaccess               ← from root (already exists)
└── backend/                ← Laravel project
    ├── app/
    ├── artisan
    ├── bootstrap/
    ├── config/
    ├── database/
    ├── public/
    │   ├── index.php
    │   ├── .htaccess
    │   ├── uploads/
    │   └── storage/
    ├── resources/
    ├── routes/
    ├── storage/
    ├── vendor/
    ├── .env
    └── composer.json
```

> **Important:** The `dist/` files go directly in `public_html/` root, NOT inside a subfolder. The `.htaccess` in the root handles routing.

---

## Step 4: Configure Backend Environment (.env)

1. In hPanel File Manager, navigate to `public_html/backend/`
2. Copy `.env.example` to `.env` (or rename it)
3. Edit `.env` with the sample values below

### Sample `.env` for Hostinger Production

```env
# ============================================================
#  SmartEduConnect — Laravel Backend (Hostinger Production)
# ============================================================

# ----- Application -----
APP_NAME="SmartEduConnect"
APP_ENV=production
APP_KEY=base64:REPLACE_WITH_GENERATED_KEY
APP_DEBUG=false
APP_URL=https://yourdomain.com

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

# ----- Security -----
BCRYPT_ROUNDS=12

# ----- Logging -----
LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

# ----- Database (from hPanel → MySQL Databases) -----
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=uXXXXXXX_smartedu
DB_USERNAME=uXXXXXXX_admin
DB_PASSWORD=YourStrongDatabasePassword123!
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# ----- Session (use database — no Redis on Hostinger Premium) -----
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_EXPIRE_ON_CLOSE=false

# ----- Cache (use database — no Redis on Hostinger Premium) -----
CACHE_STORE=database

# ----- Queue (use database — no Redis on Hostinger Premium) -----
QUEUE_CONNECTION=database

# ----- Broadcast -----
BROADCAST_CONNECTION=log

# ----- Filesystem (local — no S3 on Hostinger Premium) -----
# Files stored in backend/storage/ and accessible via backend/public/uploads/
FILESYSTEM_DISK=local

# ----- AWS S3 (DISABLED — leave commented for Hostinger Premium) -----
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_DEFAULT_REGION=
# AWS_BUCKET=
# AWS_URL=
# AWS_ENDPOINT=
# AWS_USE_PATH_STYLE_ENDPOINT=false

# ----- Redis (DISABLED — leave commented for Hostinger Premium) -----
# REDIS_CLIENT=phpredis
# REDIS_HOST=127.0.0.1
# REDIS_PASSWORD=null
# REDIS_PORT=6379

# ----- Mail (Hostinger SMTP) -----
MAIL_MAILER=smtp
MAIL_SCHEME=tls
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USERNAME=noreply@yourdomain.com
MAIL_PASSWORD=YourEmailPassword123!
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="noreply@yourdomain.com"
MAIL_FROM_NAME="${APP_NAME}"

# ----- CORS (set to your production domain) -----
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# ----- VAPID Push Notifications -----
# Generate new keys for production: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=REPLACE_WITH_YOUR_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:noreply@yourdomain.com

# ----- Octane (DISABLED on Hostinger Premium shared hosting) -----
# OCTANE_SERVER=swoole
```

### Where to Get Each Value

| Variable | Where to Find It |
|----------|-----------------|
| `APP_KEY` | Generate via SSH: `php artisan key:generate` |
| `DB_DATABASE` | hPanel → Databases → MySQL Databases → your database name |
| `DB_USERNAME` | hPanel → Databases → MySQL Databases → your user name |
| `DB_PASSWORD` | The password you set when creating the DB user |
| `MAIL_USERNAME` | hPanel → Emails → Email Accounts → your email address |
| `MAIL_PASSWORD` | Password for the email account created in hPanel |
| `VAPID_*` | Run `npx web-push generate-vapid-keys` locally, paste both keys |

### Key Differences from Local `.env`

| Setting | Local (Docker) | Hostinger Production |
|---------|---------------|---------------------|
| `APP_ENV` | `local` | `production` |
| `APP_DEBUG` | `true` | `false` |
| `APP_URL` | `http://localhost` | `https://yourdomain.com` |
| `DB_HOST` | `mysql` (Docker) | `localhost` |
| `SESSION_DRIVER` | `redis` | `database` |
| `CACHE_STORE` | `redis` | `database` |
| `FILESYSTEM_DISK` | `s3` | `local` |
| `MAIL_HOST` | `mailpit` (Docker) | `smtp.hostinger.com` |
| `MAIL_PORT` | `1025` | `465` |
| `SESSION_SECURE_COOKIE` | `false` | `true` |
| `LOG_LEVEL` | `debug` | `error` |
| `FRONTEND_URL` | `http://localhost:8081` | `https://yourdomain.com` |
| `OCTANE_SERVER` | `swoole` | *commented out* |

> **Important:**
> - Replace **all** `yourdomain.com` with your actual domain
> - Replace **all** `uXXXXXXX` with your Hostinger account prefix
> - Replace `REPLACE_WITH_*` placeholders with actual generated values
> - Set `FILESYSTEM_DISK=local` (not `s3`) — Hostinger Premium has no S3
> - Set `SESSION_DRIVER=database` and `CACHE_STORE=database` — no Redis on Premium
> - Comment out `OCTANE_SERVER` — Laravel Octane requires VPS, not shared hosting
> - After editing, **always run** `php artisan config:cache` via SSH

---

## Step 5: Generate Laravel App Key

1. **hPanel → Advanced → SSH Access** — enable SSH if not already
2. Connect via SSH:
   ```bash
   ssh uXXXXXXX@yourdomain.com -p 65002
   ```
3. Navigate to backend and generate key:
   ```bash
   cd public_html/backend
   php artisan key:generate
   ```
4. This will update the `APP_KEY` in your `.env` file automatically.

> **Alternative without SSH:** Open `.env` and manually generate a key:
> - Run `php -r "echo 'base64:' . base64_encode(random_bytes(32));"` locally
> - Paste the result as `APP_KEY` in `.env`

---

## Step 6: Run Database Migrations

### Option A: Via SSH (Recommended)
```bash
cd public_html/backend
php artisan migrate --force
php artisan db:seed --force    # if you have seeders
```

### Option B: Via phpMyAdmin
1. **hPanel → Databases → phpMyAdmin**
2. Select your database (`uXXXXXXX_smartedu`)
3. Go to **Import** tab
4. Import the SQL file: `u923569146_smarteduco.sql` from the project root
5. Click **Go**

---

## Step 7: Configure PHP Version

1. **hPanel → Hosting → Manage → PHP Configuration**
2. Set:
   - **PHP Version:** `8.2` (or `8.3`)
   - **memory_limit:** `1536M`
   - **max_execution_time:** `360`
   - **upload_max_filesize:** `1536M`
   - **post_max_size:** `1536M`
3. Click **Save**

---

## Step 8: Set Folder Permissions

Via SSH or hPanel File Manager, ensure these directories are writable:

```bash
cd public_html/backend
chmod -R 775 storage/
chmod -R 775 bootstrap/cache/
chmod -R 775 public/uploads/
```

> In hPanel File Manager: right-click folder → **Change Permissions** → set to `755` or `775`.

---

## Step 9: Verify .htaccess Files

### Root `.htaccess` (public_html/.htaccess)
This file should already exist in your project root. It handles:
- React SPA client-side routing
- Forwarding `/api/*` requests to `backend/public/index.php`
- Caching headers for static assets

### Backend `.htaccess` (public_html/backend/public/.htaccess)
This is Laravel's standard `.htaccess` that routes all requests through `index.php`.

Verify both files are uploaded correctly.

---

## Step 10: Clear Laravel Cache

Via SSH:
```bash
cd public_html/backend
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
```

---

## Step 11: Enable SSL (HTTPS)

1. **hPanel → Security → SSL**
2. Select your domain → **Install** (free Let's Encrypt SSL)
3. Wait for installation to complete
4. Force HTTPS — add to `public_html/.htaccess` (if not already):
```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

---

## Step 12: Verify Deployment

Open your browser and check:

| URL | Expected Result |
|-----|-----------------|
| `https://yourdomain.com` | React app loads (login page) |
| `https://yourdomain.com/api/auth/admin-exists` | Returns JSON `{"exists":false}` or `true` |
| `https://yourdomain.com/backend/public/index.php` | Should redirect or show Laravel welcome |

If the React app loads but API calls fail:
- Check browser console for CORS errors
- Verify `.env` → `APP_URL` and `ALLOWED_ORIGINS` match your domain
- Check `backend/storage/logs/laravel.log` for errors

---

## Step 13: Create First Admin Account

1. Open `https://yourdomain.com` in your browser
2. Click **Sign Up**
3. The first registered user automatically becomes **Admin**
4. Log in with your admin credentials

---

## All SSH Commands — Copy & Paste Ready

### Connect to Hostinger SSH

```bash
ssh uXXXXXXX@yourdomain.com -p 65002
```

> Find your SSH credentials in **hPanel → Advanced → SSH Access**.

---

### Initial Deployment Commands (Run Once)

```bash
# Navigate to backend directory
cd ~/public_html/backend

# 1. Generate application key
php artisan key:generate

# 2. Run all database migrations
php artisan migrate --force

# 3. Run seeders (creates default data if any)
php artisan db:seed --force

# 4. Create storage symlink (for public file access)
php artisan storage:link

# 5. Cache configuration for production performance
php artisan config:cache

# 6. Cache routes for faster routing
php artisan route:cache

# 7. Cache views for faster page rendering
php artisan view:cache

# 8. Set proper directory permissions
chmod -R 775 storage/
chmod -R 775 bootstrap/cache/
chmod -R 775 public/uploads/
```

---

### After Every Code Update (Redeployment)

```bash
# Navigate to backend directory
cd ~/public_html/backend

# 1. Clear all caches first
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# 2. Run any new migrations
php artisan migrate --force

# 3. Rebuild caches for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 4. Restart queue workers (if using queues)
php artisan queue:restart
```

---

### Useful Debugging Commands

```bash
# Navigate to backend directory
cd ~/public_html/backend

# Check Laravel version
php artisan --version

# List all registered routes
php artisan route:list

# Test database connection
php artisan db:show

# Check application status
php artisan about

# View recent logs
tail -n 100 storage/logs/laravel.log

# Check if storage link exists
ls -la public/storage

# Verify PHP version and extensions
php -v
php -m | grep -i mysql
php -m | grep -i mbstring

# Check .env is loaded correctly
php artisan tinker --execute="echo config('app.url');"

# Check database tables exist
php artisan tinker --execute="echo collect(DB::select('SHOW TABLES'))->count() . ' tables';"
```

---

### Database Commands

```bash
# Navigate to backend directory
cd ~/public_html/backend

# Check migration status
php artisan migrate:status

# Rollback last migration (if needed)
php artisan migrate:rollback --force

# Rollback all migrations and re-run
php artisan migrate:fresh --force

# Import SQL file via command line (alternative to phpMyAdmin)
mysql -u uXXXXXXX_admin -p uXXXXXXX_smartedu < ~/u923569146_smarteduco.sql

# Export database backup
mysqldump -u uXXXXXXX_admin -p uXXXXXXX_smartedu > ~/backup_$(date +%Y%m%d).sql
```

---

### Cache & Optimization Commands

```bash
# Navigate to backend directory
cd ~/public_html/backend

# Clear ALL caches at once
php artisan optimize:clear

# Rebuild ALL caches at once (recommended for production)
php artisan optimize

# Clear specific cache
php artisan cache:clear          # Application cache
php artisan config:clear         # Config cache
php artisan route:clear          # Route cache
php artisan view:clear           # View cache
php artisan event:clear          # Event cache

# Rebuild specific cache
php artisan config:cache         # Config cache
php artisan route:cache          # Route cache
php artisan view:cache           # View cache
```

---

### Scheduler (Cron Jobs) Setup

If your app uses scheduled tasks, add this cron entry:

```bash
# Open crontab editor
crontab -e

# Add this line (runs Laravel scheduler every minute)
* * * * * cd ~/public_html/backend && php artisan schedule:run >> /dev/null 2>&1
```

---

### Queue Worker Setup (If Using Queues)

```bash
# Navigate to backend directory
cd ~/public_html/backend

# Start queue worker (runs in background)
nohup php artisan queue:work --tries=3 --timeout=90 &

# Check running queue processes
ps aux | grep "queue:work"

# Stop all queue workers
php artisan queue:restart
```

---

### Complete Deployment Script (All-in-One)

Copy and paste this entire block for a fresh deployment:

```bash
# ============================================
# Smart EduConnect — Full Deployment Script
# ============================================

cd ~/public_html/backend

echo ">>> Clearing old caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

echo ">>> Setting permissions..."
chmod -R 775 storage/
chmod -R 775 bootstrap/cache/
chmod -R 775 public/uploads/

echo ">>> Creating storage link..."
php artisan storage:link

echo ">>> Running migrations..."
php artisan migrate --force

echo ">>> Optimizing for production..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo ">>> Restarting queue workers..."
php artisan queue:restart

echo ">>> Deployment complete!"
php artisan --version
```

---

## Troubleshooting

### 500 Internal Server Error
```bash
# Check Laravel logs
cat public_html/backend/storage/logs/laravel.log

# Fix permissions
chmod -R 775 public_html/backend/storage/
chmod -R 775 public_html/backend/bootstrap/cache/
```

### API Returns 404
- Verify `.htaccess` in root is correctly uploaded
- Check that `mod_rewrite` is enabled (Hostinger enables it by default)
- Test: visit `https://yourdomain.com/api/auth/admin-exists` directly

### CORS Errors
Update `backend/.env`:
```env
APP_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```
Then clear cache:
```bash
php artisan config:clear
php artisan config:cache
```

### Database Connection Failed
- Verify DB credentials in `backend/.env`
- Ensure DB host is `localhost` (not `127.0.0.1`)
- Check that user has ALL PRIVILEGES on the database

### File Uploads Not Working
- Ensure `public_html/backend/public/uploads/` exists and is writable (`775`)
- Check PHP `upload_max_filesize` is set to `1536M`

### Blank White Page
- Check browser console for JavaScript errors
- Verify all `dist/` files were uploaded to `public_html/` (not a subfolder)
- Clear browser cache

---

## Quick Checklist

- [ ] MySQL database created in hPanel
- [ ] Database user created with ALL PRIVILEGES
- [ ] Frontend built locally (`npm run build`)
- [ ] `dist/` contents uploaded to `public_html/`
- [ ] `backend/` project uploaded to `public_html/backend/`
- [ ] `backend/.env` configured with correct DB credentials
- [ ] Laravel `APP_KEY` generated
- [ ] Database migrated (`php artisan migrate --force` or SQL import)
- [ ] PHP 8.2+ configured with correct limits
- [ ] `storage/`, `bootstrap/cache/`, `public/uploads/` permissions set
- [ ] Laravel cache cleared
- [ ] SSL enabled and HTTPS forced
- [ ] First admin account created
- [ ] All features tested (login, dashboard, attendance, exams, fees, etc.)

---

*Guide last updated: April 2026*
