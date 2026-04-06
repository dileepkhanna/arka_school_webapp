import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const outputPath = path.resolve('deploy/hostinger/Hostinger-SSH-Deployment-Guide.pdf');

const sections = [
  {
    title: 'Hostinger SSH Deployment Guide',
    lines: [
      'This guide is tailored to SmartEduConnect.',
      '',
      'Recommended production layout:',
      '- Frontend SPA on app.yourdomain.com',
      '- Laravel API on api.yourdomain.com',
      '',
      'Why split domains:',
      '- The React SPA uses client routes such as /auth',
      '- The Laravel backend also exposes API routes at /auth, /gallery, /fees, etc.',
      '- Using one hostname for both would create route collisions',
    ],
  },
  {
    title: '1. Choose the right Hostinger plan',
    lines: [
      'For this app, prefer Hostinger VPS or Cloud hosting with SSH access and background process support.',
      '',
      'Reason:',
      '- Laravel backend needs PHP, Composer, writable storage, migrations, and a queue worker',
      '- The frontend needs a production build and static hosting',
      '- Push notifications and background jobs work better on VPS-style hosting than basic shared hosting',
    ],
  },
  {
    title: '2. Enable SSH in Hostinger',
    lines: [
      'In hPanel:',
      '1. Open Websites',
      '2. Open the site Dashboard',
      '3. Search for SSH Access',
      '4. Enable SSH/SFTP access',
      '5. Copy the SSH command shown in hPanel',
      '',
      'Then connect from your machine:',
      'ssh your_user@your_host',
      '',
      'Optional but recommended:',
      '- Generate an SSH key pair locally',
      '- Add the public key in hPanel under SSH Access',
    ],
  },
  {
    title: '3. Prepare the server over SSH',
    lines: [
      'After connecting through SSH, install the runtime stack if you are on VPS:',
      'sudo apt update',
      'sudo apt install -y nginx mysql-server unzip curl git rsync software-properties-common',
      'sudo add-apt-repository -y ppa:ondrej/php',
      'sudo apt update',
      'sudo apt install -y php8.2 php8.2-cli php8.2-common php8.2-curl php8.2-fpm php8.2-mbstring php8.2-mysql php8.2-xml php8.2-zip php8.2-bcmath php8.2-intl php8.2-gd',
      '',
      'Install Composer if missing:',
      'curl -sS https://getcomposer.org/installer | php',
      'sudo mv composer.phar /usr/local/bin/composer',
      '',
      'Install Node.js 20 if missing:',
      'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -',
      'sudo apt install -y nodejs',
    ],
  },
  {
    title: '4. Upload or clone the project',
    lines: [
      'Recommended paths:',
      '- /var/www/smarteduconnect-api',
      '- /var/www/smarteduconnect-frontend',
      '',
      'Create them:',
      'sudo mkdir -p /var/www/smarteduconnect-api',
      'sudo mkdir -p /var/www/smarteduconnect-frontend',
      '',
      'Then clone or upload your project into /var/www/smarteduconnect-api',
    ],
  },
  {
    title: '5. Frontend environment',
    lines: [
      'Create the frontend .env in the project root:',
      'VITE_API_BASE_URL=https://api.yourdomain.com',
      'VITE_BACKEND_TARGET=http://127.0.0.1',
      '',
      'Build frontend:',
      'cd /var/www/smarteduconnect-api',
      'npm install',
      'npm run build',
      '',
      'Sync built files:',
      'sudo mkdir -p /var/www/smarteduconnect-frontend/dist',
      'sudo rsync -av --delete dist/ /var/www/smarteduconnect-frontend/dist/',
    ],
  },
  {
    title: '6. Backend environment',
    lines: [
      'Copy and edit backend env:',
      'cd /var/www/smarteduconnect-api/backend',
      'cp .env.example .env',
      '',
      'Important values:',
      'APP_ENV=production',
      'APP_DEBUG=false',
      'APP_URL=https://api.yourdomain.com',
      'FRONTEND_URL=https://app.yourdomain.com',
      'ALLOWED_ORIGINS=',
      'DB_CONNECTION=mysql',
      'DB_HOST=127.0.0.1',
      'DB_PORT=3306',
      'DB_DATABASE=school_app',
      'DB_USERNAME=school_user',
      'DB_PASSWORD=your_db_password',
      'SESSION_DRIVER=database',
      'SESSION_SECURE_COOKIE=true',
      'SESSION_SAME_SITE=lax',
      'QUEUE_CONNECTION=database',
      'FILESYSTEM_DISK=s3',
    ],
  },
  {
    title: '7. Configure S3 storage',
    lines: [
      'Set these in backend/.env:',
      'AWS_ACCESS_KEY_ID=your_key',
      'AWS_SECRET_ACCESS_KEY=your_secret',
      'AWS_DEFAULT_REGION=ap-south-2',
      'AWS_BUCKET=schoolwebapp1',
      'AWS_URL=',
      'AWS_ENDPOINT=',
      'AWS_USE_PATH_STYLE_ENDPOINT=false',
      '',
      'New uploads from the refactored modules should go to S3:',
      '- gallery images',
      '- message attachments',
      '- receipt logos',
      '- profile, teacher, and student photos',
      '- homework, leave, and certificate attachments',
      '',
      'Old local files are not migrated automatically.',
    ],
  },
  {
    title: '8. Create MySQL database',
    lines: [
      'Run:',
      'sudo mysql',
      '',
      'SQL:',
      "CREATE DATABASE school_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
      "CREATE USER 'school_user'@'127.0.0.1' IDENTIFIED BY 'your_db_password';",
      "GRANT ALL PRIVILEGES ON school_app.* TO 'school_user'@'127.0.0.1';",
      'FLUSH PRIVILEGES;',
      'EXIT;',
    ],
  },
  {
    title: '9. Install Laravel dependencies and migrate',
    lines: [
      'cd /var/www/smarteduconnect-api/backend',
      'composer install --no-dev --optimize-autoloader',
      'php artisan key:generate --force',
      'php artisan migrate --force',
      'php artisan optimize:clear',
      'php artisan config:cache',
      'php artisan route:cache',
      'php artisan view:cache',
      '',
      'Fix permissions:',
      'sudo chown -R www-data:www-data storage bootstrap/cache',
      'sudo chmod -R 775 storage bootstrap/cache',
    ],
  },
  {
    title: '10. Configure Nginx',
    lines: [
      'Use the prepared project configs as templates:',
      '- deploy/aws-lightsail/frontend-nginx.conf',
      '- deploy/aws-lightsail/backend-nginx.conf',
      '',
      'Copy and edit them for Hostinger VPS:',
      'sudo cp deploy/aws-lightsail/frontend-nginx.conf /etc/nginx/sites-available/smarteduconnect-frontend',
      'sudo cp deploy/aws-lightsail/backend-nginx.conf /etc/nginx/sites-available/smarteduconnect-backend',
      '',
      'Replace example domains with your real domains, then enable and reload nginx.',
    ],
  },
  {
    title: '11. Configure queue worker',
    lines: [
      'Use the prepared systemd file:',
      'sudo cp deploy/aws-lightsail/laravel-queue.service /etc/systemd/system/smarteduconnect-queue.service',
      'sudo systemctl daemon-reload',
      'sudo systemctl enable --now smarteduconnect-queue.service',
      '',
      'Verify:',
      'sudo systemctl status smarteduconnect-queue.service',
    ],
  },
  {
    title: '12. Configure push notifications',
    lines: [
      'Set VAPID keys in backend/.env:',
      'VAPID_PUBLIC_KEY=your_public_key',
      'VAPID_PRIVATE_KEY=your_private_key',
      'VAPID_SUBJECT=mailto:admin@yourdomain.com',
      '',
      'Then reload Laravel config:',
      'php artisan config:clear',
      'php artisan cache:clear',
      'php artisan config:cache',
      '',
      'Requirements:',
      '- HTTPS must be active',
      '- push_subscriptions table must exist',
      '- queue worker must be running',
      '',
      'User activation:',
      '1. Log in',
      '2. Open Settings',
      '3. Enable Push Notifications',
      '4. Allow browser notification permission',
    ],
  },
  {
    title: '13. HTTPS and final checks',
    lines: [
      'Install Certbot:',
      'sudo apt install -y certbot python3-certbot-nginx',
      '',
      'Issue certificates:',
      'sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com',
      '',
      'Final verification:',
      '1. Open https://app.yourdomain.com',
      '2. Confirm API calls go to https://api.yourdomain.com',
      '3. Upload a file and confirm the stored URL is S3-based',
      '4. Confirm an object appears in the S3 bucket',
      '5. Trigger a notification and confirm push delivery',
    ],
  },
  {
    title: 'Official Hostinger sources',
    lines: [
      'Enable SSH Access:',
      'https://support.hostinger.com/en/articles/1583645-how-to-enable-ssh-access',
      '',
      'Connect remotely using SSH:',
      'https://support.hostinger.com/en/articles/10441250-how-to-connect-to-a-hosting-plan-remotely-using-ssh-in-hostinger',
      '',
      'Generate and add SSH keys:',
      'https://support.hostinger.com/en/articles/5634532-how-to-generate-ssh-keys-and-add-them-to-hpanel',
      '',
      'Node.js web app deployment on Hostinger:',
      'https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/',
      '',
      'Node.js app domain connection:',
      'https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/',
    ],
  },
];

const doc = new jsPDF({ unit: 'pt', format: 'a4' });
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 48;
const contentWidth = pageWidth - margin * 2;
let y = margin;

const addPageIfNeeded = (neededHeight = 20) => {
  if (y + neededHeight > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
};

doc.setFont('helvetica', 'bold');
doc.setFontSize(22);
doc.text('SmartEduConnect', margin, y);
y += 26;
doc.text('Hostinger SSH Deployment Guide', margin, y);
y += 20;

doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
const intro = doc.splitTextToSize(
  'This PDF summarizes a Hostinger SSH-based deployment path for the SmartEduConnect frontend and Laravel backend. Hostinger-specific access steps are based on current official Hostinger documentation. The app-specific deployment layout is derived from this repository.',
  contentWidth,
);
doc.text(intro, margin, y);
y += intro.length * 14 + 10;

for (const section of sections) {
  addPageIfNeeded(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(section.title, margin, y);
  y += 18;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10.2);

  for (const line of section.lines) {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    addPageIfNeeded(wrapped.length * 13 + 4);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 13;
  }

  y += 10;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
doc.save(outputPath);
console.log(`Generated ${outputPath}`);
