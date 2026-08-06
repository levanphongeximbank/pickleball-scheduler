# 12 — Implementation Work Packages

**Planning only.** No WP is authorized for Production mutation by this document.  
**Dependency order:** WP1 → WP2 → WP3 → WP4 → WP5 (overlap allowed with WP3/4 for tests) → WP6 → WP7 → WP8.

---

## WP1 — Schema and migration package

**Objective:** Author additive migration for `public.qa_identity_quarantines` + constraints/indexes (still no Production apply).

| Item | Detail |
|------|--------|
| Allowed files | New docs SQL under agreed migrations path; migration tests; planning cross-links |
| Prohibited | Alter `profiles_status_check`; Production/Staging apply without Owner; runtime feature cutover |
| Prerequisites | Merged B1B plan review |
| Tests | Migration idempotency lint; schema contract unit parse tests |
| Acceptance | Migration reviewed; CHECK preservation asserted in tests |
| Rollback | Drop-new-objects script authored |
| Owner GO boundary | None for authoring; Staging apply GO separate (WP6) |

## WP2 — RLS and writer authority

**Objective:** RLS deny-by-default + SECURITY DEFINER apply/release/read RPCs + audit events.

| Item | Detail |
|------|--------|
| Allowed files | SQL RPCs/policies; thin JS client wrappers if needed |
| Prohibited | Granting authenticated direct table DML; status writers for quarantine |
| Prerequisites | WP1 schema objects defined |
| Tests | RLS/RPC tests (doc 09) |
| Acceptance | AuthZ matrix implemented; forbidden paths documented in code comments sparingly |
| Rollback | Drop RPCs/policies with WP1 rollback |
| Owner GO boundary | None for authoring |

## WP3 — Runtime and filter migration

**Objective:** Dual-read then canonical read via quarantine authority projector; preserve real-user behavior.

| Item | Detail |
|------|--------|
| Allowed files | `qaTestIdentityFilter.js` and direct callers; optional read adapter |
| Prohibited | Persisting `status='quarantined'`; broad unrelated refactors |
| Prerequisites | WP2 read helper available (or feature-flagged fallback) |
| Tests | Filter unit tests; Players directory tests |
| Acceptance | Dual-read green; no-impact proofs for real users |
| Rollback | Feature flag off / restore prior filter logic |
| Owner GO boundary | None |

## WP4 — Runner remediation

**Objective:** B1B runner: authority writer first, Auth ban second, no profiles.status mutation; retire B1 GO/batch constants from authz allow.

| Item | Detail |
|------|--------|
| Allowed files | `scripts/operations/...` B1B package (new or evolved); tests |
| Prohibited | Re-enabling B1 status writes; Production execute; reusing retired GO/batch |
| Prerequisites | WP1–WP2 interfaces stable |
| Tests | Engine ordering, compensation, gates |
| Acceptance | Mock + integration tests; constants mark old GO/batch non-reusable |
| Rollback | Keep prior runner inert (`PRODUCTION_GO=NO`) |
| Owner GO boundary | No Production GO in WP4 |

## WP5 — Real database constraint and integration tests

**Objective:** Satisfy doc 09 real CHECK/RLS/RPC coverage.

| Item | Detail |
|------|--------|
| Allowed files | `tests/**`; CI harness config if required |
| Prohibited | Mocked-only sign-off; Production credentials in CI |
| Prerequisites | WP1–WP4 code available |
| Tests | Full matrix in doc 09 |
| Acceptance | Real constraint suite green in CI or documented Staging job |
| Rollback | N/A (tests) |
| Owner GO boundary | None |

## WP6 — Staging rehearsal

**Objective:** Execute doc 10 gates on Staging.

| Item | Detail |
|------|--------|
| Allowed files | Evidence under ops evidence paths (sanitized); runbooks |
| Prohibited | Production mutation; using Production allowlist against Staging |
| Prerequisites | WP1–WP5 merged; Staging backup; Staging apply approval |
| Tests | Rehearsal checklist G1–G17 |
| Acceptance | Independent review PASS |
| Rollback | Staging release + migration rollback if required |
| Owner GO boundary | Staging-only approval ≠ Production GO |

## WP7 — Fresh authorization package

**Objective:** Produce fresh Production revalidation, exact-eight allowlist, recovery snapshot, hashes, batch UUID, Owner risk decision **without mutating**.

| Item | Detail |
|------|--------|
| Allowed files | Secure backup artifacts (outside Git); sanitized evidence pointers |
| Prohibited | Mutation; reusing old hashes/GO/batch; committing secrets/PII |
| Prerequisites | WP6 acceptance |
| Tests | Hash verification dual control |
| Acceptance | Doc 11 items 8–13 complete; still `PRODUCTION_GO=NO` until item 14 |
| Rollback | Discard artifacts; regenerate |
| Owner GO boundary | Risk decision recorded; GO issued only at end of WP7 if Owner chooses — still separate from WP8 execute |

## WP8 — Production execution and closure

**Objective:** One-time authorized B1B execute + postcheck + closure evidence.

| Item | Detail |
|------|--------|
| Allowed files | Sanitized postcheck evidence |
| Prohibited | Expanding scope beyond exact-eight; hard delete; status CHECK changes; reusing retired authority |
| Prerequisites | WP7 complete including **new** Production GO |
| Tests | Live postcheck assertions |
| Acceptance | Eight quarantined via authority; Auth bans correct; profiles.status originals intact; GO/batch retired |
| Rollback | Separate rollback GO + WP8b procedure |
| Owner GO boundary | **Requires new exact Production GO**; planning docs never suffice |

---

## Cross-WP invariants

- `PROFILES_STATUS_CHECK_CHANGE_REQUIRED=NO`
- `PROFILE_STATUS_RUNTIME_SEMANTICS_PRESERVED=YES`
- `OLD_OWNER_GO_REUSABLE=NO`
- `OLD_BATCH_REUSABLE=NO`
- Implementation commits must not silently set `PRODUCTION_GO=YES`
