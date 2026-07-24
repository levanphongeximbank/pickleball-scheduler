# Customer Management

Canonical customer master-data module for PICK_VN.

| Item | Path |
|------|------|
| Public facade | `src/features/customer/index.js` |
| Architecture | `src/features/customer/ARCHITECTURE.md` |
| Phase 1A docs | `docs/customer-management/phase-1a/` |
| Phase 2 (profile/contact) | `docs/customer-management/phase-2/00_CUSTOMER_02_PROFILE_CONTACT.md` |
| Phase 3 (persistence/runtime) | `docs/customer-management/phase-3/` |

**SoT statement:** Customer Management is the source of truth for customer master data, but not for authentication, player sports profile, CRM workflow, or financial transactions.

**Customer contact information is business master data. It is not an authentication credential and does not prove ownership or verification without trusted external evidence.**

**Customer persistence is durable business master data and must never silently fall back to an in-memory repository in Production.**

**Current phase:** CUSTOMER-03 durable persistence & runtime foundation (SQL authored, not applied; durable adapter + runtime certified against fake DB / static packs).
