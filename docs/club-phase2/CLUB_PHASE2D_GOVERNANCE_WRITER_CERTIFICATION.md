# Club Phase 2D — Governance Writer Certification

**Status:** Implementation complete + Staging SQL applied (Production withheld)  
**Date:** 2026-07-19  
**Branch:** `feature/club-phase-2d-governance-writer-certification`  
**Base:** `origin/main` @ `5ba2f427f287628c0cb5ce61b47de9c4045a7939`  
**Charter:** Phase 2B API freeze §7 · Phase 2 sequence §2D  
**Does not reopen:** Phase 2C membership certification

---

## 1. Scope delivered

| Item | Result |
|------|--------|
| Freeze ports `governance.*` | ✅ `src/features/club/api/governanceApi.js` |
| Audit freeze aliases | ✅ `governanceAuditEvents.js` |
| Single writer under V2 ON | ✅ Service → RPC; blob role write gated |
| Clear president = transfer-only | ✅ `clearClubPresident` / `governance.clearPresident` |
| Barrel boundary (no raw gov RPCs) | ✅ Removed from `features/club/index.js` |
| President authz SQL (narrow) | ✅ Authored Staging-first (not Production) |
| Membership / Invite / Captain | ✅ Untouched |

---

## 2. Writer inventory (Production-reachable)

| Symbol | File | Class | Notes |
|--------|------|-------|-------|
| `assignClubOwner` | `clubGovernanceService.js` | **CANONICAL_WRITER** | → `club_assign_owner` / `club_clear_owner` |
| `transferClubOwnership` | same | **CANONICAL_WRITER** | → `club_assign_owner` |
| `transferClubPresident` | same | **CANONICAL_WRITER** | → `club_transfer_president` |
| `setClubVicePresidents` / `assignClubVicePresident` | same | **CANONICAL_WRITER** | → VP assign/clear RPCs |
| `clearClubPresident` | same | **CANONICAL_WRITER** (policy) | Deny under V2 |
| `governance.*` API | `api/governanceApi.js` | **CANONICAL_WRITER** façade | Freeze names |
| `rpcV2ClubAssign*` / Clear / Transfer | `clubStorageV2RpcService.js` | **INTERNAL_HELPER** | Not barrel-exported |
| `updateClubGovernance` (owner/pres/VP) | `clubGovernanceService.js` | **LEGACY_WRITER** | **Blocked under V2** |
| `updateClubMeta` governance patch | `domain/clubService.js` | **LEGACY_WRITER** | Via updateClubGovernance only for roles |
| Client `writeAuditLog` after RPC | service | **DUPLICATE_WRITER** (UX) | Server `phase42_write_audit` is SoT |
| `phase42_can_assign_club_owner` | SQL 1C | **INTERNAL_HELPER** | Owner assign/clear |
| `phase42_can_manage_vice_presidents` | SQL 1B | **INTERNAL_HELPER** | VP |
| `phase42_can_transfer_president` | SQL 2D (new) | **INTERNAL_HELPER** | President transfer |

**UI entry points:** `ClubGovernancePanel`, `MyClubGovernancePanel`, `AssignClubOwnerDialog` → service / freeze API (not raw RPC).

---

## 3. Authorization matrix (fail-closed)

| Actor | Assign/clear owner | Transfer president | Assign/clear VP |
|-------|--------------------|--------------------|-----------------|
| Platform / Super Admin | ✅ | ✅ | ✅ |
| Tenant owner | ✅ (`phase42_can_assign_club_owner`) | ✅ (after 2D SQL) | ✅ |
| Club owner | ❌ assign (1C); ✅ transfer UI if also tenant assigner | ✅ | ✅ |
| President | ❌ | ✅ (self-relinquish + transfer) | ✅ |
| Vice president | ❌ | ❌ | ❌ |
| Club manager | ❌ | ❌ | ❌ |
| Regular member | ❌ | ❌ | ❌ |
| Non-member / cross-tenant | ❌ | ❌ | ❌ |

Server final authz; client helpers are visibility only.

---

## 4. Eligibility

- Target must exist as **active** `club_members` row (`MEMBER_REQUIRED` otherwise).
- Left / removed / pending / invited → ineligible.
- Cross-club membership does not grant eligibility.
- Owner uniqueness: end prior `club_owner` before insert.
- VP max **2**; cannot duplicate president.
- `profiles.club_id` is **not** used for eligibility.

---

## 5. Single-writer / OCC / idempotency / audit

```text
UI / governance.* API
  → clubGovernanceService
    → clubStorageV2RpcService (SECURITY DEFINER RPCs)
      → club_governance_assignments + clubs.version++
      → phase42_write_audit + phase42_idempotency_*
```

| Concern | Contract |
|---------|----------|
| OCC | `expectedClubVersion` / `p_expected_club_version`; mismatch → `VERSION_CONFLICT` → client `CONFLICT` |
| Success | `clubs.version = version + 1` |
| Idempotency | `p_request_id` + `phase42_idempotency_get/put`; replay returns cached, no second audit |
| Audit (server) | `club.assign_owner`, `club.clear_owner`, `club.transfer_president`, `club.assign_vice_president`, `club.clear_vice_president` |
| Freeze aliases | `governance.*` ↔ server names in `governanceAuditEvents.js` |
| Failures | No audit row before successful mutate |

---

## 6. Security findings

| ID | Finding | Status |
|----|---------|--------|
| S-2D-1 | `club_transfer_president` used bare `phase42_is_tenant_member` | **Mitigated by** `PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` (Staging apply required) |
| S-2D-2 | Blob `updateClubGovernance` role writes under V2 | **Mitigated** — `assertLegacyGovernanceRoleWriteAllowed` |
| S-2D-3 | Raw governance RPCs on Club barrel | **Mitigated** — removed from barrel |
| S-2D-4 | DEFINER `search_path = public` | Verified in SQL sources |
| S-2D-5 | Client audit after RPC | Documented non-SoT; server remains authoritative |

---

## 7. Tests

| Suite | Purpose |
|-------|---------|
| `tests/club-phase-2d-governance-writer.test.js` | Authz, clear policy, legacy block, barrel, SQL, aliases |
| Existing 1B/1C / governance suites | Regression |

---

## 8. SQL

| File | Env | Status |
|------|-----|--------|
| `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` | Staging `qyewbxjsiiyufanzcjcq` | **APPLIED** 2026-07-19T15:50:44.214Z · checksum `ea0b3bc6dcead6c749d2562f27f5675ab9ad760e7815a823d4ad273e79c819d8` · evidence `docs/v5/qa-evidence/phase2d-staging/` |
| `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_ROLLBACK.sql` | Staging | Rollback available |
| Production | — | **NOT APPLIED** |

---

## 9. Rollback

1. Flag `VITE_CLUB_STORAGE_V2=false` → legacy blob writers (non-Prod).  
2. Code revert branch.  
3. Staging SQL: apply rollback file if gate was applied.

---

## 10. Explicit non-goals

- Phase 2E Invitation / Captain / Coach  
- Membership lifecycle (2C closed)  
- Production SQL / Production deploy  
- Registered-cluster cloud SoT (out of governance role scope)
