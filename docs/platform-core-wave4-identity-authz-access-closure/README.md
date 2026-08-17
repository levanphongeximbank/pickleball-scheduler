# Wave 4 — Identity / Authz / Access Canonical Closure

Owner lock: `OWNER_ARCHITECTURE_LOCK_WAVE4=GO`.
Architecture amendment: `OWNER_ARCHITECTURE_AMENDMENT_WAVE4=GO`.

Wave 3 remains closed. This folder documents the **local application implementation** of PC-AUTH-01 and PC-ACCESS-01. It is **not** a live closure.

- `ARCHITECTURE_DECISIONS.md`
- `AUTHORITY_MATRIX.md`
- `LEGACY_DISPOSITION.md`
- `LIVE_AUTHORITY_PREREQUISITES.md`
- `STAGING_ACCEPTANCE_CHECKLIST.md`
- `PRODUCTION_CUTOVER_PREREQUISITES.md`
- `staging-remediation/` — **authored** Staging SQL/RLS package. **Not executed.**

`tenant_members` is Tenant **operational entitlement**, not universal account membership.

No SQL/RLS/schema was executed in this pass. `OWNER_GO_MERGE=NO`.
