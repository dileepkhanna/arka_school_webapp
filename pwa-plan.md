# SmartEduConnect — PWA Plan

## Current State

This app is **already a PWA** with the following already implemented:

| Feature | Status |
|---------|--------|
| `vite-plugin-pwa` with Workbox | ✅ Done |
| Web App Manifest (name, icons, theme) | ✅ Done |
| Service Worker (auto-update) | ✅ Done |
| Push Notifications (VAPID + sw-push.js) | ✅ Done |
| Install Banner (Android + iOS instructions) | ✅ Done |
| Standalone display mode | ✅ Done |
| Portrait orientation lock | ✅ Done |
| Static asset caching (JS/CSS/HTML/images) | ✅ Done |

**What this plan covers:** gaps, improvements, and production hardening needed to make the PWA fully production-ready.

---

## 1. What's Missing / Needs Fixing

### 1.1 PWA Icons — Missing Files

The manifest references `pwa-192x192.png` and `pwa-512x512.png` but these files need to be properly generated from the school logo.

**Fix:** Generate proper icons from `ase-logo.jpg`:

```bash
# Install sharp-cli or use https://realfavicongenerator.net
npx pwa-asset-generator ase-logo.jpg public/ \
  --icon-only --favicon --manifest public/manifest.json \
  --index index.html
```

Required files in `public/`:
```
public/
  favicon.ico           ✅ exists
  pwa-192x192.png       ⚠️  needs proper generation
  pwa-512x512.png       ⚠️  needs proper generation
  apple-touch-icon.png  ❌ missing (180x180, needed for iOS)
  pwa-maskable.png      ❌ missing (512x512 with safe zone padding)
```

### 1.2 Manifest — Missing Fields

Add missing manifest fields for better installability:

```ts
// vite.config.ts — manifest additions
manifest: {
  // ... existing fields ...
  categories: ['education', 'productivity'],
  lang: 'en',
  dir: 'ltr',
  screenshots: [           // ❌ missing — improves Play Store listing
    {
      src: 'screenshot-mobile.png',
      sizes: '390x844',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'SmartEduConnect Dashboard'
    }
  ],
  shortcuts: [             // ❌ missing — quick actions from home screen
    {
      name: 'Dashboard',
      url: '/admin',
      icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
    },
    {
      name: 'Attendance',
      url: '/admin/attendance',
      icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
    }
  ]
}
```

### 1.3 Offline Support — Not Implemented

Currently the app has no offline fallback. When the network is unavailable, users see a blank screen.

**Fix:** Add offline page + API caching strategy:

```ts
// vite.config.ts — workbox runtimeCaching additions
runtimeCaching: [
  // Cache API responses (read-only data)
  {
    urlPattern: /^\/(holidays|classes|subjects|dashboard)/,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 24h
    },
  },
  // Cache S3 images
  {
    urlPattern: /^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 's3-images',
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
    },
  },
  // Cache Google Fonts (if used)
  {
    urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts',
      expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
],
```

**Add offline fallback page:**

```tsx
// src/pages/Offline.tsx
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">You're offline</h1>
      <p className="text-muted-foreground">Check your connection and try again.</p>
      <Button onClick={() => window.location.reload()}>Retry</Button>
    </div>
  );
}
```

```ts
// vite.config.ts
workbox: {
  navigateFallback: '/offline.html',  // add this
  // ...
}
```

### 1.4 Maskable Icon — Wrong Configuration

Current config uses the same icon for both `any` and `maskable` purposes. Maskable icons need padding (safe zone = inner 80% of the icon).

```ts
// Fix in vite.config.ts
icons: [
  { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
  { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
  { src: 'pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  // ↑ separate maskable icon with padding, not the same file
]
```

### 1.5 Apple/iOS PWA Meta Tags — Missing

iOS Safari doesn't use the manifest for some PWA features. Add to `index.html`:

```html
<!-- index.html <head> -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="SmartEduConnect" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- Splash screens for iOS (optional but improves UX) -->
<link rel="apple-touch-startup-image" href="/splash-1125x2436.png"
  media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
```

### 1.6 Background Sync — Not Implemented

When a user submits attendance or a form while offline, it should queue and sync when back online.

```ts
// src/lib/backgroundSync.ts
export async function registerBackgroundSync(tag: string) {
  const reg = await navigator.serviceWorker.ready;
  if ('sync' in reg) {
    await (reg as any).sync.register(tag);
  }
}
```

```js
// public/sw-push.js — add sync handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncPendingAttendance());
  }
});
```

---

## 2. Production Checklist

### 2.1 HTTPS Requirement
PWAs require HTTPS in production. Ensure:
- [ ] SSL certificate on the server (Let's Encrypt / Hostinger SSL)
- [ ] `.htaccess` redirects HTTP → HTTPS
- [ ] `HSTS` header set

### 2.2 Lighthouse PWA Audit Targets

Run `npx lighthouse https://your-domain.com --view` and target:

| Metric | Target |
|--------|--------|
| PWA installable | ✅ Pass |
| Service worker | ✅ Pass |
| Offline response | ✅ Pass |
| HTTPS | ✅ Pass |
| Performance score | ≥ 80 |
| Accessibility score | ≥ 90 |

### 2.3 Performance Optimizations

```ts
// vite.config.ts — add build optimizations
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        pdf: ['jspdf', 'jspdf-autotable'],
        charts: ['recharts'],
      }
    }
  }
}
```

---

## 3. Implementation Tasks

### Phase 1 — Icons & Manifest (Day 1)
- [ ] Generate `pwa-192x192.png` from `ase-logo.jpg` (proper padding)
- [ ] Generate `pwa-512x512.png`
- [ ] Generate `pwa-maskable.png` (512x512 with safe zone)
- [ ] Generate `apple-touch-icon.png` (180x180)
- [ ] Add iOS meta tags to `index.html`
- [ ] Add `shortcuts` to manifest
- [ ] Add `screenshots` to manifest
- [ ] Fix maskable icon config in `vite.config.ts`

### Phase 2 — Offline Support (Day 2-3)
- [ ] Create `src/pages/Offline.tsx` offline fallback page
- [ ] Add `navigateFallback` to workbox config
- [ ] Add API runtime caching for read-only endpoints
- [ ] Add S3 image caching strategy
- [ ] Test offline behavior in Chrome DevTools → Network → Offline

### Phase 3 — Push Notifications (Day 4)
- [ ] Verify VAPID keys are set in backend `.env`
- [ ] Test push subscription flow end-to-end
- [ ] Test push delivery from backend
- [ ] Test notification click → navigate to correct route
- [ ] Handle notification permission denied state gracefully

### Phase 4 — Install Experience (Day 5)
- [ ] Test `InstallAppBanner` on Android Chrome
- [ ] Test iOS "Add to Home Screen" instructions
- [ ] Add install prompt to Settings page as fallback
- [ ] Verify `display: standalone` hides browser UI after install

### Phase 5 — Performance & Audit (Day 6-7)
- [ ] Run Lighthouse audit on production build
- [ ] Add code splitting for PDF/chart libraries
- [ ] Verify service worker updates correctly (no stale cache)
- [ ] Test on low-end Android device
- [ ] Test on iOS Safari

---

## 4. File Changes Summary

| File | Change |
|------|--------|
| `vite.config.ts` | Add maskable icon fix, shortcuts, screenshots, offline fallback, API caching |
| `index.html` | Add Apple PWA meta tags |
| `src/pages/Offline.tsx` | New offline fallback page |
| `public/pwa-192x192.png` | Regenerate with proper icon |
| `public/pwa-512x512.png` | Regenerate with proper icon |
| `public/pwa-maskable.png` | New — maskable icon with padding |
| `public/apple-touch-icon.png` | New — 180x180 for iOS |

---

## 5. Testing PWA Features

```bash
# Build production version
npm run build

# Preview production build locally
npm run preview

# Run Lighthouse audit
npx lighthouse http://localhost:4173 --view

# Test service worker in Chrome
# DevTools → Application → Service Workers
# DevTools → Application → Cache Storage
# DevTools → Network → check "Offline" → reload page
```

---

## 6. Current PWA Score Estimate

| Category | Current | After Plan |
|----------|---------|------------|
| Installable | ✅ | ✅ |
| Offline support | ❌ | ✅ |
| iOS compatibility | ⚠️ Partial | ✅ |
| Maskable icon | ⚠️ Wrong | ✅ |
| Push notifications | ✅ | ✅ |
| App shortcuts | ❌ | ✅ |
| Background sync | ❌ | ✅ |
| Lighthouse PWA | ~70 | ~95 |
