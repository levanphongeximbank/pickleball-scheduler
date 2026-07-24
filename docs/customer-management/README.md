# Customer Management

Canonical customer master-data module for PICK_VN.

| Item | Path |
|------|------|
| Public facade | `src/features/customer/index.js` |
| Architecture | `src/features/customer/ARCHITECTURE.md` |
| Phase 1A docs | `docs/customer-management/phase-1a/` |
| Phase 2 (profile/contact) | `docs/customer-management/phase-2/00_CUSTOMER_02_PROFILE_CONTACT.md` |

**SoT statement:** Customer Management is the source of truth for customer master data, but not for authentication, player sports profile, CRM workflow, or financial transactions.

**Customer contact information is business master data. It is not an authentication credential and does not prove ownership or verification without trusted external evidence.**

**Current phase:** CUSTOMER-02 profile & contact foundation (in-memory certification only; persistence deferred).
