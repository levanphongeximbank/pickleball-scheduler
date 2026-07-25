# 05 — Environment Variable Validation And Fail-Closed

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Rule:** Security-relevant configuration must not “succeed silently” when invalid or missing. Policy only — PGO-04 does not implement new validators.

## Required vs optional (governance model)

| Tier | Required examples (names) | Optional / flag examples (names) | Notes |
|------|---------------------------|----------------------------------|-------|
| Production client build | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RBAC_ENABLED`, `VITE_SEED_DEMO`, `VITE_PAYMENT_MODE` | Many `VITE_*_ENABLED` default OFF per GA checklist | From `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |
| Staging QA | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, role fixture names as needed by script | Feature flags for pairing / constraint engines | Template `.env.staging-qa.local.example` |
| Test | Minimal set in `.env.test` | Module-specific | Harness only |
| Server / ops scripts | Script-specific privileged names (`SUPABASE_SERVICE_ROLE_KEY`, staging/prod refs) | Probe IDs, dry-run flags | Fail closed per script gates |

## Schema validation (policy)

Every environment variable used for security, tenancy isolation, or privileged operations should have:

1. **Name** (canonical)
2. **Class** (client-safe / server-only / secret / flag)
3. **Environments** where required
4. **Allowed value shape** (boolean, URL, enum, opaque secret presence)
5. **Default policy** (explicit default vs fail-closed no-default)
6. **Owner**

PGO-04 defines the policy; a future Owner-approved implementation may enforce schema in code — **not** in this documentation-only run.

## Startup / readiness validation (policy)

| Gate | Expectation | Fail-closed behavior |
|------|-------------|----------------------|
| Build-time public config | Required Production public vars present for build | Build/CI fails |
| App boot (client) | Missing critical public config → safe degraded UI or hard stop per product rule; **no** privileged fallback | Do not invent admin powers |
| Server / trusted backend boot | Missing server-only secrets for enabled provider → provider disabled **or** process fails readiness | Prefer fail closed when provider marked required |
| Ops / staging preflight scripts | Scripts such as `scripts/verify-staging-env-preflight.mjs` and module staging preflights | Exit non-zero on missing/mismatched env **names**/presence checks |
| Integration secret boundary | ECO-02 fail-closed validation / no-op test resolver | Reject secret values in descriptors; do not read live env in tests |

## Safe defaults

| Setting class | Allowed safe default | Forbidden silent default |
|---------------|----------------------|--------------------------|
| Feature / product flags | `false` / OFF (GA recommendation) | `true` that enables privileged paths without Owner GO |
| `VITE_SEED_DEMO` | `false` on Production | `true` on Production |
| `VITE_RBAC_ENABLED` | `true` on Production (GA) | Silently `false` on Production without Owner GO |
| Payment / messaging providers | Disabled until credentials + Owner GO | Mock success that looks like real payment in Production |
| Secret presence | Absent → feature unavailable or fail | Placeholder “success” with empty secret |
| Service-role | Never default into client | Any client fallback to service-role |

## Ban on silent-success for security configuration

The following are **governance violations**:

1. Treating missing Production Supabase public config as “works offline” without explicit mode.
2. Treating missing provider secrets as successful live provider calls.
3. Disabling RBAC implicitly when profile/auth fails.
4. Using Development credentials in Production because “it worked.”
5. Logging “ok” from preflight when required env names are absent.
6. Feature flags that skip authorization or RLS checks.

## Evidence of validation patterns on fresh main (read-only)

| Pattern | Evidence paths (examples) |
|---------|---------------------------|
| Staging env preflight | `scripts/verify-staging-env-preflight.mjs` |
| Module staging loaders | `src/features/customer/staging/loadCustomerStagingEnv.js`, `src/features/coaching/staging/loadCoachingStagingEnv.js` |
| ECO fail-closed contracts | `environmentClassification.js`, `secretBoundaryReadiness.js`, `credentialRequirementDescriptor.js` |
| Competition fail-closed certification | `docs/competition-engine/e2e-07/04_FAIL_CLOSED_MATRIX.md` |
| Communication production target gate | `api/communication/productionTargetGate.js` |
| GA checklist | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |

## Certification honesty

Platform-wide **unified** startup schema validation for all env classes is **not** evidenced as complete on `origin/main`.
Therefore readiness item “validation / fail-closed proof” remains incomplete → contributes to snapshot verdict **`NOT_READY`**.
