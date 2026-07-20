# Phase 1I — Risk and Dependency Register

**Owner decision:** `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES`  
**Branch:** `feature/player-phase-1i-public-directory-discovery`  
**Base `origin/main` SHA:** `0c37f1dfb152c24a9b9eccde5b0d1b3180773d7d`  
**Discovery date:** 2026-07-20 (UTC+7)  
**Remediation date:** 2026-07-20 (UTC+7)  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

---

## 1. Dependency matrix

| Dependency | Status | Impact on 1I |
|------------|--------|--------------|
| Phase 1E Production foundation | **READY** | Privacy + verification columns exist |
| Phase 1F public projector + search | **PARTIAL** | Policy reusable; Directory DTO + durable repo missing |
| Phase 1G privacy self-edit | **READY** | Opt-in via `publicProfileEnabled` |
| Phase 1H verification workflow | **PARTIAL** | Status ready; Directory `isVerified` in 1I-A |
| Club Management | **DEFERRED** | Excluded from DTO |
| Rating module | **DEFERRED** | Excluded from DTO |
| Competition Engine | **DEFERRED** | No history |
| Production RLS directory read | **BLOCKING** until **1I-B** | Durable authenticated read required |

---

## 2. Risk register

| ID | Risk | Severity | Likelihood | Mitigation | Residual |
|----|------|----------|------------|------------|----------|
| R1 | Shipping without durable 1I-B read | High | Medium | Gate UI behind 1I-B for Staging truth | Blocked if skipped |
| R2 | Leaking phone/email/birth via general public projector | High | High if mis-wired | Strict Directory DTO; tests | Low if enforced |
| R3 | Returning `visible` / hide reasons to UI enables probing | Medium | Medium | Filter before return; generic not-found | Low |
| R4 | Club/venue fields leak tenant participation | High | Medium if included | Absolute exclude (Owner freeze) | Low |
| R5 | Scraping under authenticated-first | Medium | Medium | Caps, rate limits, no export (1I-E) | Residual |
| R6 | UI direct Supabase | High | Medium | Facade-only + tests | Legacy modules remain |
| R7 | Anon grants creep into 1I-B | High | Low if gated | Explicit forbid in freeze + SQL review | Owner vigilance |
| R8 | Browser service-role | Critical | Low | Forbidden | Process |
| R9 | `/players` route collision | Medium | Low | Frozen `/athletes` | Low |
| R10 | SEO expectations | Low | High | Deferred | Accepted |
| R11 | Inactive profiles included if contract ambiguous | Medium | Medium | Exclude only when existing contract is clear; no schema invent | Owner confirm in 1I-A |

---

## 3. RLS / SQL classification

| Path | Classification |
|------|----------------|
| This documentation remediation | `NO_SQL_EXPECTED` (no SQL authored/applied) |
| Platform authenticated directory (approved MVP) | **`SQL_REQUIRED`** via **1I-B** |
| Anonymous platform directory | **Deferred**; would also be `SQL_REQUIRED` later — **no anon table grants** |

**Forbidden:** anonymous table access; browser service-role.

---

## 4. Owner-approved scope summary (consistency anchor)

| Item | Value |
|------|-------|
| Access | Hybrid; authenticated-first MVP; anon deferred |
| Routes | `/athletes`, `/athletes/:playerId` |
| Eligibility | `publicProfileEnabled` + `verified` (+ safe inactive exclusion) |
| DTO | `playerId`, `displayName`, `avatarUrl?`, `isVerified`, `activityRegion?`, `gender?`, `handedness?` |
| No UI `visible` field | Filter non-eligible before return |
| Rating | EXCLUDED / DEFERRED |
| Club | EXCLUDED / DEFERRED |
| SEO | DEFERRED |
| Sub-phases | 1I-0 → 1I-A → 1I-B → 1I-C → 1I-D → 1I-E → 1I-F |

---

## 5. Abuse / scraping controls (implement in later sub-phases; QA in 1I-E)

1. Authenticated-first access  
2. Page size hard cap  
3. Max page/cursor depth  
4. Search rate limiting  
5. Generic not-found on detail  
6. No export endpoints  
7. No contact/birth/club/venue/rating fields  
8. No `visible`/hide-reason probing surface  

---

## 6. Remaining Owner decisions

| # | Decision | Blocks |
|---|----------|--------|
| 1 | Authorize **1I-0** SQL/read-model design | 1I-B authoring |
| 2 | Separately authorize **1I-B** Staging SQL apply | Real Staging directory data |
| 3 | Confirm inactive/ineligible exclusion using **existing** fields only | 1I-A eligibility edge cases |
| 4 | Authorize **1I-A** implementation start after freeze commit | App work |
| 5 | **1I-F** separate Production rollout | Deploy |

Scope-freeze **commit** of these five docs does **not** require items 1–5 above.

---

## 7. MVP / document verdicts

| Verdict | Value |
|---------|--------|
| Owner scope | `APPROVE_PHASE_1I_SCOPE_WITH_CHANGES` |
| Document package | `READY_FOR_SCOPE_FREEZE_COMMIT` |

---

## 8. Confirmations (this remediation)

| Item | Confirmation |
|------|--------------|
| Files updated | Only `docs/player-management/phase-1i/00`–`04` |
| Source / UI / routes / APIs | **None** |
| SQL / schema / Supabase mutation | **None** |
| Deploy / commit / push / PR | **None** (stop before commit) |
