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
| Phase 5 (Identity/Player/CRM linking) | `docs/customer-management/phase-5/` |
| Phase 6 (search/dedup/merge) | `docs/customer-management/phase-6/` |
| Phase 7 (Staging apply & live certification) | `docs/customer-management/phase-7/` |

**SoT statement:** Customer Management is the source of truth for customer master data, but not for authentication, player sports profile, CRM workflow, or financial transactions.

**Customer Management owns the customer-side linkage record, but Identity, Player Management and CRM remain the source of truth for their own entities.**

**Matching email, phone or name is not sufficient evidence to create a canonical Customer linkage or to auto-merge Customers.**

**Customer contact information is business master data. It is not an authentication credential and does not prove ownership or verification without trusted external evidence.**

**Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.**

**Customer Management stores consent and communication preference facts. It does not independently determine legal permission when Platform Governance policy input is required.**

**Notification may consume communication eligibility but must not mutate Customer consent state directly.**

**Merge requires explicit approval. Duplicate signals are candidate evidence only.**

**Current phase:** CUSTOMER-07 Staging Apply & Live Integration Certification (CUSTOMER-03→06 Staging apply + live cert).
