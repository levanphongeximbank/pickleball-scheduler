# team-tournament-production-referee-foundation-01

**PACKAGE AUTHORING ONLY. Do NOT apply to Staging or Production without a separate Owner GO.**

This package does **not** replay Staging migration history and does **not** copy Staging rows.

## Why

Production (`expuvcohlcjzvrrauvud`) is missing the referee foundation objects that
`docs/v5/migrations/team-tournament-canonical-referee-lifecycle-01/` PRECHECK requires.

Audit classification: **C** — Staging schema has unproven history. A new canonical
Production package is required.

## Boundary

| Layer | Owns |
|-------|------|
| **FOUNDATION (this package)** | `referee_assignments`, `match_live_states`, `team_sub_match_referee_links`; helpers `referee_v5_assignment_effective_status`, `referee_v5_match_state_id`, `referee_v5_current_user_has_assignment`; pre-canonical `create_referee_assignment`, `provision_eligibility`, `build_v5_state_shell` |
| **FINAL CONTINUATION (#418 package, unchanged)** | `resolve_effective_referee_assignment`, `result_write_guard`, `ensure_referee_runtime_for_matchup`, ensure triggers, canonical replacements of create/eligibility/start/confirm/draft/record, `list_my_referee_assignments` |

## Apply order (Owner GO only, later)

1. This package: `01_PRECHECK` → `02_APPLY` → `03_VERIFY`
2. Separate Owner GO: `team-tournament-canonical-referee-lifecycle-01`

Do not apply this package and the final continuation in the same un-reviewed session.

## Safety

- `STAGING_ROWS_COPIED=0`
- `EXISTING_TOURNAMENT_BACKFILL_REQUIRED=NO`
- `EXISTING_BUSINESS_DATA_MUTATION=NO`
- `FUTURE_WRITES_ONLY=YES`
- `PERMISSION_CATALOG_DML=NO`
- `ANON_TABLE_WRITE=DENY`
- `ANON_REFEREE_RPC_EXECUTE=DENY`
- Rollback refuses if foundation tables contain live rows or if final continuation is present

## Package LF SHA256 lock

Filled after authoring freeze. See `FOUNDATION_OBJECT_MANIFEST.json` and the unit test lock.

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `7fdc406e95eb34b7d9a52dd0a6038d9df82184dd3d7d968b99ce94912b95eeb3` |
| `02_APPLY.sql` | `0844ba3cb5bb76d9d09df84a43beb05951d35c033ec4856ab29393899ee8a8e7` |
| `03_VERIFY.sql` | `43af44345a3adea5b90b481bee8d645872d79a08d734a6be8cea621fe2ca5e29` |
| `04_ROLLBACK.sql` | `3aacae2af388e19fa6cb90d549bc77b231cae5d7069c43bcae06327225206679` |
