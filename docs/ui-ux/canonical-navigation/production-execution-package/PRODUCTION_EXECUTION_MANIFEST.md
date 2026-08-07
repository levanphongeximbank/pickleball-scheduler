# Canonical Navigation — Production Execution Manifest

**Program:** PICK_VN Canonical Navigation  
**Package path:** `docs/ui-ux/canonical-navigation/production-execution-package/`  
**Machine-readable:** [`PRODUCTION_EXECUTION_MANIFEST.json`](./PRODUCTION_EXECUTION_MANIFEST.json)  
**Authoring date (evidence timestamp):** 2026-08-06  
**Package status:** `DRAFT_LOCAL_COMMITTED_NOT_AUTHORIZED_FOR_EXECUTION`

---

## Purpose

This package is the Owner-bound **Production execution package** for Canonical Navigation flag activation on Vercel Production. It records bindings required before any Production GO, documents identity/waiver gaps, and defines deployment, browser acceptance, rollback, and monitoring runbooks.

This package does **not** authorize Production mutation. All execution GO tokens remain **NO** until separately bound against this package digest, exact source SHA, Vercel project, Production target, domain, and execution window.

**Planning predecessor (non-authorizing cross-reference):**  
`docs/ui-ux/canonical-navigation/production-activation-readiness/`

---

## Source and deployment bindings

| Field | Value |
|-------|--------|
| Source baseline SHA | `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b` |
| Authoring branch | `audit/canonical-navigation-production-execution-readiness` |
| Vercel project name | `pickleball-scheduler` |
| Vercel project ID | `prj_glU9Gr0zPaNoMlTcIJCAHVk5UowG` |
| Production domain | `https://pickvn.app` |
| Production target | Vercel Production for project `pickleball-scheduler` |
| Flag name | `VITE_CANONICAL_APP_SHELL_ENABLED` |
| Production flag classification (before) | **ABSENT** |
| Production flag intended after | **TRUE** |
| Flag evaluation mode | Vite build-time (`import.meta.env`) |
| Redeploy required after flag change | **YES** |
| Environment change alone sufficient | **NO** |

---

## Execution window and operations

| Field | Value |
|-------|--------|
| Timezone | `Asia/Ho_Chi_Minh` |
| Execution window start | `2026-08-07T21:00:00+07:00` |
| Execution window end | `2026-08-07T23:00:00+07:00` |
| Merge freeze | **YES** |
| Maximum decision time | **10** minutes |
| Monitoring interval | **5** minutes |
| Monitoring duration | **60** minutes |

---

## Named owners

| Role | Owner |
|------|--------|
| Deployment operator | Le Phong |
| Rollback owner | Le Phong |
| Monitoring owner | Le Phong |
| Evidence recorder | Le Phong |
| Owner approval authority | Le Phong |

---

## Frozen package digest

| Field | Value |
|-------|--------|
| Digest algorithm | SHA-256 |
| Digest input HEAD | `fea727e0c452447d5942ef505a0e8336dfd53011` |
| Source baseline | `1bcc4dc729dd53027de1fac1cf39001ea5d29f4b` |
| Canonical digest-manifest format | `<sha256><two spaces><repository-relative-path>` per line; LF endings; trailing LF |
| `EXECUTION_PACKAGE_DIGEST` | `fda262a74832daf9356ca8bd6744deaaf3e82e15d17bda19cc4957dbb3fbcdce` |
| Digest calculation timestamp | `2026-08-07T00:00:09+07:00` (`Asia/Ho_Chi_Minh`) |
| Digest status | `FROZEN_FOR_DRAFT_PR_REVIEW` |
| Digest binds future Production execution SHA? | **NO** — `FINAL_EXECUTION_SHA` remains PENDING |

### Exact eight-file input set (lexicographic) and per-file SHA-256

Computed from committed bytes at digest input HEAD only (digest-record edits below are outside the frozen input):

```
77ae2318b1970b18695433ec2918ee2cac50503b197ebac8def7ceedd224bb18  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_BROWSER_ACCEPTANCE_RUNBOOK.md
1b8395bed2834295fc59bcbb810bf2892e23f91480397c9714c7086276af2922  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_DEPLOYMENT_AND_FLAG_RUNBOOK.md
5947fa12b8fc8e8fc5e68651a359f00992ee43ea8652de1f257a363dd97d20e8  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_EXECUTION_MANIFEST.json
e295b3ae2d0244afdb173a4c96e16c4115969150524aef129efd46ca14345129  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_EXECUTION_MANIFEST.md
faab54b1407eb6d3b0a21aaba8b0f6cfeffdf203f00f598ce17a230f5f415767  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_EXECUTION_READINESS_CHECKLIST.md
3449c0b604aa646b27e107ee9b556d366e1db6950c9decb9733aaf0eea8d8aed  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_GO_TOKEN_CONTRACT.md
1b65c6bf9afa353e122d559c017837fb69cc94c4371bd596daa54dfc869359f0  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_IDENTITY_AND_WAIVER_MATRIX.md
806ec03bd74174141c156be593da10dd7b7809f880b6efb58575983223a98ea0  docs/ui-ux/canonical-navigation/production-execution-package/PRODUCTION_ROLLBACK_AND_MONITORING_RUNBOOK.md
```

---

## Placeholders (do not invent)

| Placeholder | Current status |
|-------------|----------------|
| Package digest | **FROZEN** — `fda262a74832daf9356ca8bd6744deaaf3e82e15d17bda19cc4957dbb3fbcdce` (`FROZEN_FOR_DRAFT_PR_REVIEW`) |
| Final execution SHA | **PENDING** — bind exact SHA at execution GO (`FINAL_EXECUTION_SHA_BINDING_GO=NO`) |
| Final live flag re-attestation | **PENDING** — re-attest in Vercel at execution window before flag change |
| Deployment ID | **PENDING** — capture only after authorized Production redeploy |
| Deployment SHA | **PENDING** — capture only after authorized Production redeploy |
| Final Owner GO timestamp | **PENDING** — bind only when Owner issues execution GOs |

---

## Current GO token state

All Production execution tokens below remain **NO**. The separate planning-only token `PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO` is **YES** solely to record Owner-approved waiver planning. One generic GO does not imply the others. See [`PRODUCTION_GO_TOKEN_CONTRACT.md`](./PRODUCTION_GO_TOKEN_CONTRACT.md).

| Token | Value |
|-------|-------|
| `PRODUCTION_GO` | **NO** |
| `PRODUCTION_FLAG_CHANGE_GO` | **NO** |
| `PRODUCTION_ENV_CHANGE_GO` | **NO** |
| `PRODUCTION_REDEPLOY_GO` | **NO** |
| `PRODUCTION_BROWSER_ACCEPTANCE_GO` | **NO** |
| `PRODUCTION_OPS_BINDING_GO` | **NO** |
| `PRODUCTION_FLAG_MECHANICS_GO` | **NO** |
| `PRODUCTION_IDENTITY_COVERAGE_GO` | **NO** |
| `PRODUCTION_IDENTITY_COVERAGE_PLANNING_GO` | **YES** |
| `IDENTITY_CREATION_GO` | **NO** |

---

## Identity summary

| Identity class | Status |
|----------------|--------|
| Production operating mode | `OWNER_ONLY_CONTROLLED_PILOT` |
| SUPER_ADMIN | `EXISTING_OWNER_ACCOUNT` (test required) |
| Public unauthenticated | `AVAILABLE` (test required) |
| Non-admin allow | `WAIVED_BY_OWNER` |
| Non-admin deny | `WAIVED_BY_OWNER` |
| Tenant isolation | `WAIVED_BY_OWNER` |
| COACH | `WAIVED_WITH_KNOWN_SCHEMA_GAP` |

Owner waivers apply to `CANONICAL_NAVIGATION_INITIAL_PRODUCTION_ACTIVATION_ONLY` and expire before any non-Owner user or second tenant is enabled. See [`PRODUCTION_IDENTITY_AND_WAIVER_MATRIX.md`](./PRODUCTION_IDENTITY_AND_WAIVER_MATRIX.md).

---

## Package file inventory

1. `PRODUCTION_EXECUTION_MANIFEST.md` / `.json`
2. `PRODUCTION_IDENTITY_AND_WAIVER_MATRIX.md`
3. `PRODUCTION_BROWSER_ACCEPTANCE_RUNBOOK.md`
4. `PRODUCTION_DEPLOYMENT_AND_FLAG_RUNBOOK.md`
5. `PRODUCTION_ROLLBACK_AND_MONITORING_RUNBOOK.md`
6. `PRODUCTION_GO_TOKEN_CONTRACT.md`
7. `PRODUCTION_EXECUTION_READINESS_CHECKLIST.md`

---

## Explicit non-actions (this authoring)

- No Production flag change  
- No Vercel environment mutation  
- No Production redeploy  
- No browser acceptance execution  
- No identity creation or mutation  
- No SQL  
- No Staging / Auth / Production mutation  
- No push / PR from this package authoring alone  

---

## Final readiness (authoring close)

**`EXECUTION_PACKAGE_DRAFT_COMPLETE_NOT_READY_FOR_PRODUCTION_GO`**

Identity planning coverage is complete for `OWNER_ONLY_CONTROLLED_PILOT` via Owner waivers. Production mutation GOs remain **NO**.
