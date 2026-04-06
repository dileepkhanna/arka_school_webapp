#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/smarteduconnect-api}"
FRONTEND_ROOT="${FRONTEND_ROOT:-/var/www/smarteduconnect-frontend}"
BACKEND_DIR="${BACKEND_DIR:-${APP_ROOT}/backend}"
FRONTEND_DIST="${FRONTEND_DIST:-${FRONTEND_ROOT}/dist}"

echo "Using:"
echo "  APP_ROOT=${APP_ROOT}"
echo "  BACKEND_DIR=${BACKEND_DIR}"
echo "  FRONTEND_DIST=${FRONTEND_DIST}"

if [[ ! -f "${APP_ROOT}/package.json" ]]; then
  echo "package.json not found under ${APP_ROOT}"
  exit 1
fi

if [[ ! -f "${BACKEND_DIR}/artisan" ]]; then
  echo "Laravel backend not found under ${BACKEND_DIR}"
  exit 1
fi

cd "${APP_ROOT}"
npm install
npm run build

mkdir -p "${FRONTEND_DIST}"
rsync -av --delete "${APP_ROOT}/dist/" "${FRONTEND_DIST}/"

cd "${BACKEND_DIR}"
composer install --no-dev --optimize-autoloader

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created backend/.env from example. Fill real production values before continuing."
  exit 0
fi

php artisan key:generate --force
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache"
chmod -R 775 "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache"

echo "Application deploy steps completed."
echo "Next:"
echo "1. Verify backend/.env production values"
echo "2. Copy Nginx configs into /etc/nginx/sites-available/"
echo "3. Reload nginx and php-fpm"
echo "4. Install and enable the queue systemd service"
