# Mobile / PWA / QR Check-in — Sprint 9

Module: `src/features/mobile/`

## Layers

| Layer | Path | Role |
|-------|------|------|
| Layout | `layout/MobileBottomNav.jsx`, `MobileDrawer.jsx` | Mobile shell — bottom nav + drawer |
| Hooks | `hooks/useIsMobile.js`, `useOfflineStatus.js`, `usePwaInstall.js` | Responsive + offline + install |
| Offline | `services/offlineCache.js` (IndexedDB), `offlineQueue.js` (localStorage) | Cache read-only data; queue mutations |
| QR | `services/qrTokenService.js` | Opaque token generation/validation |
| Check-in | `services/checkInService.js` | Scan → validate → record + audit |
| Notifications | `services/notificationService.js` | Opt-in push + in-app prefs |
| Pages | `src/pages/mobile/*` | Check-in dashboard, scan, generate, player home |

## PWA

- `vite-plugin-pwa` in `vite.config.js`
- Manifest + service worker auto-generated at build
- `registerSW` in `src/main.jsx`

## SQL

`docs/supabase-mobile-sprint9.sql` — `push_subscriptions`, `notifications`, `qr_tokens`, `checkins`

## Desktop compatibility

- `MainLayout` keeps permanent sidebar on `md+`
- Mobile uses bottom nav; desktop unchanged
- All new routes under `/mobile/*` are additive
