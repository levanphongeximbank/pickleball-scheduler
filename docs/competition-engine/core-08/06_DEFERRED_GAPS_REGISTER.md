# CORE-08 — Deferred Gaps Register

**Phase:** 1E (documentation only)
**Status:** Explicitly deferred — not blocking capability-local certification
**Related:** `04_PHASE_1E_FINAL_CERTIFICATION.md`, `05_INTEGRATION_HANDOFF.md`

## Register

### 1. Club/unit/host multi-attempt search

| Field | Value |
|-------|-------|
| Owner | Competition Format (open-conditional engines) |
| Reason deferred | Format-owned penalty search; outside Phase 3H placement SSOT |
| Required evidence | Format provider implementing `constraintResolver` or format-owned pre-step with certified parity fixtures |
| Proposed future phase | Integrator Wave + Format constraint provider |
| Cutover risk | High if claimed as CORE-08 parity without provider |

### 2. Private-pairing format rules

| Field | Value |
|-------|-------|
| Owner | Competition Format / Team Tournament |
| Reason deferred | Pairing candidate search is not placement; adapters fail closed today |
| Required evidence | Format rules injected via generic resolver or format pre-processor; parity tests |
| Proposed future phase | Format provider + Integrator wiring |
| Cutover risk | High if TT private pairing silently ignored |

### 3. Input fingerprint

| Field | Value |
|-------|-------|
| Owner | CORE-08 (future) / Integrator audit policy |
| Reason deferred | Draw identity exists; full input fingerprint not required for dormant capability |
| Required evidence | Stable hash of normalized request fields; golden tests |
| Proposed future phase | CORE-08 audit hardening (post-integration decision) |
| Cutover risk | Medium for audit/replay disputes |

### 4. Ruleset version

| Field | Value |
|-------|-------|
| Owner | CORE-01 Rule Engine + Integrator |
| Reason deferred | No production ruleset binding yet |
| Required evidence | Version string on request/result; persistence of ruleset id |
| Proposed future phase | Integration with CORE-01 |
| Cutover risk | Medium for cross-version replay |

### 5. Executable bye policy

| Field | Value |
|-------|-------|
| Owner | CORE-08 (extension) / Competition Format |
| Reason deferred | First-class byes exist; richer policy object execution deferred |
| Required evidence | Policy contract + bracket fixtures covering alternate bye strategies |
| Proposed future phase | CORE-08 bye-policy extension |
| Cutover risk | Low–medium depending on format bye rules |

### 6. Root export

| Field | Value |
|-------|-------|
| Owner | Integrator |
| Reason deferred | Capability must stay dormant until Owner/Integrator decide public surface |
| Required evidence | Explicit re-export decision + architecture tests updated |
| Proposed future phase | Integration Wave |
| Cutover risk | High if exported before shadow parity |

### 7. Official CI integration

| Field | Value |
|-------|-------|
| Owner | Integrator |
| Reason deferred | Capability-local manifests only; official `unit-test-files.json` untouched |
| Required evidence | Merge of phase manifests; green CI on target branch |
| Proposed future phase | Integration Wave |
| Cutover risk | Medium (CI noise / false confidence if incomplete) |

### 8. Real persistence implementation

| Field | Value |
|-------|-------|
| Owner | CORE-03 Persistence |
| Reason deferred | CORE-08 exposes port only; default noop |
| Required evidence | Port implementation + identity/snapshot round-trip tests |
| Proposed future phase | CORE-03 + Integrator wiring |
| Cutover risk | High if production assumes durable draws without CORE-03 |

### 9. Production shadow comparison

| Field | Value |
|-------|-------|
| Owner | Integrator |
| Reason deferred | No production callers wired; legacy remains primary |
| Required evidence | Side-by-side fixture suite; mismatch triage; flag-gated observe mode |
| Proposed future phase | Preview/Staging certification |
| Cutover risk | Critical if skipped before cutover |

### 10. Production cutover

| Field | Value |
|-------|-------|
| Owner | Owner (approval) + Integrator (execution) |
| Reason deferred | Phase 1E forbids cutover by design |
| Required evidence | Staging Go, rollback rehearsal, Owner written approval |
| Proposed future phase | Production cutover wave |
| Cutover risk | Critical |

### 11. Legacy retirement

| Field | Value |
|-------|-------|
| Owner | Owner + Integrator |
| Reason deferred | Legacy engines must remain available through cutover and grace period |
| Required evidence | Usage telemetry zero; rollback unused; Owner approval to delete |
| Proposed future phase | Post-cutover retirement |
| Cutover risk | Critical if deleted early |

## Summary

Deferred gaps do not invalidate Phase 1E certification. They condition **integration readiness** and must be closed (or explicitly accepted) before Production cutover.
