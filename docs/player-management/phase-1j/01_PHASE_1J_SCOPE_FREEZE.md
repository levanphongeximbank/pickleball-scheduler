# Phase 1J — Scope Freeze

**Owner decision:** `APPROVE_PHASE_1J_SCOPE`  
**Document status:** Owner-approved scope freeze (documentation only)  
**Branch:** `feature/player-phase-1j`  
**Base `origin/main` SHA:** `5f702da575d9e9c176a8faf5742f27bdb7d74129`  
**Freeze date:** 2026-07-21 (UTC+7)  
**Classification:** **A — Production Directory Operational Hardening**  
**Prerequisite:** Phase 1I closed; Phase 1I-B Production directory SQL applied under separate Owner tokens  
**Document verdict:** `READY_FOR_SCOPE_FREEZE_COMMIT`

This document freezes product/technical scope for **Player Management Phase 1J**. It does **not** authorize Staging fixture writes, Production writes, SQL apply, deploy, or implementation code.

---

## 1. Frozen product intent

Make the authenticated Public Player Directory **operationally provable** after Phase 1I:

1. Staging can demonstrate **eligible public rows** and privacy masking with Owner-authorized fixtures.  
2. Production browser access matrix can be executed **read-only** and recorded.  
3. Empty eligible directory remains a **valid product state**, not treated as an RPC/apply failure.  
4. Optional search-index polish remains a **separately gated** SQL sub-phase.

Do **not** expand directory product scope (DTO, anonymous access, social, rating, club participation).

---

## 2. Classification (frozen)

| Option | Role in Phase 1J |
|--------|------------------|
| **A. Production directory operational hardening** | **Primary — selected** |
| B. Verification ops UX polish | **Deferred** |
| C. Self-profile polish | **Deferred** (requires `REVISE_SCOPE` to include) |
| D. Anonymous / hybrid PublicLayout directory | **Deferred** |
| E. Full Admin Player Management | **Deferred** |
| F. Legacy dossier / club-blob cutover | **Deferred** |
| G. Duplicate link / merge tooling | **Deferred** |
| H. Self-service verification | **Deferred** |
| CRM “Phase 1J” UI migration | **Out of workstream** — not Player Management 1J |

**Hard rule:** Do **not** expand into deferred options without Owner `REVISE_SCOPE`.

---

## 3. IN SCOPE (Candidate A)

### 3.1 Operational evidence

| Item | Frozen |
|------|--------|
| Staging eligible public athlete **fixture pack** | Yes — Staging only; separate Owner write token |
| Staging privacy / masking live sample | Yes — read evidence after fixtures |
| Production **read-only** browser smoke matrix | Yes — separate Owner smoke token |
| Empty-state acceptance | Yes — zero eligible rows is valid |
| Regression of 1I route/DTO/nav contracts | Yes — tests + checklists |

### 3.2 Accounts / surfaces under browser smoke

| Check | Frozen expectation |
|-------|-------------------|
| Authenticated PLAYER | Can open `/athletes` and detail when eligible id exists |
| Authenticated non-PLAYER | Can open `/athletes` (no special permission) |
| Anonymous | Client redirect / rejection (authenticated-only) |
| Directory nav once | Exactly one discoverable entry per role rules |
| Club president | Retains “Vận hành CLB” |
| Sidebar / mobile parity | Remains intact |
| Empty directory | Valid empty UI — not RPC hard-error |

### 3.3 Optional SQL (sub-phase only)

| Item | Frozen |
|------|--------|
| `pg_trgm` / GIN / additional directory indexes | **Optional 1J-E only** |
| Requires | Separate SQL authoring + Staging apply + Production apply tokens |
| Default | **Not** required to close Phase 1J core (1J-A–D + 1J-F) |

### 3.4 Contracts that remain frozen (unchanged from 1I)

| Contract | Status |
|----------|--------|
| Routes `/athletes`, `/athletes/:playerId` | Unchanged |
| Authenticated-first access | Unchanged |
| Directory DTO allow-list (7 fields) | Unchanged |
| Facade-only reads (no React RPC) | Unchanged |
| Indistinguishable null detail | Unchanged |
| Production project `expuvcohlcjzvrrauvud` | Ops target for read-only smoke only |
| Staging project `qyewbxjsiiyufanzcjcq` | Fixture target only |

Approved Directory DTO (still locked):

```text
playerId, displayName, isVerified, avatarUrl, activityRegion, gender, handedness
```

---

## 4. OUT OF SCOPE

See companion `02_IN_SCOPE_OUT_OF_SCOPE.md`. Summary:

- Anonymous directory / PublicLayout hybrid productization  
- Directory DTO expansion; rating/club/social/contact  
- Production fixture seeding (default forbidden)  
- Self-service verification; admin verification rewrite  
- Legacy blob/dossier cutover; dedupe/merge  
- Full Admin Player Management  
- CRM Phase 1J UI migration  
- Competition / Venue / Rating / Ranking / Notification feature work  
- Frontend redeploy as a Phase 1J goal (only if a scoped UX defect fix is separately authorized and merged)

---

## 5. Sub-phases (frozen sequence)

```text
1J-0  Scope freeze docs (this package)
1J-A  Staging fixture pack (Owner write token)
1J-B  Staging privacy live evidence
1J-C  Production read-only browser smoke
1J-D  Empty/eligible UX confirmation + scoped defect fix if found
1J-E  Optional directory index SQL (separate SQL gates)
1J-F  Closure / certification
```

**Hard rule:** Do **not** authorize 1J-A writes, 1J-C Production smoke, or 1J-E SQL under this freeze document alone.

---

## 6. Environment rules

| Environment | Allowed in Phase 1J |
|-------------|---------------------|
| Local / CI | Deterministic regression tests; docs |
| Staging | Fixture seed **only** after Owner write authorize; then read evidence |
| Production | **Read-only** browser/SQL smoke after Owner smoke authorize |
| Production writes | **Forbidden** unless a **new** Owner write token explicitly names Production |

---

## 7. Entry conditions for implementation

- [x] Phase 1I closed on `main`  
- [x] Owner `APPROVE_PHASE_1J_SCOPE` (Candidate A)  
- [ ] Scope-freeze package committed / merged  
- [ ] Separate Owner token for the next sub-phase (1J-A or 1J-C as sequenced)  
- [ ] No conflation with CRM Phase 1J  

---

## 8. Exit criteria (full Phase 1J — later)

- Staging has a documented eligible fixture path and privacy sample evidence **or** Owner accepts documented fixture deferral with residual risk.  
- Production browser smoke matrix recorded (PASS / FAIL / NOT VERIFIED per cell).  
- Empty eligible directory accepted as valid product state.  
- 1I directory contracts remain green.  
- Optional 1J-E either closed under its SQL gates or explicitly deferred in 1J-F.  
- Closure docs (`1J-F`) recorded; no deferred D–H started.

---

## 9. Safety rules (mandatory)

| ID | Rule |
|----|------|
| S1 | No React direct `player_directory_*` RPC calls |
| S2 | No Directory DTO field additions without privacy freeze update + `REVISE_SCOPE` |
| S3 | No Production profile/privacy/verification mutation in default 1J path |
| S4 | Staging fixtures must be reversible / clearly labeled QA data |
| S5 | No anon table grants; no browser service-role |
| S6 | No CRM UI migration under Player Management 1J |
| S7 | Rollback of optional 1J-E indexes requires separate Owner rollback token |

---

## 10. Exact Owner action next

1. Authorize **commit** of this Phase 1J-0 documentation package.  
2. After merge, authorize **1J-A** Staging fixtures **or** skip to **1J-C** only if Owner accepts empty-set residual risk in writing.  
3. Do **not** start deferred candidates B–H without `REVISE_SCOPE`.
