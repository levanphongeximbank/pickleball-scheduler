# Coaching Compatibility Map (COACHING-01)

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
| Coaching localStorage service | `services/coachingService.js` | `COMPATIBILITY_ONLY` | Key `pickleball-coaching-v1::{clubId}` |
| Coaching pages | `src/pages/coaching/*` | `LEGACY_TRANSITIONAL` | Still consume LS service via barrel |
| Platform adapter | `platform/coachingPlatformAdapter.js` | Canonical projection surface | Pure projections; no persistence |
| AI schedule detectors | `features/ai-assistant/...` | `EXTERNAL_MODULE_REFERENCE` | Consume schedule snapshots; not Coaching SoT |

---

## Explicit rules (COACHING-01)

1. Do **not** delete `coachingService.js`.
2. Do **not** present LS services as `*Repository` implementations.
3. Do **not** import LS service from `domain/`, `application/`, or `repositories/`.
4. Do **not** claim canonical durable persistence is complete.
5. localStorage retirement belongs to **COACHING-04**.

---

## Storage prefixes (legacy)

- `pickleball-coaching-v1::`

ClubId-keyed browser store without tenant stamp — known isolation risk deferred to persistence phases.
