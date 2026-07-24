# Customer Management

Canonical customer master-data module for PICK_VN.

| Item | Path |
|------|------|
| Public facade | `src/features/customer/index.js` |
| Architecture | `src/features/customer/ARCHITECTURE.md` |
| Phase 1A docs | `docs/customer-management/phase-1a/` |
| Phase 2 (profile/contact) | `docs/customer-management/phase-2/00_CUSTOMER_02_PROFILE_CONTACT.md` |
| Phase 3 (persistence/runtime) | `docs/customer-management/phase-3/` |
| Phase 4 (consent/preferences) | `docs/customer-management/phase-4/` |

**SoT statement:** Customer Management is the source of truth for customer master data, but not for authentication, player sports profile, CRM workflow, or financial transactions.

**Customer contact information is business master data. It is not an authentication credential and does not prove ownership or verification without trusted external evidence.**

**Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.**

**Customer Management stores consent and communication preference facts. It does not independently determine legal permission when Platform Governance policy input is required.**

**Notification may consume communication eligibility but must not mutate Customer consent state directly.**

**Current phase:** CUSTOMER-04 Consent & Communication Preferences (SQL authored, not applied; domain + adapters + durable fake-DB certified).
