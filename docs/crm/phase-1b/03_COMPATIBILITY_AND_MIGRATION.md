# 03 — Compatibility and Migration (Phase 1B)

**Status:** Official

---

## Strategy

1. Keep existing CRM pages and localStorage services **operational**.
2. Classify them in `src/features/crm/COMPATIBILITY.md`.
3. Introduce `adapters/legacyLocalStorageCompat.js` as an explicit boundary without changing page behavior.
4. Build canonical domain **alongside** legacy surfaces.
5. Migrate UI in Phase 1J; do not rewrite pages in 1B.

## Menu readiness correction

CRM route menu items changed from `LIVE` → `PARTIAL` (existing enum; no BETA).  
Routes remain registered. Badge: “Một phần”.  
This is a **product-readiness correction**, not a feature deletion.

## Migration direction (future)

```text
Legacy LS services  →  adapters  →  domain services  →  durable repositories
Notifications       ←  NotificationEmitPort (delivery)
Venue customers     ←  VenueCustomerDirectoryPort (read)
```
