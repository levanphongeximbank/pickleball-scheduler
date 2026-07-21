# 01 — CRM Current-State Audit (Phase 1A)

**Phase:** 1A — Current-state audit & foundation design  
**Status:** Official (owner-approved with conditions)  
**Date:** 2026-07-21  
**Branch baseline:** `feature/crm-phase-1-foundation`

---

## Executive summary

Existing CRM under `src/features/crm/` is a **localStorage messaging/campaign compatibility shell** (~25–30% of that shell). It is **not** a Production-ready CRM and **not** the canonical CRM domain.

**Absent:** Lead, opportunity, pipeline, ContactReference domain, CRM-specific permissions, SQL/RLS, tenant-stamped durable store.

**Adjacent but not CRM-owned:** Venue customers (`src/models/customer.js`, court management UI, club blob `customers[]`), Player Management, Club membership, Finance ledger, Notifications delivery/inbox.

---

## Inventory (at audit time)

### CRM module (9 files)

| Path | Role | Maturity |
|------|------|----------|
| `services/crmMessageService.js` | LS messages | Mock / partial |
| `services/crmTemplateService.js` | LS templates | Partial |
| `services/crmCampaignService.js` | LS campaigns; launch status flip | Stub |
| `services/crmContactHistoryService.js` | LS manual history | Partial |
| `pages/CrmMessagesPage.jsx` | UI mock send | Partial |
| `pages/CrmTemplatesPage.jsx` | Template UI | Partial |
| `pages/CrmCampaignsPage.jsx` | Campaign UI | Stub |
| `pages/CrmContactHistoryPage.jsx` | History UI | Partial |
| `pages/CrmBookingReminderPage.jsx` | Court reminder wrapper | External reuse |

Missing vs mature modules: `index.js`, `ARCHITECTURE.md`, models, contracts, repositories, auth foundation, SQL.

### Routes / menu

- `/crm/messages`, `/crm/templates`, `/crm/campaigns`, `/crm/history`, `/crm/reminders/booking`
- Menu previously marked `FEATURE_STATUS.LIVE` — **overstated** maturity

### Permissions

- Only `customer.view|create|update|delete` (VENUE scope)
- No `crm.*` keys; CRM write UIs gated on `CUSTOMER_VIEW`

### SQL / Supabase

- **No** CRM tables, RPCs, or migrations
- Customers persist in `club_data_v3` blob, not a customers table

---

## Findings

1. Existing CRM pages are **compatibility surfaces**, not canonical domain.
2. Lead / opportunity / pipeline foundations are **absent**.
3. Venue Customer remains customer SoT; Player remains player SoT; Club remains membership SoT; Finance remains money SoT; Notifications remains delivery/inbox SoT.
4. CRM should own relationship lifecycle and sales-operation concepts only.
5. Dual/triple risks: debt (booking vs finance-ledger), comms (CRM LS vs notifications vs booking reminders), free-text identity references.

---

## Maturity estimate (Phase 1A)

| Lens | Estimate |
|------|----------|
| Canonical CRM toward target architecture | ~18–22% |
| Messaging shell only | ~25–30% |
| Venue customer ops (not CRM-owned) | ~70–80% |

**Do not claim the current CRM is Production-ready.**

---

## Owner decision

Phase 1A approved with conditions. Proceed to Phase 1B: domain contracts, module skeleton, compatibility foundation.
