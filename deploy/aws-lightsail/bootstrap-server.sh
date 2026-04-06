#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo."
  exit 1
fi

apt update
apt install -y nginx mysql-server unzip curl git rsync software-properties-common

if ! command -v php >/dev/null 2>&1; then
  add-apt-repository -y ppa:ondrej/php
  apt update
fi

apt install -y \
  php8.2 \
  php8.2-cli \
  php8.2-common \
  php8.2-curl \
  php8.2-fpm \
  php8.2-mbstring \
  php8.2-mysql \
  php8.2-xml \
  php8.2-zip \
  php8.2-bcmath \
  php8.2-intl \
  php8.2-gd

if ! command -v composer >/dev/null 2>&1; then
  curl -sS https://getcomposer.org/installer | php
  mv composer.phar /usr/local/bin/composer
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

systemctl enable --now php8.2-fpm
systemctl enable --now nginx

mkdir -p /var/www/smarteduconnect-api
mkdir -p /var/www/smarteduconnect-frontend

echo "Server bootstrap complete."
echo "Next:"
echo "1. Copy the repo to /var/www/smarteduconnect-api or clone it there"
echo "2. Copy frontend dist to /var/www/smarteduconnect-frontend/dist"
echo "3. Apply Nginx configs from deploy/aws-lightsail/"
