# Phase 1J — Risk and Dependency Register

**Owner decision:** `APPROVE_PHASE_1J_SCOPE`  
**Branch:** `feature/player-phase-1j`  
**Base `origin/main` SHA:** `5f702da575d9e9c176a8faf5742f27bdb7d74129`  
**Classification:** Candidate A — Production Directory Operational Hardening  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

---

## 1. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Phase 1I directory UI + facades | Required | Must remain on `main` |
| Phase 1I-B RPCs on Staging | Required for 1J-A/B | Already validated historically |
| Phase 1I-B RPCs on Production | Required for 1J-C | Applied under Owner Production apply tokens |
| Phase 1E profile columns | Required | Eligibility/privacy fields |
| Phase 1H verification | Required | Verified-only eligibility |
| Phase 1G privacy toggles | Required | `publicProfileEnabled` / show* flags |
| Owner Staging write token | Required for 1J-A | Not granted by scope freeze |
| Owner Production browser smoke token | Required for 1J-C | Read-only |
| Test accounts (PLAYER / non-PLAYER / president) | Required for full 1J-C | Else mark NOT VERIFIED |

---

## 2. Risk register

| ID | Risk | Severity | Likelihood | Mitigation | Residual |
|----|------|----------|------------|------------|----------|
| R1 | Empty eligible set mistaken for SQL/apply failure | Med | High without docs | Freeze empty-state as valid; fixture pack | Low after 1J-A |
| R2 | Production fixture seeding leaks QA data | High | Med if mis-authorized | Default Staging-only; forbid Prod writes | Low |
| R3 | Scope creep into anonymous/admin/legacy | High | Med | Hard out-of-scope + `REVISE_SCOPE` | Low |
| R4 | CRM “Phase 1J” naming collision | Med | Med | Explicit disambiguation in freeze | Low |
| R5 | Privacy live evidence skipped | Med | Med | Prefer 1J-A before claiming masking proof | Med if Owner skips fixtures |
| R6 | Browser smoke incomplete (no accounts) | Med | High | Record NOT VERIFIED cells; do not invent PASS | Med |
| R7 | Optional index apply without Staging | Med | Low | Separate 1J-E SQL gates | Low |
| R8 | Accidental Directory DTO expansion | High | Low | Contract freeze + tests | Low |
| R9 | Fixture irreversibility on Staging | Med | Low | QA labels + reverse runbook | Low |
| R10 | Concurrent unrelated `main` advances | Low | High | Re-baseline before each authorize | Low |

---

## 3. Stop conditions

Return **BLOCKED** / do not proceed to a sub-phase if:

1. Owner token for that sub-phase is missing.  
2. Target project ref is wrong (Staging vs Production).  
3. Proposed work expands DTO, adds anonymous directory, or seeds Production without write token.  
4. Work is actually CRM UI migration labeled as PM 1J.  
5. Required 1I-B RPCs are missing on the target environment for that sub-phase.  
6. Implementation is attempted under 1J-0 docs-only authorize.

---

## 4. Rollback / recovery posture

| Concern | Posture |
|---------|---------|
| 1J-0 docs | Revert docs PR |
| Staging fixtures | Reverse/delete QA fixtures via Staging-only runbook |
| Production browser smoke | N/A (read-only) |
| 1J-D UI fix | Standard git revert |
| 1J-E indexes | Dedicated rollback SQL + Owner rollback token |

---

## 5. Acceptance for residual empty-set risk

If Owner **skips** 1J-A/B:

- Closure must state: live privacy sampling remains **limited**.  
- Unit/contract tests remain primary privacy evidence.  
- Empty Production directory remains **accepted** until eligible public athletes exist organically or fixtures are later authorized.

---

## 6. Exact Owner action next

1. Commit/merge Phase 1J-0 package.  
2. Choose: authorize Staging fixtures (**preferred**) or accept empty-set residual risk in writing before 1J-C.
