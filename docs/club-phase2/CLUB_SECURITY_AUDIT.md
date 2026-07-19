# Club Security Audit — Phase 2A

**Status:** Architecture audit (read-only) — **no SQL or production changes**  
**Sources:** Phase 42C RLS/RPC, Phase 1B/1C security gates, `clubGovernanceService`, governance spec, audit helpers.

---

## 1. Security model overview

Club Storage V2 uses:

1. **RLS for SELECT** on business tables.  
2. **Revoked INSERT/UPDATE/DELETE** for `authenticated` / `anon` on core club tables.  
3. **SECURITY DEFINER RPCs** for all writes.  
4. **Idempotency** (`idempotency_requests`) + **row `version`** checks.  
5. **Audit writes** via `phase42_write_audit`.  
6. **Client mirrors** for UX — **server is authoritative** when V2 is on.

Legacy / V2-OFF paths rely more on client gates + local storage and must not be treated as Production authority.

---

## 2. RLS (V2)

From `docs/v5/PHASE_42C_RLS_RPC.sql` pattern:

| Table family | SELECT | Direct writes |
|--------------|--------|---------------|
| `clubs` | Tenant member, club member, SA, or discoverable active | Revoked → RPC only |
| `club_members` | Scoped membership / tenant / SA | Revoked → RPC only |
| `club_governance_assignments` | Scoped | Revoked → RPC only |
| `club_membership_requests_v42` | Self **or** gov role (owner/president/VP) | Revoked → RPC only |
| `idempotency_requests` | Restricted select | Revoked insert/update/delete for clients |

**Risk if V2 off:** local extension and blob have no server RLS; any XSS/device access sees local club data.

---

## 3. RPC authorization

### 3.1 Primitive helpers

| Helper | Role |
|--------|------|
| `phase42_is_platform_super_admin` | Global break-glass |
| `phase42_is_tenant_member` | Tenant isolation |
| `phase42_active_club_member_id` | Membership proof |
| `phase42_has_gov_role(...)` | Owner / president / VP |
| `phase42_write_audit` | Audit trail |
| Idempotency get/put | Replay safety |

### 3.2 Hardening gates (Phase 1B / 1C)

| Gate | Concern | Intent |
|------|---------|--------|
| `phase42_can_update_club` | `club_update` | Narrow who may mutate club entity |
| `phase42_can_manage_vice_presidents` | VP assign/clear | Gov + elevation rules |
| `phase42_can_assign_club_owner` | `club_assign_owner` / `club_clear_owner` | **SA + tenant_owner only** — not bare `tenant_staff` |

Phase 1C Production evidence pack documents apply/smoke/final rollout under `docs/v5/qa-evidence/phase1c-production/`.

### 3.3 Known historical issue

Live `club_assign_owner` was reported **over-broad** (`tenant_staff`) before Phase 1C gate. Treat gate SQL + evidence as required for Production posture; do not assume older Phase 38–41 bodies.

---

## 4. Role matrix (security view)

See [CLUB_ROLE_MATRIX.md](./CLUB_ROLE_MATRIX.md).

Security-critical distinctions:

- Venue staff ≠ club owner → **summary** members only (privacy).  
- Tournament invite bypass is **scoped exception**, not permanent profile access.  
- SA without governance assignment must not get membership-review UI (Phase 42L).  
- VP cannot delete members/club (client + should match server).

**Gap:** Ensure every client `can*` has a matching server check on the RPC path (especially member remove, leave, review).

---

## 5. Version conflict

| Mechanism | Purpose |
|-----------|---------|
| `clubs.version` / member row versions | Optimistic concurrency |
| RPC expected-version arguments | Reject stale writers |
| Idempotency keys | Safe retries |

**Client:** `clubCommandErrorMap` should surface conflict codes consistently (verify UX coverage in Phase 2B).

**Risk:** Local offline adapters can diverge from cloud version until sync — V2-ON must block silent local success after RPC failure (`clubLegacyWriteGuard` / 45A.3F).

---

## 6. Audit logging

| Path | Behavior |
|------|----------|
| V2 RPCs | `phase42_write_audit` on command paths |
| Identity | Separate `audit_logs` / identity admin RPCs |
| Local-only mutations | Weak / none |

**Gaps:** Whitelist completeness for new RPCs; correlation IDs across client retries; governance transfer audit readability for operators.

Phase 1B docs reference audit whitelist work for update/VP paths — keep whitelist in sync when adding Phase 2 commands.

---

## 7. Multi-tenant isolation

| Control | Status |
|---------|--------|
| `tenant_id` / `venue_id` on clubs | Present |
| `phase42_is_tenant_member` in RPC | Present |
| `guardClubTenant` client | Present |
| Registry scopes (tenant vs platform) | `clubRegistryService` asserts |
| Discoverable clubs | Controlled SELECT for active discoverable |

**Risks**

1. `tenantId` vs `venueId` aliasing in UI/services — mis-scope if confused.  
2. Platform athlete / “platform-wide” player listing must not leak PII across tenants.  
3. Blob `club_data_v3` historical RLS (`supabase-club-v3-rls.sql`) is a **separate** generation from V2 — dual cloud stores increase isolation review surface.  
4. Finance/ledger keyed by `clubId` alone can cross-confuse tenant boundaries if club IDs are ever reused or mis-bound.

---

## 8. Threat scenarios (brief)

| Scenario | Mitigation today | Residual |
|----------|------------------|----------|
| Venue manager scrapes all club athletes | Summary-only + RPC list guards | Client bugs; invite wizard abuse |
| Tenant staff assigns club owner | Phase 1C gate | Ensure Production applied |
| Stale UI overwrites club name | Version + idempotency | Offline path |
| Player elevates without gov row | Elevation requires president/VP assignment | Local governance drift if V2 off |
| Direct table write | Revoked under V2 | Legacy tables if still exposed |
| Join request spam | RPC + status machine | Rate limit / abuse not audited here |

---

## 9. Security rating by area

| Area | Score /10 | Notes |
|------|-----------|-------|
| V2 RLS + RPC write lock | 8 | Strong pattern |
| Owner assign authz | 7–8 | After 1C gate |
| Club update authz | 7 | After 1B gate |
| Membership privacy (venue vs owner) | 7 | Spec clear; keep tests |
| Dual-stack / local | 4 | Weak when V2 off |
| Audit completeness | 6 | Present; whitelist discipline needed |
| Cross-module blob isolation | 4 | Shared mega-store |

**Overall security posture (V2 Production assumed): ~7 / 10**  
**Overall if dual-stack still writable in Production: ~5 / 10**

---

## 10. Recommendations (docs / future phases only)

1. Maintain a living **RPC authz matrix** (role × RPC × helper).  
2. After any new membership/governance RPC, extend Phase 1B-style static verify + smoke.  
3. Treat V2-OFF as non-Production for multi-tenant deployments.  
4. Privacy review of platform athlete listing and tournament invite export.  
5. Confirm Production 1C gate remains applied before Phase 2 expands owner UX.  
6. No SQL in Phase 2A — schedule security SQL only in later gated phases with Owner GO.
