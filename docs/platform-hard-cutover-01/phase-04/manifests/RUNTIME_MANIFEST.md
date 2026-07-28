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

**Rule:** Never two authorities active for the same domain.
