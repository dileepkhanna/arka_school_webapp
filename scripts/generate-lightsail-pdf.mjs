import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';

const outputPath = path.resolve('deploy/aws-lightsail/AWS-Lightsail-Deployment-Guide.pdf');

const sections = [
  {
    title: 'AWS Lightsail Deployment Guide',
    lines: [
      'SmartEduConnect deployment layout',
      '',
      'Use split domains to avoid route collisions:',
      '- Frontend SPA: https://app.yourdomain.com',
      '- Laravel API: https://api.yourdomain.com',
      '',
      'The backend uses root paths like /auth, /gallery, and /fees.',
      'Running the frontend and backend on the same hostname will conflict with SPA routes.',
    ],
  },
  {
    title: '1. Create Lightsail Resources',
    lines: [
      '1. Create an Ubuntu 22.04 or 24.04 Lightsail instance.',
      '2. Open ports 80 and 443 in the Lightsail networking tab.',
      '3. Point DNS records:',
      '   - app.yourdomain.com -> frontend host',
      '   - api.yourdomain.com -> backend Lightsail instance IP',
      '',
      'SSH:',
      'ssh ubuntu@YOUR_SERVER_IP',
    ],
  },
  {
    title: '2. Copy Project and Bootstrap Server',
    lines: [
      'Copy or clone the project to:',
      '/var/www/smarteduconnect-api',
      '',
      'Run:',
      'cd /var/www/smarteduconnect-api',
      'sudo bash deploy/aws-lightsail/bootstrap-server.sh',
      '',
      'This installs Nginx, MySQL, PHP 8.2, Composer, Node.js, and rsync.',
    ],
  },
  {
    title: '3. Frontend Environment',
    lines: [
      'Create /var/www/smarteduconnect-api/.env with:',
      'VITE_API_BASE_URL=https://api.yourdomain.com',
      'VITE_BACKEND_TARGET=http://127.0.0.1',
    ],
  },
  {
    title: '4. Backend Environment',
    lines: [
      'Copy and edit backend env:',
      'cp backend/.env.example backend/.env',
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
      'AWS_ACCESS_KEY_ID=your_key',
      'AWS_SECRET_ACCESS_KEY=your_secret',
      'AWS_DEFAULT_REGION=ap-south-2',
      'AWS_BUCKET=schoolwebapp1',
      'AWS_URL=',
      'AWS_ENDPOINT=',
      'AWS_USE_PATH_STYLE_ENDPOINT=false',
      'VAPID_PUBLIC_KEY=your_public_key',
      'VAPID_PRIVATE_KEY=your_private_key',
      'VAPID_SUBJECT=mailto:admin@yourdomain.com',
    ],
  },
  {
    title: '5. Create MySQL Database',
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
    title: '6. Deploy Application',
    lines: [
      'Run:',
      'cd /var/www/smarteduconnect-api',
      'bash deploy/aws-lightsail/deploy-app.sh',
      '',
      'The script builds the frontend, syncs dist/, installs Laravel dependencies,',
      'runs migrations, caches config/routes/views, and fixes permissions.',
      '',
      'If backend/.env does not exist yet, the script creates it and stops.',
      'Fill production values and rerun.',
    ],
  },
  {
    title: '7. Install Nginx Configs',
    lines: [
      'Copy configs:',
      'sudo cp deploy/aws-lightsail/frontend-nginx.conf /etc/nginx/sites-available/smarteduconnect-frontend',
      'sudo cp deploy/aws-lightsail/backend-nginx.conf /etc/nginx/sites-available/smarteduconnect-backend',
      '',
      'Edit domains inside both files.',
      '',
      'Enable and reload:',
      'sudo ln -s /etc/nginx/sites-available/smarteduconnect-frontend /etc/nginx/sites-enabled/smarteduconnect-frontend',
      'sudo ln -s /etc/nginx/sites-available/smarteduconnect-backend /etc/nginx/sites-enabled/smarteduconnect-backend',
      'sudo nginx -t',
      'sudo systemctl reload nginx',
    ],
  },
  {
    title: '8. Enable Queue Worker',
    lines: [
      'Run:',
      'sudo cp deploy/aws-lightsail/laravel-queue.service /etc/systemd/system/smarteduconnect-queue.service',
      'sudo systemctl daemon-reload',
      'sudo systemctl enable --now smarteduconnect-queue.service',
      '',
      'Check:',
      'sudo systemctl status smarteduconnect-queue.service',
    ],
  },
  {
    title: '9. Enable HTTPS',
    lines: [
      'Install Certbot:',
      'sudo apt install -y certbot python3-certbot-nginx',
      '',
      'Issue certificates:',
      'sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com',
      '',
      'Reload Nginx:',
      'sudo systemctl reload nginx',
    ],
  },
  {
    title: '10. Refresh Laravel Caches',
    lines: [
      'cd /var/www/smarteduconnect-api/backend',
      'php artisan optimize:clear',
      'php artisan config:cache',
      'php artisan route:cache',
      'php artisan view:cache',
    ],
  },
  {
    title: '11. Post-Deploy Checks',
    lines: [
      '1. Open https://app.yourdomain.com',
      '2. Confirm API calls go to https://api.yourdomain.com',
      '3. Log in',
      '4. Upload one file',
      '5. Confirm the stored file URL is S3-based, not /uploads/...',
      '6. Confirm the uploaded object appears in the S3 bucket',
      '',
      'Notes:',
      '- Old local files remain local until migrated.',
      '- New uploads should use S3.',
      '- Rotate exposed AWS keys before production use.',
    ],
  },
  {
    title: '12. Push Notifications on AWS',
    lines: [
      'Push notifications require both server-side setup and per-user browser activation.',
      '',
      'Backend env values in backend/.env:',
      'VAPID_PUBLIC_KEY=your_public_key',
      'VAPID_PRIVATE_KEY=your_private_key',
      'VAPID_SUBJECT=mailto:admin@yourdomain.com',
      '',
      'After updating env:',
      'cd /var/www/smarteduconnect-api/backend',
      'php artisan config:clear',
      'php artisan cache:clear',
      'php artisan config:cache',
      '',
      'Requirements:',
      '- HTTPS must be active for app.yourdomain.com and api.yourdomain.com',
      '- push_subscriptions table must exist',
      '- Laravel queue worker must be running',
      '',
      'Queue worker check:',
      'sudo systemctl status smarteduconnect-queue.service',
      'sudo systemctl enable --now smarteduconnect-queue.service',
      '',
      'User activation steps:',
      '1. Log in to the deployed app',
      '2. Open Settings',
      '3. Enable Push Notifications',
      '4. Click Allow when the browser asks for notification permission',
      '',
      'Verification:',
      '1. A row should be created in push_subscriptions',
      '2. GET /notifications/push/vapid-key should return configured=true',
      '3. Trigger a real notification event',
      '4. Confirm the browser receives a push notification while the app is backgrounded',
      '',
      'Common failures:',
      '- HTTPS missing',
      '- VAPID keys missing or invalid',
      '- Browser notification permission denied',
      '- Queue worker not running',
      '- push_subscriptions table missing',
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
doc.text('AWS Lightsail Deployment Guide', margin, y);
y += 20;

doc.setFont('helvetica', 'normal');
doc.setFontSize(11);
const intro = doc.splitTextToSize(
  'This PDF summarizes the full production deployment flow for the SmartEduConnect frontend and Laravel backend on AWS Lightsail using split frontend and API domains.',
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
  doc.setFontSize(10.5);

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
