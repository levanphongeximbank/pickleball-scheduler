# Phase 1G — Sub-phase Plan

## Order (mandatory)

```
1G-A (foundation self-edit + privacy toggles)
    →
1G-B (optional My Profile parity + stale field-list cleanup)
```

Do not open verification admin, public directory, or legacy cutover under this plan.

## 1G-A deliverables

| Deliverable | Notes |
|-------------|--------|
| Athlete foundation edit controls | `birth_date`, `handedness`, `activity_region`, privacy toggles |
| Consistent `birth_year` | Align with existing date/year rules on save |
| Canonical write path only | `updateSelfProfile` → Player durable path |
| Reload after save | Foundation panel / hook reflects persisted values |
| Verification status | Read-only display; no edit control |
| Tests | UI smoke + service; self verification write still blocked |

**Status:** **Closed** — evidence `03_PHASE_1G_A_IMPLEMENTATION_EVIDENCE.md`; phase closure `08_PHASE_1G_CLOSURE.md`.

## 1G-B deliverables (optional)

| Deliverable | Notes |
|-------------|--------|
| My Profile parity | Same foundation edit fields where product-appropriate |
| Stale field-list cleanup | e.g. Identity `SELF_EDITABLE_PROFILE_FIELDS` docs/comments |
| Avatar | Parity only if needed; no new media subsystem |

**Status:** **Excluded** (optional) — not required for Phase 1G closure; Owner `CLOSE_PHASE_1G_NOW`.

## Deferred (post–1G)

| Item | Original label | Status |
|------|----------------|--------|
| Verification admin | 1F-C / 1G-C | **Deferred** |
| Legacy writer / V2 dossier / blob cutover | 1F-D / 1G-D | **Deferred** |
| Public directory UI | 1F-B3 / 1G-E | **Deferred** |

**Phase closure:** `08_PHASE_1G_CLOSURE.md` — verdict `PHASE_1G_CLOSED` (pending docs PR merge onto `main`).

## Hard rules

1. No new Production schema SQL.
2. No Production SQL apply / deploy without separate Owner gate.
3. No expansion into C / D / E without `REVISE_SCOPE`.
4. Do not rewrite Club / Competition / Ranking / Rating / Venue / Notification in this wave.
