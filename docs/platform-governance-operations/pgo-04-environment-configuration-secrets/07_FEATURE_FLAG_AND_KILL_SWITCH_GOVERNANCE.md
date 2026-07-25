# 07 — Feature Flag And Kill Switch Governance

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Rule:** Flags control **release**, not **authorization**. Flags must not bypass security.

## Flag purposes (allowed)

| Purpose | Meaning | Example name patterns (evidence) |
|---------|---------|----------------------------------|
| **Release control** | Gradual enable of product surface | `VITE_ENABLE_AI_ENGINE`, `VITE_API_ENABLED`, `VITE_MARKETPLACE_ENABLED`, `VITE_COMPETITION_CORE_*_ENABLED` |
| **Kill switch** | Fast disable of a risky path | Competition Engine kill-switch docs/resolvers under `src/features/competition-core/runtime-control/**` |
| **Tenant / cohort rollout** | Limited audience enablement | Module staging/cohort env patterns (module-owned) |
| **Mode switch** | Non-secret behavioral mode | `VITE_PAYMENT_MODE`, `VITE_*_STORE_MODE`, data-mode flags |

## Ownership

| Flag domain | Owner | Platform Core? |
|-------------|-------|----------------|
| GA product `VITE_*_ENABLED` in templates / GA checklist | Module owner + Platform ops | No — product flags |
| Competition Core / Engine flags | Competition Engine owner | No — module-owned; pending ≠ Platform Core defect |
| Rating / Referee V5 flags | Module owners | No |
| Notification store / require-supabase flags | Notification owner | No; Production Phase 2C = **`DEFERRED_BY_OWNER`** |
| Platform-wide security posture (`VITE_RBAC_ENABLED`) | Platform + Security + Owner | Treat as high-risk Production change |

## Naming conventions (policy)

1. Prefer explicit `*_ENABLED`, `*_MODE`, or documented kill-switch names.
2. Do not encode secrets inside flag values.
3. Do not use flag names that imply security bypass (e.g. “skipAuth”) without Security Owner + Owner GO — default **prohibited**.
4. Document default state in module docs or GA checklist.

## Default state

| Environment | Default policy |
|-------------|----------------|
| Local / Development | Module-defined; prefer OFF for unfinished surfaces |
| Test | Deterministic; usually OFF unless test requires ON |
| Staging | Explicit per staging track; Owner GO for risky ON |
| Production | GA checklist: many product flags **OFF** until Owner GO + SQL/deps ready |

GA evidence: `docs/GA-PRODUCTION-ENV-CHECKLIST.md` lists AI / API / Marketplace / payment providers / messaging defaults OFF.

## Rollout and kill switch

| Step | Control |
|------|---------|
| Propose flag ON | Change request ([06](./06_CONFIGURATION_DRIFT_CHANGE_AND_APPROVAL.md)) + owner |
| Staging verification | Module QA evidence; no Production assumption |
| Production enable | Owner GO; confirm deps (SQL, secrets server-only, RLS) |
| Kill switch trip | Disable flag / invoke kill-switch resolver; audit who/when; link incident if SEV |
| Expiry | Temporary flags need review/expiry date — until approved: **`PROVISIONAL_NOT_CERTIFIED`** |

## Tenant targeting

- Tenant targeting is **module-owned** when implemented in product data/rules.
- Env vars are a blunt instrument; prefer application-level targeting for tenants when available.
- Env-based cohort switches still require classification and Owner GO for Production.

## Prohibited security bypasses

Feature flags / kill switches **must not**:

1. Disable RLS or authorize as service-role from the browser.
2. Skip authentication or RBAC checks in Production.
3. Expose server-only secrets to the client “for convenience.”
4. Mark Notification Production Phase 2C as enabled without Owner GO (track remains **`DEFERRED_BY_OWNER`**).
5. Treat “flag ON” as substitute for secret boundary cutover (ECO-02b).

## Evidence inventory (read-only paths)

| Area | Paths |
|------|-------|
| Competition feature flags | `src/features/competition-core/config/featureFlags.js`, `docs/competition-core/CC01_FEATURE_FLAGS.md`, `CC03A_*`, `CC03B_*` |
| Kill switch | `src/features/competition-core/runtime-control/resolvers/resolveKillSwitch.js`, `docs/competition-engine/phase-3/10_FEATURE_FLAGS_AND_KILL_SWITCH.md`, `phase-3a1/04_KILL_SWITCH_IMPLEMENTATION.md` |
| Rating flags | `src/features/pick-vn-rating-v5/config/featureFlags.js` |
| Notification env constants | `src/features/notifications/constants/notificationEnvironments.js` |
| GA defaults | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |

## Snapshot honesty

Platform-wide flag registry with expiry enforcement is **not** certified in PGO-04. Module flag systems exist partially. Certification contribution: **PARTIAL / NOT_READY**.
