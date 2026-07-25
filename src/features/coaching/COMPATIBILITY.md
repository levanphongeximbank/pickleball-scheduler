# Coaching Compatibility Map (COACHING-01 → COACHING-04)

This document classifies the **pre-existing** Coaching implementation.
It does **not** authorize treating localStorage services as canonical Coaching repositories.

## Classification legend

| Class | Meaning |
|-------|---------|
| `COMPATIBILITY_ONLY` | Keep operational; not domain SoT; migrate later |
| `LEGACY_TRANSITIONAL` | UI/surface still used; will be rewired in later phases |
| `EXTERNAL_MODULE_REFERENCE` | Belongs to another module |

---

## Existing components

| Component | Path | Classification | Notes |
|-----------|------|----------------|-------|
| Coaching localStorage service | `services/coachingService.js` | `COMPATIBILITY_ONLY` | Key `pickleball-coaching-v1::{clubId}` — **not deleted** |
| Coaching pages | `src/pages/coaching/*` | `LEGACY_TRANSITIONAL` | COACHING-04: consume via `runtime/` boundary only |
| Runtime boundary | `runtime/*` | Canonical UI gateway | Mode default = legacy (`COACHING_DURABLE_RUNTIME_DEFAULT=false`) |
| Platform adapter | `platform/coachingPlatformAdapter.js` | Canonical projection surface | Pure projections; no persistence |
| AI schedule detectors | `features/ai-assistant/...` | `EXTERNAL_MODULE_REFERENCE` | Consume schedule snapshots; not Coaching SoT |

---

## Explicit rules

1. Do **not** delete `coachingService.js` or the `pickleball-coaching-v1` key prefix.
2. Do **not** present LS services as `*Repository` implementations.
3. Do **not** import LS service from `domain/`, `application/`, or `repositories/`.
4. Pages must **not** import `coachingService` directly — only via `runtime/` (legacy adapter).
5. **localStorage retirement is deferred** — `LOCALSTORAGE_RETIRED=false`; detect/classify helpers only; no silent upload or delete activation.
6. Durable runtime activation remains Owner-gated (`COACHING_DURABLE_RUNTIME_DEFAULT=false`).
7. No silent fallback from durable failure to legacy success.

---

## Storage prefixes (legacy)

- `pickleball-coaching-v1::`

ClubId-keyed browser store without tenant stamp — known isolation risk deferred until Owner-authorized retirement.
