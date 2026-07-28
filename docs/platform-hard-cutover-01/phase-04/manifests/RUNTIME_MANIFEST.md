# Runtime Authority Manifest

Source of truth: `src/features/platform-hard-cutover/runtimeAuthorityMatrix.js`

| Domain | Production adapter | Flag | Forbidden fallback | Fail-closed |
|--------|-------------------|------|--------------------|-------------|
| club_cloud | club_data_v3 | — | club_ai_data, pickleball-cloud-db-v1 | LOCAL_CLOUD_DB_FORBIDDEN |
| club_blob_local | cache-only under hard cutover | VITE_PLATFORM_HARD_CUTOVER_ENABLED | LS SoT | LOCALSTORAGE_AUTHORITY_FORBIDDEN |
| court_runtime | durable court-engine | VITE_COURT_RUNTIME_AUTHORITY | local as Prod SoT | COURT_RUNTIME_* |
| competition_match_result | competition_ssot_finalize_match_result | VITE_COMPETITION_REMOTE_SSOT_ENABLED | tournament_match_live direct, in-memory Prod | COMPETITION_SSOT_UNAVAILABLE |
| player_rating | foundation → V5 | VITE_PICK_VN_RATING_V5_ENABLED | club blob verified write, Elo-as-public | PLAYER_RATING_* |
| public_news | live RPC | VITE_PUBLIC_NEWS_SOURCE=live | MOCK_NEWS silent | PUBLIC_NEWS_* |
| private_pairing_rules | privatePairingRulesRepository → security-definer RPC; live load via `private_pairing_get_active_rules_for_scope` | VITE_PLATFORM_HARD_CUTOVER_ENABLED | legacy_blob picker, localStorage rule SoT, mock persistence, direct SPA table writes, silent rating=3.5 | PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN / MISSING_PLAYER_RATING |

**Rule:** Never two authorities active for the same domain.

### private_pairing_rules authority (exact)

| Role | Authority |
|------|-----------|
| Rule SSOT | 4 tables: `private_pairing_rule_sets`, `private_pairing_rules`, `private_pairing_rule_targets`, `private_pairing_rule_audit_logs` |
| Writers | security-definer RPC only (`PRIVATE_PAIRING_RPC.*`) |
| Admin CRUD | SPA → `privatePairingRulesRepository` → RPC only |
| Live runtime rule load | `private_pairing_get_active_rules_for_scope` via `loadActiveRulesForLiveScope` |
| Admin player/club picker (hard cutover ON) | Canonical club/player repositories only |
| Admin player/club picker (hard cutover OFF) | Canonical when flags ON; else `legacy_blob` / `loadPlayersForClub` |
| Rating under hard cutover | No silent `3.5`; warn + exclude / fail-closed (`MISSING_PLAYER_RATING`, `INSUFFICIENT_RATED_PLAYERS`) |
