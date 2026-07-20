# CORE-06 — Lifecycle (Phase 1B Scope Freeze)

**Status:** Canonical lifecycle frozen for Phase 1C+  
**Canonical statuses:** `DRAFT` → `SUBMITTED` → `LOCKED` → `PUBLISHED` → `SUPERSEDED` / `VOIDED`  
**TT extended statuses:** Format aliases — see `06_STATUS_ALIAS.md`

---

## 1. Canonical status set

| Status | Meaning |
|--------|---------|
| `DRAFT` | Editable selection; includes TT empty / not-yet-submitted semantics |
| `SUBMITTED` | Captain/manager has submitted a complete (policy-valid) lineup |
| `LOCKED` | Selections immutable to captain; awaiting or post-deadline lock |
| `PUBLISHED` | Revealed per visibility rules; consumers may use for match ops |
| `SUPERSEDED` | Prior revision replaced by authorized override |
| `VOIDED` | Terminal cancel — covers TT withdraw / expire semantics via reason codes |

```text
DRAFT
  ↓ submit
SUBMITTED
  ↓ lock
LOCKED
  ↓ publish
PUBLISHED
  ↓ override (authorized)
SUPERSEDED  (+ new revision → LOCKED → requires republish → PUBLISHED)

Any of DRAFT | SUBMITTED | LOCKED
  ↓ void
VOIDED
```

---

## 2. Canonical actions

| Action | Code | Typical to-status |
|--------|------|-------------------|
| Save draft | `save_draft` | `DRAFT` |
| Submit | `submit` | `SUBMITTED` |
| Lock | `lock` | `LOCKED` |
| Publish | `publish` | `PUBLISHED` |
| Override | `override` | `SUPERSEDED` (prior) + new revision |
| Void | `void` | `VOIDED` |

**Format / system commands** (not separate Core statuses):

| Format action | Resolves to |
|---------------|-------------|
| `randomize` | Fill via `LineupRandomPort` then `lock` (+ source metadata) |
| `expire` | System `void` (or lock path with expire reason — TT maps to `expired` → Core `VOIDED`) |

---

## 3. Transition matrix (canonical Core)

Matches Phase 3E `LINEUP_TRANSITION_MATRIX` / Phase 1A freeze target. Role and deadline enforcement are **policy + authz injected**, not hard-coded in the matrix alone.

| Action | From | To | Notes |
|--------|------|-----|-------|
| `save_draft` | `DRAFT`, `SUBMITTED` | `DRAFT` | Re-open edits before lock |
| `submit` | `DRAFT`, `SUBMITTED` | `SUBMITTED` | Re-submit allowed while editable |
| `lock` | `DRAFT`, `SUBMITTED` | `LOCKED` | Empty/missing may trigger missing-lineup policy first |
| `publish` | `LOCKED` | `PUBLISHED` | Reveal gate |
| `override` | `LOCKED`, `PUBLISHED` | `SUPERSEDED` | Requires elevated authz + reason; new revision follows |
| `void` | `DRAFT`, `SUBMITTED`, `LOCKED` | `VOIDED` | Withdraw / cancel; Phase 1C adds `LOCKED → VOIDED` |

**Immutable for ordinary edits:** `LOCKED`, `PUBLISHED`, `SUPERSEDED`, `VOIDED`.

---

## 4. Override / republish path

Documented from TT-3 behavior; Core owns structure, Format/TT own product RPC until cutover:

```text
LOCKED or PUBLISHED
  --override(reason)--> SUPERSEDED (old revision)
  --new revision--> DRAFT/SUBMITTED content as LOCKED (after BTC lock)
  --publish--> PUBLISHED
```

Visibility: after override of a published lineup, opponent selections re-hide until republish (`requires_republish` Format flag). Core models this via VisibilityGrant + status, not a separate Core status.

---

## 5. Transition ownership

| Transition | Domain owner | Authz (typical) | Policy / clock |
|------------|--------------|-----------------|----------------|
| `save_draft` | Core-06 | Captain / Manager (own team) | Deadline open |
| `submit` | Core-06 | Captain / Manager | Full submit validation via `LineupPolicy` |
| `lock` | Core-06 | Manager / TD / System | Deadline or explicit BTC lock |
| `publish` | Core-06 | Manager / TD | Both sides ready (Format matchup ops) |
| `override` | Core-06 | TD / elevated Manager (BTC) | Reason required; elevated after matchup start |
| `void` | Core-06 | Captain (withdraw pre-lock) / TD / System (expire) | Includes `LOCKED → VOIDED` (Phase 1C) |
| `randomize` → lock | Core command + Format algorithm | Manager / System | `LineupRandomPort` must be **seeded/deterministic** before production-ready claim |
| Matchup schedule open/close | **Not Core-06** | — | Format / Schedule supplies context flags |

Referee: **read** published (assigned) only — no lifecycle mutation.

---

## 6. Matchup-level machine (out of Core-06)

TT matchup statuses such as `scheduled → lineup_open → locked → published` remain Format / Match scheduling.

Core-06 **reacts** to:

- Context open for draft
- Deadline passed
- Lock / publish commands

Core-06 does **not** own the matchup state machine.

---

## 7. Concurrency & audit (lifecycle-adjacent)

On every write transition (future write phases):

- `expectedVersion` / revision check → conflict fails closed
- Idempotency key + payload hash
- Append-only audit (actor, action, from/to, reason, request id)

Production today: TT `expectedVersion` + command log + `team_tournament_lineup_revisions`. Core must require the same contracts on any future write port.

---

## 8. Freeze statements

1. Canonical Core statuses are exactly the six values above — no `NOT_SUBMITTED` / `WITHDRAWN` / `EXPIRED` as Core statuses.
2. TT extended statuses remain aliases (see `06_STATUS_ALIAS.md`).
3. Phase 1C may implement domain transition service parity; Phase 1B does not implement code.
