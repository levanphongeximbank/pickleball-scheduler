# CRM Compatibility Map (Phase 1B)

This document classifies the **pre-existing** CRM implementation.  
It does **not** authorize treating localStorage services as canonical CRM repositories.

## Classification legend

| Class | Meaning |
|-------|---------|
| `COMPATIBILITY_ONLY` | Keep operational; not domain SoT; migrate later |
| `LEGACY_TRANSITIONAL` | UI/surface still used; will be rewired in later phases |
| `REUSABLE_UI_PATTERN` | Patterns may be reused; ownership unchanged |
| `EXTERNAL_MODULE_REFERENCE` | Belongs to another module |
| `FUTURE_ADAPTER_CANDIDATE` | Likely wrapped by an adapter when domain lands |

---

## Existing components

| Component | Path | Classification | Notes |
|-----------|------|----------------|-------|
| Message service | `services/crmMessageService.js` | `COMPATIBILITY_ONLY` | LS `pickleball-crm-messages-v1::{clubId}`; mock send |
| Template service | `services/crmTemplateService.js` | `COMPATIBILITY_ONLY` | LS templates |
| Campaign service | `services/crmCampaignService.js` | `COMPATIBILITY_ONLY` | LS campaigns; launch flips status only |
| Contact history service | `services/crmContactHistoryService.js` | `COMPATIBILITY_ONLY` | Manual history; free-text names |
| Messages / templates / campaigns / history pages | `pages/Crm*.jsx` | `LEGACY_TRANSITIONAL` | Not wired to Phase 1B domain |
| Booking reminder page | `pages/CrmBookingReminderPage.jsx` | `EXTERNAL_MODULE_REFERENCE` | Wraps court `BookingNotificationPanel` |
| Customer groups | `features/customer-groups/` | `EXTERNAL_MODULE_REFERENCE` | Venue-adjacent segments; not CRM tags |
| Notifications inbox / delivery | `features/notifications/` | `EXTERNAL_MODULE_REFERENCE` | Delivery SoT; `crm.campaigns` intentionally retained separately |
| Menu “Thông báo” → `/mobile/notifications` | `config/v5Menu/crmMenu.js` | `EXTERNAL_MODULE_REFERENCE` | Cross-link |
| Legacy LS adapter boundary | `adapters/legacyLocalStorageCompat.js` | `FUTURE_ADAPTER_CANDIDATE` | Re-exports + classification; no page behavior change |

---

## Explicit rules

1. Do **not** delete compatibility code in Phase 1B.
2. Do **not** present LS services as `Crm*Repository` implementations.
3. Do **not** use `customer.view` as the canonical permission for future CRM mutations (`crm.*` namespace is the proposal).
4. Campaign **orchestration** may live in CRM later; **delivery** remains Notifications-owned.
5. Menu status for CRM paths is `PARTIAL` (product-readiness correction, not deletion). Routes remain available.

---

## Storage prefixes (legacy)

- `pickleball-crm-messages-v1::`
- `pickleball-crm-templates-v1::`
- `pickleball-crm-campaigns-v1::`
- `pickleball-crm-contact-history-v1::`

These are clubId-keyed browser stores without tenant stamp — known isolation risk deferred to persistence phases.
