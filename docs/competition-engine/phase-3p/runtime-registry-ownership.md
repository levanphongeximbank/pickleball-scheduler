# Runtime Registry Ownership — Phase 3P

**Phase 3P does not implement registries.** This document decides need / owner / phase / allowed files.

## Current reality

| Registry | Exists today? |
|----------|---------------|
| Capability runtime registry | **NO** |
| Comparator registry | **NO** (generic `compareShadowResults` only) |
| Normalizer registry | **NO** (generic `normalizeShadowPayload`) |
| Shadow eligibility allowlist | Injected options only; empty = deny |
| Runtime adapter registry | **NO** (per-module adapters) |
| `RUNTIME_EXECUTOR.CANONICAL` | **NO** — LEGACY only |

## Need assessment

| Registry | Needed? | Why |
|----------|---------|-----|
| Capability / executor registry | **YES** (before multi-capability shadow) | Avoid editing `resolveRuntimeDecision` / adapters per chat |
| Comparator registry | **YES** (from first capability shadow 3B+) | Avoid editing generic compare + scattered allowlists |
| Normalizer registry | **YES** (soft) | Per-capability normalization policies |
| Shadow eligibility registry | **YES** (soft) | Central allowlists owned by Integrator |
| Runtime adapter registry | **OPTIONAL** | Adapters can stay module-local until cutover |

## Ownership

| Registry | Owner chat | Creating phase | Allowed files |
|----------|------------|----------------|---------------|
| Capability / executor registry | **CHAT I** | **Phase 3A.3 (Wave 0)** | `runtime-control/registries/**` (new), `runtime-control/index.js` (I only) |
| Comparator registry | **CHAT I** | **Phase 3A.3** | `runtime-control/shadow/registries/comparators.js` (new) |
| Normalizer registry | **CHAT I** | **Phase 3A.3** | `runtime-control/shadow/registries/normalizers.js` (new) |
| Eligibility allowlist registry | **CHAT I** | **Phase 3A.3** | `runtime-control/shadow/registries/eligibilityAllowlists.js` (new) |
| Capability comparator **implementations** | Capability chat | Matching phase (3B+) | `**/shadow/comparators/<capability>*.js` — register via Integrator |
| Adapter modules | Capability chat | Matching phase | Under capability folder; **not** root registries |

## Who may edit

| Actor | May create comparator module? | May register into central registry? | May edit eligibility default? |
|-------|-------------------------------|-------------------------------------|-------------------------------|
| Capability chat | YES (own capability) | **NO** | **NO** |
| Integrator | YES (scaffolding) | **YES** | **YES** (Owner-approved) |
| Owner | Approve | Approve | Approve |

## Phase 3A.3 — Integration Bootstrap (Owner-locked)

```text
Wave 0 = PHASE 3A.3 — INTEGRATION BOOTSTRAP
Status: REQUIRED before Phase 3B
Owner: CHAT I
```

Phase 3A.3 creates empty registry stubs, locks export/test conventions, and documents registration API.

```text
Flags still OFF
Shadow still deny
No Production wiring
No capability business algorithms
```

3B may start **only after** Phase 3A.3 merges (or Owner explicitly re-opens — not current policy).

Capability chats may add comparator modules; only Integrator registers them centrally.

## Safety invariants (must remain)

```text
Default shadow eligibility = false
Empty allowlist = deny
No Production wiring
No Math.random in shadow domain
RUNTIME_EXECUTOR stays LEGACY until Owner GO
```
