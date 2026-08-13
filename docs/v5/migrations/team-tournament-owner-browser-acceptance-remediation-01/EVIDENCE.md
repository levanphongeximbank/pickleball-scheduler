# Evidence — owner-browser-acceptance-remediation-01

## Lifecycle apply-once (Staging)

Lifecycle package was applied **once** on Staging. Supabase migration records:

- `team_tournament_post_lineup_complete_lifecycle_01`
- `team_tournament_post_lineup_complete_lifecycle_01_setup_config`

Do **not** re-run `team-tournament-post-lineup-complete-lifecycle-01/02_APPLY.sql`.

## This package

`team-tournament-owner-browser-acceptance-remediation-01` is the **corrected VERIFY follow-up** plus R1 directory RPC and R2 `scoringMode` whitelist extension:

- Lifecycle APPLY bodies for close / readiness remain authoritative as already applied.
- Lifecycle VERIFY disposable matrix used a fake tenant and omitted required `team_tournaments.name` — corrected here.
- Forward-only; Owner GO required before any Staging apply.
- STAGING_MUTATIONS=0 for this authoring pass (package created locally only).
