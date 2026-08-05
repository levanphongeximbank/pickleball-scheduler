# RATING-V5-CUTOVER-02 — Architecture & Authority Decision

| Field | Value |
|-------|-------|
| Workstream | `RATING-V5-CUTOVER-02` |
| Branch | `feat/rating-v5-cutover-02-staging-rehearsal` |
| Mode | Local implementation + Staging rehearsal **package** (no Staging mutation in this step) |
| Classification | `NOT_READY_FOR_PUBLISHED_AUTHORITY_CUTOVER` (unchanged) |

## Authority decision (mandatory)

| Role | Authority |
|------|-----------|
| Production published skill | **V2** `pick_vn_player_ratings.current_rating` (+ mirrors) |
| V5 | Shadow / pilot durable only (`is_shadow=true`) |
| Dual-read compare | Sidecar evidence only — **must not** change returned published value |
| Writer freeze | Staging-only; Production default **OFF**; Production deny guard |

```text
PUBLISHED_READER_CHANGES=0
PRODUCTION_WRITER_FREEZE=0
STAGING_MUTATIONS=0 (this package)
```

## Module boundary

`src/features/player-rating/cutover-02/`

- `dual-read/` — compare boundary, classification, consumer matrix, scale mapping (UNAPPROVED)
- `writer-freeze/` — OFF / OBSERVE / ENFORCE + inventory
- `config/` — flags + Production deny + Staging proof helpers
- `reconciliation/` — metrics aggregator (`OWNER_APPROVAL_REQUIRED=YES`)

## Non-goals

- Do not switch published readers to V5
- Do not disable V2 in Production
- Do not migrate Production data
- Do not deploy Production
- Do not apply Staging SQL in this workstream
- Do not choose scale mapping for Owner
