# CORE-06 — Status Alias Map (Phase 1B Scope Freeze)

**Status:** Frozen TT ↔ CORE mapping before Phase 1C coding  
**Canonical Core enum:** `COMPETITION_LINEUP_STATUS`  
**Mapper reference:** Phase 3E `LEGACY_LINEUP_STATUS_MAP` / `mapLegacyLineupStatus`

---

## 1. Freeze rule

1. Core statuses are **only**: `DRAFT`, `SUBMITTED`, `LOCKED`, `PUBLISHED`, `SUPERSEDED`, `VOIDED`.
2. TT extended statuses (`not_submitted`, `withdrawn`, `expired`, `overridden`, …) are **Format aliases**.
3. Mapping is one-way for read/map/shadow: TT → Core.
4. Round-trip write cutover (Core → TT) requires Owner-approved adapter rules (later phase).

---

## 2. TT → CORE map (locked)

| TT status (normalized lowercase) | CORE status | Notes |
|----------------------------------|-------------|-------|
| `not_submitted` | `DRAFT` | Empty / not started semantics; Core does not add `NOT_SUBMITTED` |
| `not_started` | `DRAFT` | Spec alias of `not_submitted` |
| `draft` | `DRAFT` | |
| `submitted` | `SUBMITTED` | |
| `locked` | `LOCKED` | |
| `published` | `PUBLISHED` | |
| `overridden` | `SUPERSEDED` | BTC override of locked/published |
| `superseded` | `SUPERSEDED` | Already-canonical alias |
| `withdrawn` | `VOIDED` | Reason code distinguishes withdraw |
| `expired` | `VOIDED` | Reason code distinguishes expire |
| `voided` | `VOIDED` | |

```text
TT NOT_SUBMITTED / not_submitted / not_started
        ↓
CORE DRAFT

TT draft
        ↓
CORE DRAFT

TT submitted
        ↓
CORE SUBMITTED

TT locked
        ↓
CORE LOCKED

TT published
        ↓
CORE PUBLISHED

TT overridden
        ↓
CORE SUPERSEDED

TT withdrawn / expired / voided
        ↓
CORE VOIDED
```

---

## 3. Action alias notes

| TT action | CORE action | Status effect via Core matrix |
|-----------|-------------|-------------------------------|
| `save_draft` | `save_draft` | → `DRAFT` |
| `submit` | `submit` | → `SUBMITTED` |
| `lock` | `lock` | → `LOCKED` |
| `publish` | `publish` | → `PUBLISHED` |
| `override` | `override` | → `SUPERSEDED` (+ new revision) |
| `withdraw` | `void` | → `VOIDED` (reason: withdrawn) |
| `expire` | `void` (system) | → `VOIDED` (reason: expired) |
| `randomize` | Format command → Core `lock` after fill | → `LOCKED` + source metadata |

---

## 4. Parity gap (documented, non-blocking)

Phase 1A risk: TT state machine is richer (distinct `not_submitted`, `randomize`, `withdraw`, `expire`; republish from `overridden`).

Core collapses:

- `not_submitted` → `DRAFT` (empty slots / source flag may carry TT nuance in `extensions`)
- `withdrawn` / `expired` → `VOIDED` + reason
- `overridden` → `SUPERSEDED`

Phase 1C must preserve **observable** TT behavior via reason codes / extensions / policy — not by widening the Core enum.

---

## 5. Unknown status policy

- Empty / null TT status → Core `DRAFT` (mapper default)
- Unknown string → map/validate error (`UNSUPPORTED_LINEUP_STATUS`) — fail closed
- Already-Core uppercase values pass through if members of `COMPETITION_LINEUP_STATUS`

---

## 6. Matchup status (not aliased here)

Matchup-level statuses are **out of Core-06** and are not mapped into `COMPETITION_LINEUP_STATUS`.
